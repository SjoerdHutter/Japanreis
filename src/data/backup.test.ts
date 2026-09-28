import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BACKUP_STORES } from './backup';

/**
 * Een store die er later bij komt en niet in de backup staat, gaat verloren bij
 * een nieuw toestel. Deze test leest welke stores de database aanmaakt en eist
 * dat elke store met eigen gegevens in de backup zit.
 */
const GEEN_EIGEN_DATA = ['kv', 'cachestatus', 'weer'];

describe('de backup', () => {
  it('neemt elke store met eigen gegevens mee', () => {
    const bron = readFileSync('src/data/db/idb.ts', 'utf8');
    const stores = [...bron.matchAll(/createObjectStore\('([a-z]+)'/g)].map((m) => m[1]);
    expect(stores.length).toBeGreaterThan(5);
    const inBackup = BACKUP_STORES.map((b) => b.store as string);
    for (const store of stores) {
      if (GEEN_EIGEN_DATA.includes(store)) continue;
      expect(inBackup, `store ${store} ontbreekt in de backup`).toContain(store);
    }
  });

  it('kent de sleutel van een store die niet op id sleutelt', () => {
    expect(BACKUP_STORES.find((b) => b.store === 'dagnotities')?.sleutel).toBe('datum');
  });

  it('heeft een optie voor de foto’s en een voor de documenten', () => {
    expect(BACKUP_STORES.find((b) => b.store === 'fotos')?.optie).toBe('fotos');
    expect(BACKUP_STORES.find((b) => b.store === 'bijlagen')?.optie).toBe('documenten');
  });
});
