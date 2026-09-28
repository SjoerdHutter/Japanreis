import type { Bijlage, BijlageEigenaar, Gegeven } from '@/domein/schema';
import { bewaarIn, getDb, leesAlles, leesUitIndex, verwijderUit } from '@/data/db/idb';
import { meldWijziging } from '@/data/db/wijzigingen';

/**
 * Mijn gegevens lezen en schrijven.
 *
 * Een dun laagje over IndexedDB dat na elke wijziging een seintje geeft, zodat
 * het hoofdmenu en het noodscherm meteen meekijken. Verwijder je een vlucht of
 * een verblijf, dan gaan de bijlagen die eraan vastzitten mee: een e-ticket van
 * een vlucht die niet meer bestaat is alleen verwarrend.
 */

export const leesGegevens = (): Promise<Gegeven[]> => leesAlles('gegevens');

export const bewaarGegeven = async (gegeven: Gegeven): Promise<boolean> => {
  const gelukt = await bewaarIn('gegevens', gegeven);
  meldWijziging('gegevens');
  return gelukt;
};

export const bewaarGegevens = async (gegevens: Gegeven[]): Promise<boolean> => {
  if (gegevens.length === 0) return true;
  const gelukt = await bewaarIn('gegevens', ...gegevens);
  meldWijziging('gegevens');
  return gelukt;
};

/** De eigenaar van de bijlagen van een regel, zoals `vlucht:<id>`. */
export const eigenaarVan = (gegeven: Pick<Gegeven, 'soort' | 'id'>): BijlageEigenaar =>
  gegeven.soort === 'verzekering' || gegeven.soort === 'medisch'
    ? gegeven.soort
    : `${gegeven.soort}:${gegeven.id}`;

export const verwijderGegeven = async (gegeven: Gegeven): Promise<boolean> => {
  const gelukt = await verwijderUit('gegevens', gegeven.id);
  if (gegeven.soort === 'vlucht' || gegeven.soort === 'accommodatie') {
    await verwijderBijlagenVan(eigenaarVan(gegeven));
  }
  meldWijziging('gegevens');
  return gelukt;
};

export const leesBijlagen = (eigenaar: BijlageEigenaar): Promise<Bijlage[]> =>
  leesUitIndex('bijlagen', 'eigenaar', eigenaar);

export const leesAlleBijlagen = (): Promise<Bijlage[]> => leesAlles('bijlagen');

export const bewaarBijlage = async (bijlage: Bijlage): Promise<boolean> => {
  const gelukt = await bewaarIn('bijlagen', bijlage);
  meldWijziging('bijlagen');
  return gelukt;
};

export const verwijderBijlage = async (id: string): Promise<boolean> => {
  const gelukt = await verwijderUit('bijlagen', id);
  meldWijziging('bijlagen');
  return gelukt;
};

export const verwijderBijlagenVan = async (eigenaar: BijlageEigenaar): Promise<void> => {
  try {
    const sleutels = await (await getDb()).getAllKeysFromIndex('bijlagen', 'eigenaar', eigenaar);
    if (sleutels.length > 0) await verwijderUit('bijlagen', ...sleutels);
  } catch {
    /* geen opslag beschikbaar */
  }
  meldWijziging('bijlagen');
};
