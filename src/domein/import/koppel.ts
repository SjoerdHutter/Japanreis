import type { Plaats, Stad } from '@/domein/schema';
import { afstandKm } from '@/domein/geo/afstand';
import type { RuwPunt } from './googlemaps';

/**
 * Geïmporteerde punten koppelen aan de eigen database van de app.
 *
 * Twee vragen: in welke stad ligt dit, en is dit hetzelfde als een plaats die
 * de app al kent. De eerste is meetkunde en dus zeker. De tweede is een gok, en
 * daarom geeft deze module altijd een zekerheid mee. "Twijfel" betekent dat de
 * gebruiker het moet bevestigen; er wordt nooit stilletjes samengevoegd, want
 * een verkeerde koppeling verstopt een punt onder een ander punt en dat merk je
 * pas als je ernaartoe loopt.
 *
 * Punten die nergens op matchen gaan niet verloren. Ze blijven staan als losse
 * pin met hun naam, precies zoals de specificatie vraagt.
 */

export type Zekerheid = 'zeker' | 'twijfel' | 'geen';

export interface Voorstel {
  ruw: RuwPunt;
  stadId?: string;
  /** De plaats waar dit punt op lijkt, als die er is. */
  plaatsId?: string;
  plaatsNaam?: string;
  zekerheid: Zekerheid;
  /** In één regel waarom, zodat de gebruiker de gok kan beoordelen. */
  reden: string;
}

/**
 * Namen vergelijkbaar maken. Weg met hoofdletters, accenten, leestekens en de
 * woorden die in vrijwel elke Japanse plaatsnaam staan. Zonder dat laatste
 * matcht "Kiyomizu-dera Temple" niet op "Kiyomizu-dera".
 */
const RUISWOORDEN = new Set([
  'temple',
  'tempel',
  'shrine',
  'schrijn',
  'museum',
  'garden',
  'garten',
  'tuin',
  'park',
  'station',
  'market',
  'markt',
  'the',
  'de',
  'het',
  'van',
  'castle',
  'kasteel',
  'restaurant',
  'cafe',
  'ji',
  'dera',
  'jinja',
  'taisha',
  'een',
  'en',
]);

export const normaliseer = (naam: string): string =>
  naam
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const woorden = (naam: string): string[] =>
  normaliseer(naam)
    .split(' ')
    .filter((w) => w.length > 1 && !RUISWOORDEN.has(w));

/**
 * Hoeveel lijken twee namen op elkaar, van 0 tot 1.
 *
 * Geen letterafstand maar overlap van woorden. Dat past beter bij hoe deze
 * namen uiteenlopen: "Sensō-ji" tegenover "Sensoji Temple, Asakusa" verschilt
 * in vrijwel elke letter maar deelt het enige woord dat ertoe doet.
 */
/**
 * Twee woorden die hetzelfde aanduiden.
 *
 * Gelijk is altijd goed. Het een in het ander laten passen mag alleen bij
 * woorden van enige lengte: zonder die ondergrens telt "een" als treffer op
 * "en", en dan stelt de app "Shukkei-en" voor bij "Een zaak zonder plek". Vier
 * letters is genoeg om "Senso" op "Sensoji" te laten matchen en te weinig om
 * lidwoorden en voorzetsels mee te laten doen.
 */
const KORTSTE_DEELWOORD = 4;

const raakt = (a: string, b: string): boolean => {
  if (a === b) return true;
  const kort = a.length <= b.length ? a : b;
  const lang = a.length <= b.length ? b : a;
  return kort.length >= KORTSTE_DEELWOORD && lang.includes(kort);
};

export const naamGelijkenis = (a: string, b: string): number => {
  const na = normaliseer(a);
  const nb = normaliseer(b);
  if (na === nb) return 1;

  const wa = woorden(a);
  const wb = woorden(b);
  if (wa.length === 0 || wb.length === 0) {
    // Alles was ruis; dan maar op de kale namen kijken.
    return na.includes(nb) || nb.includes(na) ? 0.75 : 0;
  }

  const gedeeld = wa.filter((w) => wb.some((v) => raakt(w, v)));
  return gedeeld.length / Math.min(wa.length, wb.length);
};

/** Binnen welke stad valt dit punt? Op afstand tot het centrum, net als bij GPS. */
export const stadVoorPunt = (punt: RuwPunt, steden: Stad[]): Stad | null => {
  if (!punt.coordinaten) return null;
  let beste: { stad: Stad; km: number } | null = null;
  for (const stad of steden) {
    const km = afstandKm(punt.coordinaten, stad.centrum);
    if (km <= stad.straalKm && (beste === null || km < beste.km)) beste = { stad, km };
  }
  return beste?.stad ?? null;
};

/** Hoe dichtbij twee punten moeten liggen voor een koppeling zonder twijfel. */
const ZEKER_KM = 0.15;
const TWIJFEL_KM = 0.6;

export const stelVoor = (ruwe: RuwPunt[], steden: Stad[], plaatsen: Plaats[]): Voorstel[] =>
  ruwe.map((ruw) => {
    const stad = stadVoorPunt(ruw, steden);

    if (!ruw.coordinaten) {
      // Zonder coördinaten valt er alleen op naam te matchen, en dan is één
      // treffer in het hele bestand nog geen bewijs. Altijd laten bevestigen.
      const opNaam = plaatsen
        .map((p) => ({ plaats: p, score: naamGelijkenis(ruw.naam, p.naam) }))
        .filter((k) => k.score >= 0.8)
        .sort((a, b) => b.score - a.score)[0];

      if (opNaam) {
        return {
          ruw,
          stadId: opNaam.plaats.stad,
          plaatsId: opNaam.plaats.id,
          plaatsNaam: opNaam.plaats.naam,
          zekerheid: 'twijfel',
          reden: `Naam lijkt op ${opNaam.plaats.naam}, maar er zaten geen coördinaten bij.`,
        };
      }
      return {
        ruw,
        zekerheid: 'geen',
        reden: 'Geen coördinaten in het bestand. Zet dit punt met de hand op de kaart.',
      };
    }

    const kandidaten = plaatsen
      .map((p) => ({
        plaats: p,
        km: afstandKm(ruw.coordinaten!, p.coordinaten),
        score: naamGelijkenis(ruw.naam, p.naam),
      }))
      .filter((k) => k.km <= TWIJFEL_KM)
      .sort((a, b) => b.score - a.score || a.km - b.km);

    const beste = kandidaten[0];

    if (beste && beste.km <= ZEKER_KM && beste.score >= 0.6) {
      return {
        ruw,
        stadId: stad?.id ?? beste.plaats.stad,
        plaatsId: beste.plaats.id,
        plaatsNaam: beste.plaats.naam,
        zekerheid: 'zeker',
        reden: `Zelfde plek als ${beste.plaats.naam}, op ${Math.round(beste.km * 1000)} meter.`,
      };
    }

    if (beste && (beste.score >= 0.5 || beste.km <= ZEKER_KM)) {
      return {
        ruw,
        stadId: stad?.id ?? beste.plaats.stad,
        plaatsId: beste.plaats.id,
        plaatsNaam: beste.plaats.naam,
        zekerheid: 'twijfel',
        reden: `Lijkt op ${beste.plaats.naam}, op ${Math.round(beste.km * 1000)} meter. Klopt dat?`,
      };
    }

    return {
      ruw,
      stadId: stad?.id,
      zekerheid: 'geen',
      reden: stad
        ? `Nieuw punt in ${stad.naam}.`
        : 'Ligt buiten alle steden in de app. Komt als los punt op de kaart.',
    };
  });
