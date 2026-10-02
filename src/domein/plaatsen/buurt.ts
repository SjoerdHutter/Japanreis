import type { Plaats } from '@/domein/schema';
import { afstandKm } from '@/domein/geo/afstand';
import { looptijdMinuten } from '@/domein/filters/plaatsen';

/**
 * Wat bij elkaar hoort: de Top 20 met zijn onderdelen, en eten en drinken bij
 * een bezienswaardigheid.
 */

/** Hoe ver een plek mag liggen om "in de buurt" te zijn, als hij niet gekoppeld is. */
export const BUURT_KM = 0.8;

export interface Rangregel {
  plaats: Plaats;
  /** De plekken die eronder vallen, zoals de Ngoc Son tempel onder het meer. */
  onderdelen: Plaats[];
}

/**
 * De Top 20 van een stad, op volgorde van rang, met de onderdelen onder hun
 * hoofdplek. Een onderdeel van een plek die zelf geen rang heeft, staat er
 * niet in; het hoort dan niet bij de lijst.
 */
export const top20 = (plaatsen: Plaats[]): Rangregel[] =>
  plaatsen
    .filter((p) => p.rang !== undefined)
    .sort((a, b) => (a.rang ?? 0) - (b.rang ?? 0))
    .map((plaats) => ({
      plaats,
      onderdelen: plaatsen.filter((p) => p.onderdeelVan === plaats.id),
    }));

export interface Buurplek {
  plaats: Plaats;
  /** Minuten lopen, hemelsbreed. Null als een van beide nog niet op de kaart staat. */
  minuten: number | null;
  /** Expliciet gekoppeld via inDeBuurtVan, en niet alleen toevallig dichtbij. */
  gekoppeld: boolean;
}

const lopen = (a: Plaats, b: Plaats): number | null =>
  a.coordinaten && b.coordinaten ? looptijdMinuten(a.coordinaten, b.coordinaten) : null;

const dichtbij = (a: Plaats, b: Plaats): boolean =>
  Boolean(a.coordinaten && b.coordinaten && afstandKm(a.coordinaten, b.coordinaten) <= BUURT_KM);

/** Op looptijd, en wat geen looptijd heeft achteraan. */
const opLooptijd = (a: Buurplek, b: Buurplek): number =>
  (a.minuten ?? Number.MAX_SAFE_INTEGER) - (b.minuten ?? Number.MAX_SAFE_INTEGER);

/**
 * Eten en drinken bij een bezienswaardigheid. Eerst de plekken die er via
 * inDeBuurtVan aan gekoppeld zijn, dan andere eet en drinkplekken binnen 800
 * meter; elk groepje op looptijd.
 */
export const etenInDeBuurt = (plaats: Plaats, alle: Plaats[]): Buurplek[] => {
  const eten = alle.filter((p) => p.categorie === 'eten' && p.id !== plaats.id);
  const gekoppeld = eten
    .filter((p) => p.inDeBuurtVan?.includes(plaats.id))
    .map((p) => ({ plaats: p, minuten: lopen(plaats, p), gekoppeld: true }))
    .sort(opLooptijd);
  const ids = new Set(gekoppeld.map((g) => g.plaats.id));
  const verder = eten
    .filter((p) => !ids.has(p.id) && dichtbij(plaats, p))
    .map((p) => ({ plaats: p, minuten: lopen(plaats, p), gekoppeld: false }))
    .sort(opLooptijd);
  return [...gekoppeld, ...verder];
};

/**
 * Omgekeerd: de bezienswaardigheden vlak bij een eet, drink of spa plek. Eerst
 * die in zijn eigen inDeBuurtVan, dan andere binnen 800 meter.
 */
export const vlakbij = (plaats: Plaats, alle: Plaats[]): Buurplek[] => {
  const attracties = alle.filter((p) => p.categorie === 'attractie' && p.id !== plaats.id);
  const koppeling = new Set(plaats.inDeBuurtVan ?? []);
  const gekoppeld = attracties
    .filter((p) => koppeling.has(p.id))
    .map((p) => ({ plaats: p, minuten: lopen(plaats, p), gekoppeld: true }))
    .sort(opLooptijd);
  const verder = attracties
    .filter((p) => !koppeling.has(p.id) && dichtbij(plaats, p))
    .map((p) => ({ plaats: p, minuten: lopen(plaats, p), gekoppeld: false }))
    .sort(opLooptijd);
  return [...gekoppeld, ...verder];
};
