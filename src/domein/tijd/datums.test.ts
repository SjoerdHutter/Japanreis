import { describe, expect, it } from 'vitest';
import { alsKorteDatum, alsPeriode, dagenTussen, datumsVanTot, plusDagen } from './datums';

describe('datums', () => {
  it('telt over een maandgrens en over de wintertijd heen', () => {
    expect(plusDagen('2026-09-30', 1)).toBe('2026-10-01');
    // 25 oktober gaat thuis de klok terug; een kalenderdag blijft een dag.
    expect(plusDagen('2026-10-24', 2)).toBe('2026-10-26');
    expect(dagenTussen('2026-10-04', '2026-10-23')).toBe(19);
  });

  it('geeft alle datums van een periode, en niets als die omgekeerd is', () => {
    expect(datumsVanTot('2026-10-08', '2026-10-10')).toEqual([
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
    ]);
    expect(datumsVanTot('2026-10-10', '2026-10-08')).toEqual([]);
  });

  it('schrijft datums zonder streepjes', () => {
    expect(alsKorteDatum('2026-10-08')).toBe('8 okt');
    expect(alsPeriode('2026-10-08', '2026-10-09')).toBe('8 en 9 okt');
    expect(alsPeriode('2026-10-08', '2026-10-12')).toBe('8 t/m 12 okt');
    expect(alsPeriode('2026-09-30', '2026-10-02')).toBe('30 sep t/m 2 okt');
  });
});
