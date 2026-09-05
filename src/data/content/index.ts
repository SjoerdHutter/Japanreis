import stedenRuw from '../../../data/steden.yaml';
import tijdlijnenRuw from '../../../data/tijdlijnen.yaml';
import reisschemaRuw from '../../../data/reisschema.yaml';
import appsRuw from '../../../data/apps.yaml';
import vervoerRuw from '../../../data/vervoer.yaml';
import etiquetteRuw from '../../../data/etiquette.yaml';
import zinnenRuw from '../../../data/zinnen.yaml';
import seizoenRuw from '../../../data/seizoen.yaml';
import {
  appsBestandSchema,
  vervoerBestandSchema,
  etiquetteBestandSchema,
  zinnenBestandSchema,
  seizoenBestandSchema,
  plaatsenBestandSchema,
  reisschemaSchema,
  stedenBestandSchema,
  tijdlijnenBestandSchema,
  type Plaats,
  type Reisschema,
  type Stad,
  type Tijdlijn,
  type App,
  type VervoerContent,
  type Etiquette,
  type Zin,
  type SeizoenContent,
} from '@/domein/schema';

/**
 * De redactionele content: steden, tijdlijnen, reisschema en plaatsen.
 *
 * De YAML wordt tijdens de build naar JSON omgezet en in de app gebakken. Dat
 * is met opzet: het uitgangspunt is dat elke stad, ook Hanoi, volledig te
 * openen is zonder internet en vanaf elke locatie. Zou de content bij het
 * openen van een stad opgehaald worden, dan is dat precies het moment waarop je
 * in een trein zonder bereik zit. Wat wél per stad wordt opgehaald zijn de
 * kaarttegels, want die zijn groot; zie kaart/offline.ts.
 *
 * De schema's draaien hier nog een keer, ook al heeft CI dat al gedaan. Dat
 * kost bij het opstarten een paar milliseconden en het vangt het geval af waarin
 * een oude, gecachete versie van de app nieuwe data voorgeschoteld krijgt.
 */

const parseer = <T>(schema: { parse: (waarde: unknown) => T }, ruw: unknown, wat: string): T => {
  try {
    return schema.parse(ruw);
  } catch (fout) {
    // Dit is een programmeerfout of een kapot databestand, geen gebruikersfout.
    console.error(`Content "${wat}" klopt niet:`, fout);
    throw fout;
  }
};

export const STEDEN: Stad[] = parseer(stedenBestandSchema, stedenRuw, 'steden').sort(
  (a, b) => a.volgorde - b.volgorde,
);

export const TIJDLIJNEN: Tijdlijn[] = parseer(tijdlijnenBestandSchema, tijdlijnenRuw, 'tijdlijnen');

export const REISSCHEMA: Reisschema = parseer(reisschemaSchema, reisschemaRuw, 'reisschema');

export const APPS: App[] = parseer(appsBestandSchema, appsRuw, 'apps');

export const VERVOER: VervoerContent = parseer(vervoerBestandSchema, vervoerRuw, 'vervoer');

export const ETIQUETTE: Etiquette[] = parseer(etiquetteBestandSchema, etiquetteRuw, 'etiquette');

export const ZINNEN: Zin[] = parseer(zinnenBestandSchema, zinnenRuw, 'zinnen');

export const SEIZOEN: SeizoenContent = parseer(seizoenBestandSchema, seizoenRuw, 'seizoen');

export const stadMet = (id: string): Stad | undefined => STEDEN.find((s) => s.id === id);

export const tijdlijnVan = (stad: Stad): Tijdlijn | undefined =>
  TIJDLIJNEN.find((t) => t.id === stad.tijdlijn);

/**
 * De plaatsen per stad, als aparte brokken.
 *
 * `import.meta.glob` maakt van elk bestand een eigen chunk die pas geladen
 * wordt als je die stad opent. De service worker heeft ze bij de installatie al
 * binnengehaald, dus offline werkt dit gewoon; het scheelt alleen geheugen bij
 * het opstarten.
 */
const plaatsBestanden = import.meta.glob<{ default: unknown }>('../../../data/plaatsen/*.yaml');

const geladen = new Map<string, Plaats[]>();

export const laadPlaatsen = async (stadId: string): Promise<Plaats[]> => {
  const bestaand = geladen.get(stadId);
  if (bestaand) return bestaand;

  const sleutel = Object.keys(plaatsBestanden).find((pad) => pad.endsWith(`/${stadId}.yaml`));
  if (!sleutel) {
    // Een stad zonder puntenbestand is geen fout: die is nog niet gevuld.
    geladen.set(stadId, []);
    return [];
  }

  const module = await plaatsBestanden[sleutel]();
  const plaatsen = parseer(plaatsenBestandSchema, module.default, `plaatsen/${stadId}`);
  geladen.set(stadId, plaatsen);
  return plaatsen;
};

/** Alle plaatsen van alle steden, voor de kaart over de hele reis heen. */
export const laadAllePlaatsen = async (): Promise<Plaats[]> => {
  const perStad = await Promise.all(STEDEN.map((s) => laadPlaatsen(s.id)));
  return perStad.flat();
};
