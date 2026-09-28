import type { Accommodatie, Coordinaat, LaatsteTrein } from '@/domein/schema';
import { afstandKm } from '@/domein/geo/afstand';

/**
 * Haal je de laatste trein nog?
 *
 * Een avond in Gion of op Dotonbori loopt zomaar uit, en de laatste metro gaat
 * in Japan vroeger dan je denkt. De planner kijkt naar de laatste stop van je
 * dag, het verblijf van die nacht en het terugstation dat je in Mijn gegevens
 * hebt gezet, en zoekt het knooppunt dat het dichtst bij die stop ligt.
 *
 * Eindigt de laatste stop later dan een half uur voor die trein, dan komt er
 * een waarschuwing. Ligt je verblijf op loopafstand, dan is er geen trein nodig
 * en zegt de planner niets.
 */

/** Tot hier loop je naar je verblijf in plaats van de trein te nemen. */
export const LOOPAFSTAND_KM = 1.5;
/** Zoveel minuten wil je voor de laatste trein op het perron staan. */
export const MARGE_MINUTEN = 30;

/** Vergelijkbaar maken: "Kyoto Station", "kyoto", "京都駅" en "Kyoto-eki" worden hetzelfde. */
export const stationSleutel = (naam: string): string =>
  naam
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/駅/g, '')
    .replace(/\b(station|eki|stn)\b/g, '')
    .replace(/[^a-z0-9぀-鿿]/g, '');

/** "00:30" is een half uur na middernacht, dus 24:30 voor wie op een avond rekent. */
export const alsAvondMinuten = (tijd: string): number => {
  const [uur, minuut] = tijd.split(':').map(Number);
  const minuten = uur * 60 + minuut;
  return uur < 4 ? minuten + 24 * 60 : minuten;
};

export type LaatsteTreinUitkomst =
  | { soort: 'loopafstand'; km: number }
  | {
      soort: 'bekend';
      van: string;
      naar: string;
      lijn?: string;
      opmerking?: string;
      laatsteVertrek: string;
      /** De regel uit de content, of null voor een tijd die je zelf bij je verblijf zette. */
      trein: LaatsteTrein | null;
      /** Of de laatste stop te laat eindigt. */
      knelt: boolean;
    }
  | { soort: 'onbekend'; reden: 'geen-verblijf' | 'geen-terugstation' | 'geen-gegevens' };

export interface LaatsteTreinInvoer {
  /** De stad waar je die dag plant. */
  stadId: string;
  laatsteStop: { coordinaten: Coordinaat; vertrek: number };
  verblijf?: Accommodatie;
  /** De content, met je eigen tijden er al overheen gelegd. */
  treinen: LaatsteTrein[];
  /** Een tijd die je bij dit verblijf zelf hebt ingevuld. */
  eigenTijd?: string;
}

export const laatsteTreinVoor = (invoer: LaatsteTreinInvoer): LaatsteTreinUitkomst => {
  const { stadId, laatsteStop, verblijf, treinen, eigenTijd } = invoer;
  if (!verblijf) return { soort: 'onbekend', reden: 'geen-verblijf' };

  if (verblijf.coordinaten) {
    const km = afstandKm(laatsteStop.coordinaten, verblijf.coordinaten);
    if (km <= LOOPAFSTAND_KM) return { soort: 'loopafstand', km };
  }

  const knelt = (tijd: string) => laatsteStop.vertrek > alsAvondMinuten(tijd) - MARGE_MINUTEN;

  if (eigenTijd) {
    return {
      soort: 'bekend',
      van: 'je laatste stop',
      naar: verblijf.terugstation ?? verblijf.naam,
      laatsteVertrek: eigenTijd,
      trein: null,
      knelt: knelt(eigenTijd),
    };
  }

  if (!verblijf.terugstation) return { soort: 'onbekend', reden: 'geen-terugstation' };
  const doel = stationSleutel(verblijf.terugstation);
  const kandidaten = treinen.filter((t) => t.stad === stadId && stationSleutel(t.naar) === doel);
  if (kandidaten.length === 0) return { soort: 'onbekend', reden: 'geen-gegevens' };

  const dichtstbij = kandidaten.reduce((beste, t) =>
    afstandKm(t.vanCoordinaten, laatsteStop.coordinaten) <
    afstandKm(beste.vanCoordinaten, laatsteStop.coordinaten)
      ? t
      : beste,
  );
  return {
    soort: 'bekend',
    van: dichtstbij.van,
    naar: dichtstbij.naar,
    lijn: dichtstbij.lijn,
    opmerking: dichtstbij.opmerking,
    laatsteVertrek: dichtstbij.laatsteVertrek,
    trein: dichtstbij,
    knelt: knelt(dichtstbij.laatsteVertrek),
  };
};

/** De stations die de app kent als terugstation voor een stad, voor een keuzelijst. */
export const bekendeTerugstations = (treinen: LaatsteTrein[], stadId: string): string[] =>
  [...new Set(treinen.filter((t) => t.naarStad === stadId).map((t) => t.naar))].sort();
