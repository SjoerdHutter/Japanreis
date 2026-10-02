import { describe, expect, it } from 'vitest';
import { leesOsm, osmFout, osmOp } from './osm';

const op = (osm: string, datum: string) => osmOp(leesOsm(osm), datum);

describe('leesOsm', () => {
  it('leest 24/7 als de hele dag open', () => {
    expect(op('24/7', '2026-10-04')).toEqual({ soort: 'open', blokken: [{ van: 0, tot: 1440 }] });
  });

  it('leest dagen, reeksen en meerdere blokken', () => {
    const osm = 'Tu-Th,Sa,Su 07:30-11:00,13:30-16:00; Mo,Fr 07:30-11:00';
    // Zaterdag 3 oktober 2026 en vrijdag 2 oktober 2026.
    expect(op(osm, '2026-10-03')).toEqual({
      soort: 'open',
      blokken: [
        { van: 450, tot: 660 },
        { van: 810, tot: 960 },
      ],
    });
    expect(op(osm, '2026-10-02')).toEqual({ soort: 'open', blokken: [{ van: 450, tot: 660 }] });
  });

  it('laat een latere regel een eerdere vervangen, zoals in OpenStreetMap', () => {
    const osm = 'Mo-Fr 08:00-18:00; Sa,Su 08:00-21:00';
    expect(op(osm, '2026-10-04')).toEqual({ soort: 'open', blokken: [{ van: 480, tot: 1260 }] });
  });

  it('noemt een dag die geen regel raakt dicht', () => {
    // Maandag 5 oktober 2026.
    expect(op('Tu-Su 08:30-17:30', '2026-10-05')).toEqual({ soort: 'gesloten' });
  });

  it('kent de eerste maandag van de maand', () => {
    const osm = 'Mo-Su 08:00-12:00,13:30-17:00; Mo[1] off';
    expect(op(osm, '2026-10-05').soort).toBe('gesloten');
    expect(op(osm, '2026-10-12').soort).toBe('open');
    expect(op(osm, '2026-11-02').soort).toBe('gesloten');
  });

  it('kent seizoenen die over de jaarwisseling lopen, en een periode dicht', () => {
    const osm =
      'Apr-Oct Tu-Th,Sa,Su 07:30-10:30; Nov-Mar Tu-Th,Sa,Su 08:00-11:00; 2026 Sep 04-2026 Nov 02 off';
    expect(op(osm, '2026-10-15').soort).toBe('gesloten');
    expect(op(osm, '2026-11-03')).toEqual({ soort: 'open', blokken: [{ van: 480, tot: 660 }] });
    expect(op(osm, '2027-01-05')).toEqual({ soort: 'open', blokken: [{ van: 480, tot: 660 }] });
    expect(op(osm, '2026-06-02')).toEqual({ soort: 'open', blokken: [{ van: 450, tot: 630 }] });
  });

  it('kent tijden tot middernacht en over middernacht heen', () => {
    expect(op('Fr-Su 18:00-24:00', '2026-10-02')).toEqual({
      soort: 'open',
      blokken: [{ van: 1080, tot: 1440 }],
    });
    expect(op('Mo-Th 17:00-24:00; Fr-Su 17:00-02:00', '2026-10-02')).toEqual({
      soort: 'open',
      blokken: [{ van: 1020, tot: 120 }],
    });
  });
});

describe('osmFout', () => {
  it('weigert wat het niet kent, in plaats van stil altijd open te zeggen', () => {
    for (const fout of [
      'PH off',
      'sunrise-sunset',
      'Mo-Fr 8:00-17:00',
      'Mo-Fr 08:00-25:00',
      'Mo-Fr',
      'Xx 08:00-17:00',
      'Mo-Fr 08:00-08:00',
      '',
    ]) {
      expect(osmFout(fout), fout).not.toBeNull();
    }
  });

  it('accepteert alle notaties die in de Hanoi data voorkomen', () => {
    for (const goed of [
      '24/7',
      'Mo-Fr 08:00-18:00; Sa,Su 08:00-21:00',
      'Fr-Su 18:00-24:00',
      'Mo-Su 08:00-17:00',
      'Apr-Oct Tu-Th,Sa,Su 07:30-10:30; Nov-Mar Tu-Th,Sa,Su 08:00-11:00; 2026 Sep 04-2026 Nov 02 off',
      'Tu-Th,Sa,Su 07:30-11:00,13:30-16:00; Mo,Fr 07:30-11:00',
      'Tu-Su 08:30-17:30',
      'Mo-Su 07:30-11:00,13:30-17:00',
      'Mo-Th,Sa,Su 10:30-12:00',
      'Mo-Su 08:00-12:00,13:30-17:00; Mo[1] off',
      'Mo-Su 06:00-18:00',
      'Tu-Th,Sa,Su 08:00-11:30,13:00-16:30',
      'Tu-Su 08:30-17:00',
      'Mo-Su 07:00-22:00',
      'Mo-Su 06:00-10:00,18:00-20:30',
      'Mo-Su 10:00-21:30',
      'Mo-Th 17:00-24:00; Fr-Su 17:00-02:00',
      'Mo-Su 17:00-23:00',
      'Mo-Su 08:00-20:30',
      'Mo-Su 10:00-22:00',
      'Mo-Su 11:00-14:00,17:30-21:30',
      'Tu-Th 18:00-21:00; Fr-Su 11:30-13:30,18:00-21:00',
      'Mo-Su 16:00-24:00',
      'Mo-Su 09:00-21:00',
      'Mo-Su 10:00-22:30',
      'Mo-Su 09:00-22:00',
    ]) {
      expect(osmFout(goed), goed).toBeNull();
    }
  });
});
