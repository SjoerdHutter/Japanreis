import type { Dagnotitie } from '@/domein/schema';
import { bewaarIn, leesAlles, leesEen, verwijderUit } from './db/idb';
import { meldWijziging } from './db/wijzigingen';

/**
 * De dagnotities. Eén per dag, met de datum als sleutel; een lege notitie
 * zonder hoogtepunt wordt weggehaald in plaats van bewaard, zodat de
 * herinnering 's avonds weet dat er nog niets staat.
 */

export const leesDagnotitie = (datum: string): Promise<Dagnotitie | undefined> =>
  leesEen('dagnotities', datum);

export const leesDagnotities = async (): Promise<Dagnotitie[]> =>
  (await leesAlles('dagnotities')).sort((a, b) => a.datum.localeCompare(b.datum));

export const isLeeg = (notitie: Pick<Dagnotitie, 'notitie' | 'hoogtepunt'> | undefined): boolean =>
  !notitie || (!notitie.notitie.trim() && !notitie.hoogtepunt?.trim());

/** Bewaart of verwijdert; geeft terug of het lukte. */
export const bewaarDagnotitie = async (
  datum: string,
  inhoud: { notitie: string; hoogtepunt: string },
): Promise<boolean> => {
  const hoogtepunt = inhoud.hoogtepunt.trim();
  const gelukt = isLeeg(inhoud)
    ? await verwijderUit('dagnotities', datum)
    : await bewaarIn('dagnotities', {
        datum,
        notitie: inhoud.notitie,
        ...(hoogtepunt ? { hoogtepunt } : {}),
        gewijzigdOp: new Date().toISOString(),
      });
  meldWijziging('dagnotities');
  return gelukt;
};

/**
 * Een concept dat nog niet in de database staat.
 *
 * Bewaren in IndexedDB is asynchroon. Verbergt de app zich (een andere app,
 * het scherm op slot), dan is daar tijd voor. Wordt de pagina direct herladen
 * of gesloten, dan niet altijd; daarom gaat wat nog wachtte op dat moment ook
 * synchroon naar localStorage, en bij de volgende start alsnog de database in.
 * Buiten het voorvoegsel `japanreis.`, zodat een concept niet in een backup
 * belandt.
 */
const CONCEPT_SLEUTEL = 'concept.dagnotitie';

interface Concept {
  datum: string;
  notitie: string;
  hoogtepunt: string;
}

export const bewaarConcept = (concept: Concept): void => {
  try {
    localStorage.setItem(CONCEPT_SLEUTEL, JSON.stringify(concept));
  } catch {
    /* geen localStorage: dan rest alleen de gewone weg */
  }
};

export const vergeetConcept = (datum: string): void => {
  try {
    const ruw = localStorage.getItem(CONCEPT_SLEUTEL);
    if (ruw && (JSON.parse(ruw) as Concept).datum === datum)
      localStorage.removeItem(CONCEPT_SLEUTEL);
  } catch {
    /* niets aan te doen */
  }
};

const leesConcepten = (): Concept | undefined => {
  try {
    const ruw = localStorage.getItem(CONCEPT_SLEUTEL);
    const concept = ruw ? (JSON.parse(ruw) as Partial<Concept>) : undefined;
    if (
      !concept ||
      typeof concept.datum !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(concept.datum) ||
      typeof concept.notitie !== 'string' ||
      typeof concept.hoogtepunt !== 'string'
    )
      return undefined;
    return concept as Concept;
  } catch {
    return undefined;
  }
};

/** Het concept van deze dag, als dat er nog ligt: dat is nieuwer dan de database. */
export const leesConcept = (datum: string): Concept | undefined => {
  const concept = leesConcepten();
  return concept?.datum === datum ? concept : undefined;
};

/** Bij het opstarten: een achtergebleven concept alsnog bewaren. */
export const bewaarAchtergeblevenConcept = async (): Promise<void> => {
  const concept = leesConcepten();
  if (concept && (await bewaarDagnotitie(concept.datum, concept))) vergeetConcept(concept.datum);
};
