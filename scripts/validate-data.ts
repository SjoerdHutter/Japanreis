/**
 * Controleert elk contentbestand tegen het schema en tegen elkaar.
 *
 * Dit draait in CI omdat de content met de hand wordt bijgewerkt, soms
 * rechtstreeks op github.com vanaf een telefoon. Zonder deze controle komt een
 * verkeerd ingesprongen regel of een tikfout in een stadsnaam er pas uit als je
 * onderweg een lege stad opent, en dat is precies het moment waarop je er niets
 * meer aan kunt doen.
 *
 * Fouten laten het script falen. Zaken die alleen slordig zijn (een punt dat
 * buiten het kaartgebied van zijn stad valt) worden gemeld maar breken niets.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { stedenBestandSchema } from '../src/domein/schema/stad';
import { tijdlijnenBestandSchema } from '../src/domein/schema/tijdlijn';
import { reisschemaSchema } from '../src/domein/schema/reis';
import { plaatsenBestandSchema } from '../src/domein/schema/plaats';
import { appsBestandSchema, vervoerBestandSchema } from '../src/domein/schema/praktisch';
import {
  etiquetteBestandSchema,
  seizoenBestandSchema,
  zinnenBestandSchema,
} from '../src/domein/schema/context';
import { binnenGebied } from '../src/domein/geo/afstand';

const DATA = 'data';

const fouten: string[] = [];
const opmerkingen: string[] = [];

const lees = (pad: string): unknown => parse(readFileSync(pad, 'utf8'));

/** Parseert met een schema en zet elke schendig om in een leesbare regel. */
const controleer = <T>(schema: z.ZodType<T>, waarde: unknown, bestand: string): T | null => {
  const uitkomst = schema.safeParse(waarde);
  if (uitkomst.success) return uitkomst.data;
  for (const probleem of uitkomst.error.issues) {
    const pad = probleem.path.join('.') || '(hoofdniveau)';
    fouten.push(`${bestand}: ${pad}: ${probleem.message}`);
  }
  return null;
};

const steden = controleer(stedenBestandSchema, lees(join(DATA, 'steden.yaml')), 'steden.yaml');
const tijdlijnen = controleer(
  tijdlijnenBestandSchema,
  lees(join(DATA, 'tijdlijnen.yaml')),
  'tijdlijnen.yaml',
);
const reisschema = controleer(
  reisschemaSchema,
  lees(join(DATA, 'reisschema.yaml')),
  'reisschema.yaml',
);

const apps = controleer(appsBestandSchema, lees(join(DATA, 'apps.yaml')), 'apps.yaml');
const vervoer = controleer(vervoerBestandSchema, lees(join(DATA, 'vervoer.yaml')), 'vervoer.yaml');
const etiquette = controleer(
  etiquetteBestandSchema,
  lees(join(DATA, 'etiquette.yaml')),
  'etiquette.yaml',
);
const zinnen = controleer(zinnenBestandSchema, lees(join(DATA, 'zinnen.yaml')), 'zinnen.yaml');
const seizoen = controleer(seizoenBestandSchema, lees(join(DATA, 'seizoen.yaml')), 'seizoen.yaml');

if (zinnen && new Set(zinnen.map((z) => z.id)).size !== zinnen.length) {
  fouten.push('zinnen.yaml: dubbele zin-id');
}
if (etiquette && new Set(etiquette.map((e) => e.id)).size !== etiquette.length) {
  fouten.push('etiquette.yaml: dubbele etiquette-id');
}

if (apps && new Set(apps.map((a) => a.id)).size !== apps.length) {
  fouten.push('apps.yaml: dubbele app-id');
}

if (steden && tijdlijnen && reisschema) {
  const stadIds = new Set(steden.map((s) => s.id));
  if (stadIds.size !== steden.length) fouten.push('steden.yaml: dubbele stad-id');

  const tijdvakkenPerTijdlijn = new Map(
    tijdlijnen.map((t) => [t.id, new Set(t.tijdvakken.map((v) => v.id))]),
  );

  for (const stad of steden) {
    const tijdvakken = tijdvakkenPerTijdlijn.get(stad.tijdlijn);
    if (!tijdvakken) {
      fouten.push(`steden.yaml: ${stad.id} verwijst naar onbekende tijdlijn "${stad.tijdlijn}"`);
      continue;
    }
    for (const v of stad.tijdvakken) {
      if (!tijdvakken.has(v)) {
        fouten.push(
          `steden.yaml: ${stad.id} kent tijdvak "${v}" niet in tijdlijn ${stad.tijdlijn}`,
        );
      }
    }
  }

  for (const [i, segment] of reisschema.segmenten.entries()) {
    if (!stadIds.has(segment.stad)) {
      fouten.push(
        `reisschema.yaml: segment ${i + 1} verwijst naar onbekende stad "${segment.stad}"`,
      );
    }
  }

  // De plaatsen, één bestand per stad. De bestandsnaam is leidend: zo kan een
  // punt nooit stilletjes in de verkeerde stad belanden.
  const plaatsIds = new Set<string>();
  const map = join(DATA, 'plaatsen');
  const bestanden = readdirSync(map).filter((b) => extname(b) === '.yaml');

  for (const stadId of stadIds) {
    if (!bestanden.includes(`${stadId}.yaml`)) {
      opmerkingen.push(`plaatsen/${stadId}.yaml ontbreekt: die stad heeft nog geen punten`);
    }
  }

  for (const bestand of bestanden) {
    const stadId = basename(bestand, '.yaml');
    if (!stadIds.has(stadId)) {
      fouten.push(`plaatsen/${bestand}: er is geen stad met id "${stadId}"`);
      continue;
    }
    const stad = steden.find((s) => s.id === stadId)!;
    const tijdvakken = tijdvakkenPerTijdlijn.get(stad.tijdlijn) ?? new Set<string>();

    const plaatsen = controleer(
      plaatsenBestandSchema,
      lees(join(map, bestand)),
      `plaatsen/${bestand}`,
    );
    if (!plaatsen) continue;

    for (const plaats of plaatsen) {
      const waar = `plaatsen/${bestand}: ${plaats.id}`;
      if (plaatsIds.has(plaats.id)) fouten.push(`${waar}: dit id bestaat al`);
      plaatsIds.add(plaats.id);

      if (plaats.stad !== stadId) {
        fouten.push(`${waar}: staat in het bestand van ${stadId} maar zegt stad "${plaats.stad}"`);
      }
      for (const v of plaats.tijdvakken ?? []) {
        if (!tijdvakken.has(v)) {
          fouten.push(`${waar}: tijdvak "${v}" komt niet voor in tijdlijn ${stad.tijdlijn}`);
        }
      }
      if (plaats.categorie === 'eten' && !plaats.eten) {
        fouten.push(`${waar}: categorie eten zonder blok "eten" met een keuken`);
      }
      if (plaats.categorie === 'attractie' && !plaats.attractie) {
        fouten.push(`${waar}: categorie attractie zonder blok "attractie" met een type`);
      }
      if (!binnenGebied(plaats.coordinaten, stad.kaartgebied)) {
        opmerkingen.push(
          `${waar}: ligt buiten het kaartgebied van ${stadId}, dus offline zie je hier geen kaart`,
        );
      }
    }
  }

  // De trajecten in vervoer.yaml moeten naar bestaande steden verwijzen,
  // anders staat er straks een rekentool met een route die nergens heen gaat.
  if (vervoer) {
    for (const traject of vervoer.trajecten) {
      for (const kant of [traject.van, traject.naar]) {
        if (!stadIds.has(kant)) {
          fouten.push(`vervoer.yaml: traject verwijst naar onbekende stad "${kant}"`);
        }
      }
    }
  }

  // Elke stad hoort in een seizoensregio te vallen, anders staat er bij die
  // stad geen woord over bloesem, herfstblad of tyfoonseizoen.
  if (seizoen) {
    const inRegio = new Set(seizoen.regios.flatMap((r) => r.steden));
    for (const stad of steden) {
      if (!inRegio.has(stad.id)) {
        opmerkingen.push(`seizoen.yaml: ${stad.id} valt in geen enkele regio`);
      }
    }
    for (const regio of seizoen.regios) {
      for (const stadId of regio.steden) {
        if (!stadIds.has(stadId)) {
          fouten.push(`seizoen.yaml: regio ${regio.id} noemt onbekende stad "${stadId}"`);
        }
      }
    }
  }

  console.log(
    `Gecontroleerd: ${steden.length} steden, ${plaatsIds.size} plaatsen, ${apps?.length ?? 0} apps, ${vervoer?.trajecten.length ?? 0} trajecten, ${etiquette?.length ?? 0} etiquettekaarten, ${zinnen?.length ?? 0} zinnen.`,
  );
}

for (const regel of opmerkingen) console.log(`  let op: ${regel}`);

if (fouten.length > 0) {
  console.error(`\n${fouten.length} fout(en):`);
  for (const regel of fouten) console.error(`  ${regel}`);
  process.exit(1);
}

console.log('Alles klopt.');
