import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Cachestatus } from '@/domein/schema';
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
}

const DB_NAAM = 'japanreis';
const DB_VERSIE = 1;

let dbBelofte: Promise<IDBPDatabase<JapanreisDB>> | null = null;

export const getDb = (): Promise<IDBPDatabase<JapanreisDB>> => {
  dbBelofte ??= openDB<JapanreisDB>(DB_NAAM, DB_VERSIE, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('cachestatus')) {
        db.createObjectStore('cachestatus', { keyPath: 'stadId' });
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
