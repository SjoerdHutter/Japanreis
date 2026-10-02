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
import { tipsBestandSchema } from '../src/domein/schema/tips';
import { stationsBestandSchema } from '../src/domein/schema/station';
import { reisdagenBestandSchema } from '../src/domein/schema/reisdag';
import { allergenenBestandSchema, noodBestandSchema } from '../src/domein/schema/nood';
import { laatsteTreinenBestandSchema } from '../src/domein/schema/trein';
import { kaartlagenBestandSchema } from '../src/domein/schema/kaartlaag';
import { menuBestandSchema } from '../src/domein/schema/menu';
import { sumoSchema } from '../src/domein/schema/sumo';
import { existsSync } from 'node:fs';
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
const tips = controleer(tipsBestandSchema, lees(join(DATA, 'tips.yaml')), 'tips.yaml');
const stations = controleer(
  stationsBestandSchema,
  lees(join(DATA, 'stations.yaml')),
  'stations.yaml',
);
const reisdagen = controleer(
  reisdagenBestandSchema,
  lees(join(DATA, 'reisdagen.yaml')),
  'reisdagen.yaml',
);

if (zinnen && new Set(zinnen.map((z) => z.id)).size !== zinnen.length) {
  fouten.push('zinnen.yaml: dubbele zin-id');
}

const nood = controleer(noodBestandSchema, lees(join(DATA, 'nood.yaml')), 'nood.yaml');
controleer(allergenenBestandSchema, lees(join(DATA, 'allergenen.yaml')), 'allergenen.yaml');

// De toonkaarten in het noodscherm verwijzen naar zinnen; een tikfout daarin
// betekent een lege kaart op het moment dat je hem nodig hebt.
if (nood && zinnen) {
  const zinIds = new Set(zinnen.map((z) => z.id));
  for (const land of nood.landen) {
    for (const id of land.toonkaarten) {
      if (!zinIds.has(id))
        fouten.push(`nood.yaml: ${land.land} verwijst naar onbekende zin "${id}"`);
    }
  }
  for (const id of ['allergie-lijst-ja', 'allergie-lijst-vn']) {
    if (!zinIds.has(id)) fouten.push(`zinnen.yaml: de zin "${id}" voor de allergiekaart ontbreekt`);
  }
  const noodIds = [
    ...nood.landen.flatMap((l) => [...l.nummers.map((n) => n.id), l.ambassade.id]),
    ...nood.algemeen.map((n) => n.id),
    ...nood.rampen.map((r) => r.id),
  ];
  if (new Set(noodIds).size !== noodIds.length) fouten.push('nood.yaml: dubbele id');
}
if (etiquette && new Set(etiquette.map((e) => e.id)).size !== etiquette.length) {
  fouten.push('etiquette.yaml: dubbele etiquette-id');
}

if (apps && new Set(apps.map((a) => a.id)).size !== apps.length) {
  fouten.push('apps.yaml: dubbele app-id');
}

// De sumogids. Twee secties met dezelfde id zouden de knoppen bovenaan de
// pagina allebei naar de eerste laten springen.
const sumo = controleer(sumoSchema, lees(join(DATA, 'sumo.yaml')), 'sumo.yaml');
if (sumo && new Set(sumo.secties.map((s) => s.id)).size !== sumo.secties.length) {
  fouten.push('sumo.yaml: dubbele sectie-id');
}

const laatsteTreinen = controleer(
  laatsteTreinenBestandSchema,
  lees(join(DATA, 'laatste-treinen.yaml')),
  'laatste-treinen.yaml',
);
if (laatsteTreinen && steden) {
  const stadIds = new Set(steden.map((s) => s.id));
  if (new Set(laatsteTreinen.map((t) => t.id)).size !== laatsteTreinen.length) {
    fouten.push('laatste-treinen.yaml: dubbele id');
  }
  for (const trein of laatsteTreinen) {
    for (const stad of [trein.stad, trein.naarStad]) {
      if (!stadIds.has(stad))
        fouten.push(`laatste-treinen.yaml: ${trein.id} kent stad "${stad}" niet`);
    }
  }
}

const menu = controleer(menuBestandSchema, lees(join(DATA, 'menu.yaml')), 'menu.yaml');
if (menu) {
  const gezien = new Set<string>();
  for (const item of menu) {
    if (gezien.has(item.id)) fouten.push(`menu.yaml: dubbele id ${item.id}`);
    gezien.add(item.id);
  }
}

// De kaartlagen uit scripts/kaartlagen.ts: geldig, van een bekende stad, en
// klein genoeg om met de app mee te reizen.
const kaartlagenMap = join(DATA, 'kaartlagen');
if (existsSync(kaartlagenMap) && steden) {
  for (const bestand of readdirSync(kaartlagenMap).filter((b) => extname(b) === '.json')) {
    const pad = join(kaartlagenMap, bestand);
    const ruw = readFileSync(pad, 'utf8');
    const lagen = controleer(kaartlagenBestandSchema, JSON.parse(ruw), `kaartlagen/${bestand}`);
    if (lagen && !steden.some((s) => s.id === basename(bestand, '.json'))) {
      fouten.push(`kaartlagen/${bestand}: er is geen stad met die naam`);
    }
    if (Buffer.byteLength(ruw) > 300 * 1024) {
      fouten.push(`kaartlagen/${bestand}: groter dan 300 kB`);
    }
  }
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
      if (plaats.categorie === 'spa' && !plaats.spa) {
        fouten.push(`${waar}: categorie spa zonder blok "spa"`);
      }
      if (!plaats.coordinaten) {
        opmerkingen.push(`${waar}: heeft nog geen coördinaten en staat onder "Locatie ontbreekt"`);
      } else if (!binnenGebied(plaats.coordinaten, stad.kaartgebied)) {
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

  // Een tip die naar een stad verwijst die niet bestaat verdwijnt stilletjes uit
  // het filter, en dat merk je pas als je hem mist.
  if (tips) {
    for (const groep of tips.groepen) {
      for (const tip of groep.tips) {
        if (tip.stad !== undefined && !stadIds.has(tip.stad)) {
          fouten.push(`tips.yaml: groep ${groep.id} verwijst naar onbekende stad "${tip.stad}"`);
        }
      }
    }
  }

  // Een station hoort bij een bestaande stad, anders staat hij bij geen enkele
  // stad in de lijst. Een uitgang buiten het kaartgebied is geen fout, maar
  // dan is er daar offline geen kaart.
  const stationIds = new Set(stations?.map((s) => s.id) ?? []);
  if (stations) {
    if (stationIds.size !== stations.length) fouten.push('stations.yaml: dubbele station-id');
    for (const station of stations) {
      const stad = steden.find((s) => s.id === station.stad);
      if (!stad) {
        fouten.push(`stations.yaml: ${station.id} verwijst naar onbekende stad "${station.stad}"`);
        continue;
      }
      const punten = [
        station.coordinaten,
        ...station.uitgangen.flatMap((u) => u.coordinaten ?? []),
      ];
      if (punten.some((c) => !binnenGebied(c, stad.kaartgebied))) {
        opmerkingen.push(
          `stations.yaml: ${station.id} ligt buiten het kaartgebied van ${stad.id}, dus offline zie je hier geen kaart`,
        );
      }
    }
  }

  // Een reisdag die naar een onbekende stad of stationsgids wijst, laat een
  // knop achter die nergens heen gaat.
  if (reisdagen) {
    if (new Set(reisdagen.map((r) => r.id)).size !== reisdagen.length) {
      fouten.push('reisdagen.yaml: dubbele reisdag-id');
    }
    for (const dag of reisdagen) {
      for (const stadId of [dag.van, dag.naar]) {
        if (stadId !== undefined && !stadIds.has(stadId)) {
          fouten.push(`reisdagen.yaml: ${dag.id} verwijst naar onbekende stad "${stadId}"`);
        }
      }
      for (const stap of dag.stappen) {
        for (const stationId of [stap.vanStation, stap.naarStation]) {
          if (stationId !== undefined && !stationIds.has(stationId)) {
            fouten.push(`reisdagen.yaml: ${dag.id} verwijst naar onbekend station "${stationId}"`);
          }
        }
      }
    }
  }

  const aantalTips = tips?.groepen.reduce((n, g) => n + g.tips.length, 0) ?? 0;
  console.log(
    `Gecontroleerd: ${steden.length} steden, ${plaatsIds.size} plaatsen, ${apps?.length ?? 0} apps, ${vervoer?.trajecten.length ?? 0} trajecten, ${etiquette?.length ?? 0} etiquettekaarten, ${zinnen?.length ?? 0} zinnen, ${aantalTips} tips, ${stations?.length ?? 0} stations, ${reisdagen?.length ?? 0} reisdagen, ${menu?.length ?? 0} gerechten.`,
  );
}

for (const regel of opmerkingen) console.log(`  let op: ${regel}`);

if (fouten.length > 0) {
  console.error(`\n${fouten.length} fout(en):`);
  for (const regel of fouten) console.error(`  ${regel}`);
  process.exit(1);
}

console.log('Alles klopt.');
