import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Cachestatus, EigenPunt } from '@/domein/schema';
import type { Koersen } from '@/domein/valuta/koers';
import type { Keuze } from '@/domein/highlight/bepaal';

/**
 * Alles wat op het toestel blijft staan.
 *
 * De redactionele content reist met de app mee en staat dus niet hier; wat hier
 * staat is van jou en van dit toestel: je highlight keuze, welke steden je
 * offline hebt klaargezet, de laatst opgehaalde wisselkoers, en straks je
 * notities, foto's en uitgaven. IndexedDB en niet localStorage, omdat er
 * later foto's bij komen en die passen daar niet in.
 *
 * Verhoog `DB_VERSIE` als er een store bij komt, en voeg hem toe in `upgrade`.
 * Bestaande stores nooit weggooien: dan verliest iemand die de app al draait
 * zijn gegevens bij een gewone update.
 */

/** Losse sleutels met een waarde: voorkeuren en kleine toestand. */
export interface SleutelWaarde {
  'highlight.keuze': Keuze;
  'stad.laatstBekeken': string;
  'koers.laatste': Koersen;
  'stempelboek.tipGetoond': boolean;
}

interface JapanreisDB extends DBSchema {
  kv: { key: keyof SleutelWaarde; value: unknown };
  cachestatus: { key: string; value: Cachestatus };
  /** De persoonlijke laag: eigen punten uit Google Maps, Instagram of met de hand. */
  eigenpunten: { key: string; value: EigenPunt; indexes: { stad: string } };
}

const DB_NAAM = 'japanreis';
const DB_VERSIE = 2;

let dbBelofte: Promise<IDBPDatabase<JapanreisDB>> | null = null;

export const getDb = (): Promise<IDBPDatabase<JapanreisDB>> => {
  dbBelofte ??= openDB<JapanreisDB>(DB_NAAM, DB_VERSIE, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('cachestatus')) {
        db.createObjectStore('cachestatus', { keyPath: 'stadId' });
      }
      if (!db.objectStoreNames.contains('eigenpunten')) {
        const store = db.createObjectStore('eigenpunten', { keyPath: 'id' });
        // Een index op stad, zodat het stadsscherm niet de hele verzameling
        // hoeft door te lopen als er straks honderden punten in staan.
        store.createIndex('stad', 'stadId');
      }
    },
  });
  return dbBelofte;
};

/**
 * Lezen en schrijven met typen die kloppen. De `catch` eromheen is er omdat
 * IndexedDB in een privévenster of met geblokkeerde opslag gewoon weigert; de
 * app hoort dan door te draaien zonder geheugen, niet om te vallen.
 */
export const lees = async <K extends keyof SleutelWaarde>(
  sleutel: K,
): Promise<SleutelWaarde[K] | undefined> => {
  try {
    const db = await getDb();
    return (await db.get('kv', sleutel)) as SleutelWaarde[K] | undefined;
  } catch {
    return undefined;
  }
};

export const schrijf = async <K extends keyof SleutelWaarde>(
  sleutel: K,
  waarde: SleutelWaarde[K],
): Promise<void> => {
  try {
    const db = await getDb();
    await db.put('kv', waarde, sleutel);
  } catch {
    /* geen opslag beschikbaar: dan onthoudt de app het deze sessie alleen */
  }
};

export const verwijder = async (sleutel: keyof SleutelWaarde): Promise<void> => {
  try {
    const db = await getDb();
    await db.delete('kv', sleutel);
  } catch {
    /* zie hierboven */
  }
};

export const leesCachestatus = async (): Promise<Cachestatus[]> => {
  try {
    return await (await getDb()).getAll('cachestatus');
  } catch {
    return [];
  }
};

export const schrijfCachestatus = async (status: Cachestatus): Promise<void> => {
  try {
    await (await getDb()).put('cachestatus', status);
  } catch {
    /* zie hierboven */
  }
};

/**
 * De eigen punten. Bewust in een aparte store en niet door de redactionele
 * content heen: die reist met de app mee en wordt bij elke update overschreven,
 * terwijl dit van jou is en moet blijven staan.
 */
export const leesEigenPunten = async (stadId?: string): Promise<EigenPunt[]> => {
  try {
    const db = await getDb();
    if (stadId === undefined) return await db.getAll('eigenpunten');
    return await db.getAllFromIndex('eigenpunten', 'stad', stadId);
  } catch {
    return [];
  }
};

export const bewaarEigenPunten = async (punten: EigenPunt[]): Promise<void> => {
  try {
    const db = await getDb();
    const transactie = db.transaction('eigenpunten', 'readwrite');
    await Promise.all([...punten.map((p) => transactie.store.put(p)), transactie.done]);
  } catch {
    /* geen opslag beschikbaar */
  }
};

export const verwijderEigenPunt = async (id: string): Promise<void> => {
  try {
    await (await getDb()).delete('eigenpunten', id);
  } catch {
    /* geen opslag beschikbaar */
  }
};

/** Gooit alles weg wat uit één import kwam, voor het geval het niet klopte. */
export const verwijderEigenPuntenVanLijst = async (lijst: string): Promise<number> => {
  try {
    const db = await getDb();
    const alle = await db.getAll('eigenpunten');
    const weg = alle.filter((p) => p.lijst === lijst);
    const transactie = db.transaction('eigenpunten', 'readwrite');
    await Promise.all([...weg.map((p) => transactie.store.delete(p.id)), transactie.done]);
    return weg.length;
  } catch {
    return 0;
  }
};
