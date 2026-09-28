import { schrijf } from './db/idb';

/**
 * Vragen of de browser je gegevens met rust laat.
 *
 * Zonder die belofte mag een browser bij ruimtegebrek de opslag van een site
 * opruimen, en dan zijn je foto's en je verzekering weg. Safari geeft een app
 * op het beginscherm die belofte meestal vanzelf; in een gewoon tabblad niet.
 * Er wordt bij elke start gevraagd zolang het antwoord nee is, want een
 * browser kan er later anders over denken.
 */
export const vraagBlijvendeOpslag = async (): Promise<boolean | null> => {
  if (!navigator.storage?.persist) return null;
  try {
    const al = await navigator.storage.persisted();
    const blijvend = al || (await navigator.storage.persist());
    await schrijf('opslag.persistent', blijvend);
    return blijvend;
  } catch {
    return null;
  }
};

export interface Opslagstand {
  /** Null als de browser het niet zegt. */
  blijvend: boolean | null;
  gebruikt?: number;
  beschikbaar?: number;
}

export const leesOpslagstand = async (): Promise<Opslagstand> => {
  const stand: Opslagstand = { blijvend: null };
  try {
    if (navigator.storage?.persisted) stand.blijvend = await navigator.storage.persisted();
    if (navigator.storage?.estimate) {
      const schatting = await navigator.storage.estimate();
      stand.gebruikt = schatting.usage;
      stand.beschikbaar = schatting.quota;
    }
  } catch {
    /* de browser zegt het niet; dan staat er ook niets */
  }
  return stand;
};
