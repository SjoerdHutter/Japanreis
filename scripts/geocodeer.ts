/**
 * Zoekt coördinaten voor plekken die er nog geen hebben, via Nominatim van
 * OpenStreetMap. Met de hand te draaien, nooit in de browser:
 *
 *   npm run geocodeer             zoekt en schrijft in data/plaatsen/hanoi.yaml
 *   npm run geocodeer -- --droog  zoekt en laat zien, maar schrijft niets
 *   npm run geocodeer -- --opnieuw  zoekt ook plekken die al coördinaten van
 *                                   Nominatim hebben opnieuw op
 *   npm run geocodeer -- --stad kyoto  een ander bestand
 *
 * Volgens het gebruiksbeleid van Nominatim: hooguit één verzoek per seconde en
 * een eigen User Agent. Wil je dat Nominatim je kan bereiken als er iets mis
 * is, zet dan NOMINATIM_EMAIL in je omgeving; dat gaat mee als parameter.
 *
 * Per plek eerst de lokale naam met "Hà Nội", dan het lokale adres, dan de
 * Nederlandse naam met "Hanoi". Alleen een resultaat binnen Hanoi telt, en een
 * onderdeel (onderdeelVan) mag niet verder dan een kilometer van zijn hoofdplek
 * liggen. Wat niets bruikbaars oplevert, krijgt geen pin en staat in de app
 * onder "Locatie ontbreekt".
 *
 * De coördinaten komen als regels in het bestand onder `categorie:`, met
 * `coordBron: nominatim`. Het bestand wordt verder niet aangeraakt, zodat
 * commentaar en opmaak blijven staan.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { afstandKm } from '../src/domein/geo/afstand';
import { plaatsenBestandSchema, type Plaats } from '../src/domein/schema/plaats';

const args = process.argv.slice(2);
const droog = args.includes('--droog');
const opnieuw = args.includes('--opnieuw');
const stad = args.includes('--stad') ? args[args.indexOf('--stad') + 1] : 'hanoi';
const bestand = join('data', 'plaatsen', `${stad}.yaml`);

/** Het gebied waarbinnen een resultaat mag liggen. Voor nu alleen Hanoi. */
const GEBIED: Record<string, { zuid: number; noord: number; west: number; oost: number }> = {
  hanoi: { zuid: 20.9, noord: 21.15, west: 105.7, oost: 105.95 },
};

const USER_AGENT = 'Japanreis/1.0 (offline reisgids; https://github.com/SjoerdHutter/Japanreis)';
const WACHT_MS = 1100;

/**
 * Plekken waarvoor de standaardvolgorde misgaat:
 * - Het Opera House en het Nationaal Museum voor Geschiedenis hebben allebei
 *   1 Trang Tien als adres. Alleen op naam zoeken, anders liggen de pins op
 *   elkaar.
 * - De oude wijk en de weekend nachtmarkt krijgen Hang Dao als punt.
 * - De Tran Quoc pagode is de pagode zelf, niet het midden van het Westmeer;
 *   dat gaat goed zolang er op de naam van de pagode gezocht wordt.
 */
const ALLEEN_OP_NAAM = new Set(['opera', 'nationaal-museum-geschiedenis']);
const VASTE_ZOEKTERM: Record<string, string[]> = {
  'oude-wijk': ['Hàng Đào, Hoàn Kiếm, Hà Nội'],
  'weekend-nachtmarkt': ['Hàng Đào, Hoàn Kiếm, Hà Nội'],
  'tran-quoc-pagode': ['Chùa Trấn Quốc, Hà Nội'],
};

const zoektermen = (plaats: Plaats): string[] => {
  if (VASTE_ZOEKTERM[plaats.id]) return VASTE_ZOEKTERM[plaats.id];
  const termen = [
    plaats.naamLokaal && `${plaats.naamLokaal}, Hà Nội`,
    !ALLEEN_OP_NAAM.has(plaats.id) && plaats.adresLokaal,
    `${plaats.naam}, Hanoi`,
  ];
  return termen.filter((t): t is string => typeof t === 'string' && t.length > 0);
};

interface Resultaat {
  lat: string;
  lon: string;
  display_name: string;
}

const slaap = (ms: number) => new Promise((klaar) => setTimeout(klaar, ms));

let laatsteVerzoek = 0;

const zoek = async (term: string): Promise<Resultaat[]> => {
  const wacht = laatsteVerzoek + WACHT_MS - Date.now();
  if (wacht > 0) await slaap(wacht);
  laatsteVerzoek = Date.now();

  const gebied = GEBIED[stad];
  const params = new URLSearchParams({
    q: term,
    format: 'jsonv2',
    limit: '5',
    countrycodes: 'vn',
    'accept-language': 'vi',
  });
  if (gebied) {
    params.set('viewbox', `${gebied.west},${gebied.noord},${gebied.oost},${gebied.zuid}`);
    params.set('bounded', '1');
  }
  if (process.env.NOMINATIM_EMAIL) params.set('email', process.env.NOMINATIM_EMAIL);

  const antwoord = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!antwoord.ok) throw new Error(`Nominatim gaf ${antwoord.status} voor "${term}"`);
  return (await antwoord.json()) as Resultaat[];
};

const binnen = (lat: number, lon: number): boolean => {
  const g = GEBIED[stad];
  return !g || (lat >= g.zuid && lat <= g.noord && lon >= g.west && lon <= g.oost);
};

const rond = (getal: number) => Math.round(getal * 1e5) / 1e5;

const main = async () => {
  const tekst = readFileSync(bestand, 'utf8');
  const plaatsen = plaatsenBestandSchema.parse(parse(tekst));
  const opId = new Map(plaatsen.map((p) => [p.id, p]));

  const teDoen = plaatsen.filter((p) => !p.coordinaten || (opnieuw && p.coordBron === 'nominatim'));
  // Hoofdplekken eerst, zodat een onderdeel tegen zijn hoofdplek getoetst kan worden.
  teDoen.sort((a, b) => Number(Boolean(a.onderdeelVan)) - Number(Boolean(b.onderdeelVan)));

  if (teDoen.length === 0) {
    console.log(`Alle plekken in ${bestand} hebben coördinaten.`);
    return;
  }
  console.log(`${teDoen.length} plekken zoeken in ${bestand}, één per seconde.\n`);

  const gevonden = new Map<string, { lat: number; lon: number; via: string; naam: string }>();
  const ontbreekt: { id: string; waarom: string }[] = [];

  for (const plaats of teDoen) {
    const hoofd = plaats.onderdeelVan ? opId.get(plaats.onderdeelVan) : undefined;
    const hoofdPlek = hoofd ? (gevonden.get(hoofd.id) ?? hoofd.coordinaten) : undefined;
    let waarom = 'geen resultaat binnen Hanoi';

    for (const term of zoektermen(plaats)) {
      const resultaten = await zoek(term);
      const bruikbaar = resultaten.find((r) => {
        const lat = Number(r.lat);
        const lon = Number(r.lon);
        if (!binnen(lat, lon)) return false;
        if (plaats.onderdeelVan) {
          if (!hoofdPlek) {
            waarom = 'de hoofdplek heeft zelf nog geen coördinaten';
            return false;
          }
          if (afstandKm(hoofdPlek, { lat, lon }) > 1) {
            waarom = 'verder dan een kilometer van de hoofdplek';
            return false;
          }
        }
        return true;
      });
      if (bruikbaar) {
        gevonden.set(plaats.id, {
          lat: rond(Number(bruikbaar.lat)),
          lon: rond(Number(bruikbaar.lon)),
          via: term,
          naam: bruikbaar.display_name,
        });
        break;
      }
    }

    const uitkomst = gevonden.get(plaats.id);
    if (uitkomst) {
      console.log(`✓ ${plaats.id}: ${uitkomst.lat}, ${uitkomst.lon}`);
      console.log(`    via "${uitkomst.via}"\n    ${uitkomst.naam}`);
    } else {
      ontbreekt.push({ id: plaats.id, waarom });
      console.log(`✗ ${plaats.id}: ${waarom}`);
    }
  }

  // Twee pins die bijna op elkaar liggen zijn verdacht: dan vond Nominatim
  // waarschijnlijk het gebouw ernaast of het adres in plaats van de plek.
  const lijst = [...gevonden.entries()];
  for (const [i, [id, a]] of lijst.entries()) {
    for (const [ander, b] of lijst.slice(i + 1)) {
      if (afstandKm(a, b) < 0.025) {
        console.log(`\nLet op: ${id} en ${ander} liggen minder dan 25 meter uit elkaar.`);
      }
    }
  }

  if (ontbreekt.length > 0) {
    console.log('\nLocatie ontbreekt (zet ze in de app op de kaart, of vul ze hier zelf in):');
    for (const o of ontbreekt) console.log(`  ${o.id}: ${o.waarom}`);
  }

  if (droog) {
    console.log('\nDroog gedraaid: er is niets geschreven.');
    return;
  }

  // Schrijven als regels onder `categorie:` van elke plek, zonder de rest van
  // het bestand opnieuw op te maken.
  const regels = tekst.split('\n');
  let huidig: string | null = null;
  const uit: string[] = [];
  for (const regel of regels) {
    const begin = /^- id: (\S+)/.exec(regel);
    if (begin) huidig = begin[1];
    const isOud =
      huidig !== null &&
      gevonden.has(huidig) &&
      (/^ {2}coordinaten:/.test(regel) || /^ {2}coordBron:/.test(regel));
    if (isOud) continue;
    uit.push(regel);
    if (huidig && gevonden.has(huidig) && /^ {2}categorie:/.test(regel)) {
      const { lat, lon } = gevonden.get(huidig)!;
      uit.push(`  coordinaten: { lat: ${lat}, lon: ${lon} }`, '  coordBron: nominatim');
    }
  }
  const nieuw = uit.join('\n');

  // Controle: het bestand moet nog door het schema, met de nieuwe pins erin.
  const nagelezen = plaatsenBestandSchema.parse(parse(nieuw));
  for (const [id, { lat, lon }] of gevonden) {
    const p = nagelezen.find((x) => x.id === id);
    if (p?.coordinaten?.lat !== lat || p.coordinaten.lon !== lon) {
      throw new Error(`Schrijven ging mis bij ${id}; het bestand is niet aangepast.`);
    }
  }
  writeFileSync(bestand, nieuw);
  console.log(
    `\n${gevonden.size} plekken bijgewerkt in ${bestand}. Draai daarna npm run validate.`,
  );
};

main().catch((fout: unknown) => {
  console.error(fout instanceof Error ? fout.message : fout);
  process.exitCode = 1;
});
