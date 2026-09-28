import { REISSCHEMA, STEDEN } from './content';
import { bewaarIn, leesAlles, leesEen } from './db/idb';
import {
  isVers,
  leesVerwachting,
  opTeHalen,
  verwachtingUrl,
  voegDagenSamen,
  type WeerVanStad,
} from '@/domein/weer/verwachting';

/**
 * Het weer ophalen en bewaren.
 *
 * Bij het openen van de app, en bij terugkomen, als er bereik is en de vorige
 * verwachting ouder is dan drie uur. Wat is opgehaald gaat in IndexedDB, met
 * het moment erbij; zonder bereik toont de app dat met "laatst bijgewerkt".
 * Mislukt het ophalen, dan blijft de oude verwachting gewoon staan.
 */

export const leesWeer = async (): Promise<Record<string, WeerVanStad>> => {
  const alles = await leesAlles('weer');
  return Object.fromEntries(alles.map((w) => [w.stadId, w]));
};

/** Ververst wat verouderd is. Geeft terug of er iets nieuws is. */
export const ververseWeer = async (
  nu: Date = new Date(),
  signaal?: AbortSignal,
): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  let iets = false;
  for (const { stad, van, tot } of opTeHalen(REISSCHEMA, STEDEN, nu)) {
    const oud = await leesEen('weer', stad.id);
    if (isVers(oud?.opgehaaldOp, nu)) continue;
    try {
      const antwoord = await fetch(verwachtingUrl(stad, van, tot), { signal: signaal });
      if (!antwoord.ok) continue;
      const dagen = leesVerwachting(await antwoord.json());
      await bewaarIn('weer', {
        stadId: stad.id,
        opgehaaldOp: nu.toISOString(),
        dagen: voegDagenSamen(oud?.dagen ?? [], dagen),
      });
      iets = true;
    } catch {
      /* geen bereik of een vreemd antwoord: de oude verwachting blijft staan */
    }
  }
  return iets;
};
