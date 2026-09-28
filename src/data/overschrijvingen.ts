import { useSyncExternalStore } from 'react';
import { overschrijvingId, type Overschrijving } from '@/domein/overschrijven/samenvoegen';
import { bewaarIn, leesAlles, verwijderUit } from './db/idb';
import { meldWijziging, opWijziging } from './db/wijzigingen';

/**
 * Je eigen waarden, gedeeld door de hele app.
 *
 * Eén kopie in het geheugen, net als de vinkjes bij Controleren: een stadsscherm
 * met dertig plaatsen hoeft niet dertig keer de database langs.
 */

let alle: Overschrijving[] | null = null;
let bezig: Promise<void> | null = null;
const luisteraars = new Set<() => void>();

const laad = (): Promise<void> =>
  (bezig ??= leesAlles('overschrijvingen').then((regels) => {
    alle = regels;
    for (const luisteraar of luisteraars) luisteraar();
  }));

opWijziging(['overschrijvingen'], () => {
  bezig = null;
  void laad();
});

const abonneer = (luisteraar: () => void) => {
  luisteraars.add(luisteraar);
  if (!alle) void laad();
  return () => luisteraars.delete(luisteraar);
};

/** Alle eigen waarden; een lege lijst zolang ze nog niet gelezen zijn. */
const LEEG: Overschrijving[] = [];
export const useOverschrijvingen = (): Overschrijving[] =>
  useSyncExternalStore(abonneer, () => alle ?? LEEG);

export const zetOverschrijving = async (
  doel: string,
  doelId: string,
  veld: string,
  waarde: unknown,
): Promise<void> => {
  await bewaarIn('overschrijvingen', {
    id: overschrijvingId(doel, doelId, veld),
    doel,
    doelId,
    veld,
    waarde,
    gewijzigdOp: new Date().toISOString(),
  });
  meldWijziging('overschrijvingen');
};

export const zetTerugNaarApp = async (doel: string, doelId: string, veld: string) => {
  await verwijderUit('overschrijvingen', overschrijvingId(doel, doelId, veld));
  meldWijziging('overschrijvingen');
};
