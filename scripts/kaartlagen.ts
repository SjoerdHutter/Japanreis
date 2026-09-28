/**
 * Haalt de praktische kaartlagen op uit OpenStreetMap: geldautomaten die een
 * buitenlandse pas nemen, kluisjes en toiletten. Eén klein JSON-bestand per
 * stad in data/kaartlagen/, dat met de app meereist en offline werkt.
 *
 * Draai dit met de hand, niet in de browser en niet in CI:
 *
 *   npm run kaartlagen            alle steden
 *   npm run kaartlagen kyoto nara alleen deze
 *
 * Het vraagt per stad één keer de Overpass API, over het kaartgebied uit
 * steden.yaml, met een pauze ertussen; de Overpass API is gratis en gedeeld.
 * Een andere server kan met OVERPASS_URL. Commit de bestanden daarna; ze
 * komen in de offline voorraad van de service worker.
 *
 * De gegevens zijn van OpenStreetMap-bijdragers, onder de ODbL.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { stedenBestandSchema } from '../src/domein/schema/stad';
import { kaartlagenBestandSchema } from '../src/domein/schema/kaartlaag';
import {
  MAX_BYTES,
  overpassVraag,
  pasInGrens,
  verwerk,
  type OsmElement,
} from '../src/domein/kaartlagen/verwerk';

const SERVER = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
const PAUZE_MS = 5000;
const MAP = join('data', 'kaartlagen');

const steden = stedenBestandSchema.parse(parse(readFileSync(join('data', 'steden.yaml'), 'utf8')));
const gevraagd = process.argv.slice(2);
const teDoen = gevraagd.length > 0 ? steden.filter((s) => gevraagd.includes(s.id)) : steden;
const onbekend = gevraagd.filter((id) => !steden.some((s) => s.id === id));
if (onbekend.length > 0) {
  console.error(`Onbekende stad: ${onbekend.join(', ')}`);
  process.exit(1);
}

mkdirSync(MAP, { recursive: true });
const wacht = (ms: number) => new Promise((klaar) => setTimeout(klaar, ms));
let mislukt = 0;

for (const [i, stad] of teDoen.entries()) {
  if (i > 0) await wacht(PAUZE_MS);
  const { zuidwest, noordoost } = stad.kaartgebied;
  const vraag = overpassVraag(
    { zuid: zuidwest.lat, west: zuidwest.lon, noord: noordoost.lat, oost: noordoost.lon },
    stad.land,
  );
  process.stdout.write(`${stad.naam}: `);
  try {
    const antwoord = await fetch(SERVER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Japanreis-kaartlagen/1.0 (reisapp, eenmalig per stad)',
      },
      body: new URLSearchParams({ data: vraag }).toString(),
    });
    if (!antwoord.ok) throw new Error(`Overpass gaf ${antwoord.status}`);
    const { elements } = (await antwoord.json()) as { elements: OsmElement[] };
    const lagen = kaartlagenBestandSchema.parse({
      stad: stad.id,
      bron: '© OpenStreetMap-bijdragers, ODbL',
      opgehaaldOp: new Date().toISOString(),
      ...verwerk(elements, stad.land),
    });
    const passend = pasInGrens(lagen);
    if (!passend) {
      throw new Error(
        `past niet onder ${MAX_BYTES / 1024} kB, ook niet ingekort; maak het kaartgebied kleiner`,
      );
    }
    const json = JSON.stringify(passend);
    writeFileSync(join(MAP, `${stad.id}.json`), json);
    console.log(
      `${passend.geld.length} geld, ${passend.kluisjes.length} kluisjes, ${passend.toiletten.length} toiletten, ${Math.round(json.length / 1024)} kB${passend === lagen ? '' : ' (ingekort)'}`,
    );
  } catch (fout) {
    mislukt++;
    console.log(`mislukt: ${fout instanceof Error ? fout.message : String(fout)}`);
  }
}

if (mislukt > 0) process.exit(1);
