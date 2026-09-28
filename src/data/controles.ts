import { useSyncExternalStore } from 'react';
import { bewaarIn, leesAlles, verwijderUit } from './db/idb';
import { meldWijziging, opWijziging } from './db/wijzigingen';

/**
 * Je vinkjes bij de meegeleverde feiten.
 *
 * Een noodnummer, een vertaling of een laatste trein komt uit algemene kennis.
 * Tot je het zelf hebt nagekeken staat er "controleren" bij. Het vinkje staat
 * in IndexedDB en niet in de content: een update van de app mag het niet
 * weghalen, en een ander die de app gebruikt heeft het niet voor jou gedaan.
 *
 * Eén gedeelde kopie in het geheugen, want de menukaart heeft er honderdvijftig
 * labels mee; die gaan niet elk apart de database langs.
 */

let nagekeken: Set<string> | null = null;
let bezig: Promise<void> | null = null;
const luisteraars = new Set<() => void>();

const laad = (): Promise<void> =>
  (bezig ??= leesAlles('controles').then((regels) => {
    nagekeken = new Set(regels.map((r) => r.id));
    for (const luisteraar of luisteraars) luisteraar();
  }));

opWijziging(['controles'], () => {
  bezig = null;
  void laad();
});

const abonneer = (luisteraar: () => void) => {
  luisteraars.add(luisteraar);
  if (!nagekeken) void laad();
  return () => luisteraars.delete(luisteraar);
};

export const zetControles = async (ids: string[], aan: boolean): Promise<void> => {
  if (ids.length === 0) return;
  if (aan) {
    const nu = new Date().toISOString();
    await bewaarIn('controles', ...ids.map((id) => ({ id, gecontroleerdOp: nu })));
  } else {
    await verwijderUit('controles', ...ids);
  }
  meldWijziging('controles');
};

/** De ids die je hebt nagekeken; null zolang ze nog niet gelezen zijn. */
export const useNagekeken = (): Set<string> | null =>
  useSyncExternalStore(abonneer, () => nagekeken);
