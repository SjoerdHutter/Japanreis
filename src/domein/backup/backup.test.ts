import { describe, expect, it } from 'vitest';
import { backupNaam, herinnerAanBackup, manifestSchema, tijdVan, voegSamen } from './backup';

describe('backup', () => {
  it('noemt het bestand naar de dag, zonder streepjes', () => {
    expect(backupNaam(new Date(2026, 9, 8, 21, 30))).toBe('japanreis_backup_2026_10_08.zip');
  });

  it('kent een manifest van deze app, en weigert iets anders', () => {
    const manifest = {
      app: 'japanreis',
      schemaVersie: 1,
      appVersie: 'abc1234',
      gemaaktOp: '2026-10-08T12:00:00.000Z',
      opties: { fotos: true, documenten: false },
      aantallen: { uitgaven: 3, fotos: 0 },
    };
    expect(manifestSchema.safeParse(manifest).success).toBe(true);
    expect(manifestSchema.safeParse({ ...manifest, app: 'iets' }).success).toBe(false);
  });

  it('pakt de eerste tijd die een regel heeft', () => {
    expect(tijdVan({ toegevoegdOp: 'b', gewijzigdOp: 'a' })).toBe('a');
    expect(tijdVan({ gehaaldOp: 'c' })).toBe('c');
    expect(tijdVan({ id: 'x' })).toBeUndefined();
  });

  it('voegt samen op id, en de nieuwste wint', () => {
    const lokaal = [
      { id: '1', gewijzigdOp: '2026-10-05', w: 'hier' },
      { id: '2', gewijzigdOp: '2026-10-09', w: 'hier' },
      { id: '3', w: 'zonder tijd' },
    ];
    const backup = [
      { id: '1', gewijzigdOp: '2026-10-07', w: 'daar' },
      { id: '2', gewijzigdOp: '2026-10-08', w: 'daar' },
      { id: '3', w: 'ook zonder tijd' },
      { id: '4', w: 'nieuw' },
    ];
    const uit = voegSamen(lokaal, backup, 'id');
    expect(uit.teBewaren.map((r) => r.id)).toEqual(['1', '4']);
    expect([uit.nieuw, uit.nieuwer, uit.overgeslagen]).toEqual([1, 1, 2]);
  });

  it('herinnert pas na drie dagen, en alleen als er iets nieuws is', () => {
    const nu = new Date('2026-10-10T12:00:00Z');
    expect(herinnerAanBackup(undefined, undefined, nu)).toBe(false);
    expect(herinnerAanBackup(undefined, '2026-10-01T00:00:00Z', nu)).toBe(true);
    expect(herinnerAanBackup('2026-10-09T00:00:00Z', '2026-10-10T00:00:00Z', nu)).toBe(false);
    expect(herinnerAanBackup('2026-10-06T00:00:00Z', '2026-10-05T00:00:00Z', nu)).toBe(false);
    expect(herinnerAanBackup('2026-10-06T00:00:00Z', '2026-10-08T00:00:00Z', nu)).toBe(true);
  });
});
