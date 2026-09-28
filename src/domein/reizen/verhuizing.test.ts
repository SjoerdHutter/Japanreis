import { describe, expect, it } from 'vitest';
import { REISDAGEN, REISSCHEMA } from '@/data/content';
import type { Accommodatie } from '@/domein/schema';
import { dagenVanDeReis } from './dagen';
import { verhuisMorgen } from './verhuizing';

const DAGEN = dagenVanDeReis(REISSCHEMA, REISDAGEN);
const verblijf = (id: string, stadId: string, van: string, tot: string): Accommodatie => ({
  soort: 'accommodatie',
  id,
  naam: id,
  stadId,
  incheck: { datum: van },
  uitcheck: { datum: tot },
  gewijzigdOp: 'x',
});

describe('verhuisMorgen', () => {
  it('ziet de verhuizing van Kyoto naar Kanazawa op de laatste avond in Kyoto', () => {
    const volgend = verblijf('b', 'kanazawa', '2026-10-13', '2026-10-16');
    const uit = verhuisMorgen('2026-10-12', DAGEN, [
      verblijf('a', 'kyoto', '2026-10-08', '2026-10-13'),
      volgend,
    ]);
    expect(uit).toEqual({ naarStadId: 'kanazawa', volgend });
  });

  it('werkt ook als de volgende accommodatie nog niet is ingevuld', () => {
    expect(verhuisMorgen('2026-10-12', DAGEN, [])).toEqual({
      naarStadId: 'kanazawa',
      volgend: undefined,
    });
  });

  it('zegt niets midden in een verblijf, of voor de vlucht naar huis', () => {
    expect(verhuisMorgen('2026-10-10', DAGEN, [])).toBeNull();
    expect(verhuisMorgen('2026-10-22', DAGEN, [])).toBeNull();
  });

  it('telt een ander hotel in dezelfde stad ook als verhuizing', () => {
    const uit = verhuisMorgen('2026-10-20', DAGEN, [
      verblijf('a', 'tokio', '2026-10-18', '2026-10-21'),
      verblijf('b', 'tokio', '2026-10-21', '2026-10-23'),
    ]);
    expect(uit?.volgend?.id).toBe('b');
  });
});
