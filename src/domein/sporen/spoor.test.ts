import { describe, expect, it } from 'vitest';
import type { Stad } from '@/domein/schema';
import {
  afstandM,
  alsDuur,
  alsSamenvatting,
  alsSvg,
  bewegingstijdS,
  dagVanSpoor,
  hoogteverschil,
  vereenvoudig,
  verwerkSpoor,
  type Segment,
} from './spoor';

const stad = (id: string, lat: number, lon: number, tijdzone: string): Stad => ({
  id,
  naam: id,
  land: tijdzone === 'Asia/Tokyo' ? 'japan' : 'vietnam',
  tijdzone,
  valuta: tijdzone === 'Asia/Tokyo' ? 'JPY' : 'VND',
  centrum: { lat, lon },
  straalKm: 20,
  kaartgebied: {
    zuidwest: { lat: lat - 0.1, lon: lon - 0.1 },
    noordoost: { lat: lat + 0.1, lon: lon + 0.1 },
  },
  tijdlijn: 'japan',
  tijdvakken: [],
  korteBeschrijving: '',
  volgorde: 1,
});
const STEDEN = [
  stad('kyoto', 35.0116, 135.7681, 'Asia/Tokyo'),
  stad('hanoi', 21.0285, 105.8542, 'Asia/Ho_Chi_Minh'),
];

// Een rechte lijn naar het noorden: 0,001 graad breedte is ongeveer 111 meter.
const noordwaarts = (
  aantal: number,
  start = 35,
  stapS = 60,
  ele?: (i: number) => number,
): Segment =>
  Array.from({ length: aantal }, (_, i) => ({
    lat: start + i * 0.001,
    lon: 135.76,
    tijd: Date.UTC(2026, 9, 9, 0, 0) + i * stapS * 1000,
    ...(ele ? { ele: ele(i) } : {}),
  }));

describe('afstand', () => {
  it('telt de lijn per stuk op en niet de sprong ertussen', () => {
    const a = noordwaarts(11);
    expect(afstandM([a])).toBeGreaterThan(1100);
    expect(afstandM([a])).toBeLessThan(1125);
    const b = noordwaarts(11, 36);
    expect(afstandM([a, b])).toBeCloseTo(afstandM([a]) * 2, 0);
  });
});

describe('hoogte', () => {
  it('negeert ruis onder de drempel', () => {
    const ruis = noordwaarts(40, 35, 10, (i) => 50 + (i % 2 === 0 ? 0 : 2));
    expect(hoogteverschil([ruis])).toEqual({ stijgingM: 0, dalingM: 0 });
  });

  it('telt een echte klim en afdaling', () => {
    const heuvel = noordwaarts(21, 35, 60, (i) => (i <= 10 ? 100 + i * 10 : 200 - (i - 10) * 10));
    expect(hoogteverschil([heuvel])).toEqual({ stijgingM: 100, dalingM: 100 });
  });

  it('geeft niets zonder hoogte', () => {
    expect(hoogteverschil([noordwaarts(5)])).toBeUndefined();
  });
});

describe('tijd in beweging', () => {
  it('telt stilstaan en gaten niet mee', () => {
    const lopen = noordwaarts(11, 35, 60); // 111 m per minuut
    const stil: Segment = Array.from({ length: 5 }, (_, i) => ({
      lat: lopen[10].lat,
      lon: lopen[10].lon,
      tijd: lopen[10].tijd! + (i + 1) * 60_000,
    }));
    const naGat = noordwaarts(3, lopen[10].lat + 0.001, 60).map((p) => ({
      ...p,
      tijd: p.tijd! + 3 * 3600_000,
    }));
    expect(bewegingstijdS([[...lopen, ...stil, ...naGat]])).toBe(10 * 60 + 2 * 60);
  });

  it('geeft niets zonder tijden', () => {
    expect(
      bewegingstijdS([
        [
          { lat: 1, lon: 1 },
          { lat: 2, lon: 2 },
        ],
      ]),
    ).toBeUndefined();
  });
});

describe('vereenvoudigen', () => {
  it('laat punten op een rechte lijn weg en houdt de hoeken', () => {
    const recht = noordwaarts(100);
    expect(vereenvoudig(recht)).toHaveLength(2);
    const hoek = [
      ...noordwaarts(50),
      ...noordwaarts(50).map((p, i) => ({ ...p, lat: 35.049, lon: 135.76 + (i + 1) * 0.001 })),
    ];
    const kort = vereenvoudig(hoek);
    expect(kort).toHaveLength(3);
    expect(kort[1]).toEqual([35.049, 135.76]);
  });

  it('kan twintigduizend punten aan', () => {
    const veel = Array.from({ length: 20_000 }, (_, i) => ({
      lat: 35 + i * 0.00001,
      lon: 135.76 + Math.sin(i / 50) * 0.001,
    }));
    const kort = vereenvoudig(veel);
    expect(kort.length).toBeLessThan(2000);
    expect(kort.length).toBeGreaterThan(10);
  });
});

describe('de dag', () => {
  it('neemt de datum in de zone van de stad waar het begint', () => {
    // 22:30 UTC op 8 oktober is 07:30 op 9 oktober in Kyoto.
    const vroeg: Segment = [{ lat: 35.0, lon: 135.76, tijd: Date.UTC(2026, 9, 8, 22, 30) }];
    expect(dagVanSpoor([vroeg], STEDEN)).toBe('2026-10-09');
    // In Hanoi is dat 05:30 op 9 oktober.
    const hanoi: Segment = [{ lat: 21.03, lon: 105.85, tijd: Date.UTC(2026, 9, 8, 22, 30) }];
    expect(dagVanSpoor([hanoi], STEDEN)).toBe('2026-10-09');
    const laat: Segment = [{ lat: 21.03, lon: 105.85, tijd: Date.UTC(2026, 9, 8, 15, 0) }];
    expect(dagVanSpoor([laat], STEDEN)).toBe('2026-10-08');
  });

  it('weet het niet zonder tijden', () => {
    expect(dagVanSpoor([[{ lat: 35, lon: 135.76 }]], STEDEN)).toBeUndefined();
  });
});

describe('verwerken', () => {
  it('geeft lijnen, cijfers en een dag', () => {
    const uitkomst = verwerkSpoor([noordwaarts(61, 35, 60, (i) => 100 + i), []], STEDEN);
    expect(uitkomst.lijnen).toHaveLength(1);
    expect(uitkomst.lijnen[0]).toHaveLength(2);
    expect(uitkomst.datum).toBe('2026-10-09');
    expect(uitkomst.statistiek.punten).toBe(61);
    expect(uitkomst.statistiek.duurS).toBe(3600);
    expect(uitkomst.statistiek.bewegingS).toBe(3600);
    expect(uitkomst.statistiek.stijgingM).toBe(60);
    expect(uitkomst.statistiek.begin).toBe('2026-10-09T00:00:00.000Z');
    expect(alsSamenvatting(uitkomst.statistiek)).toBe('6,7 km, 60 m klimmen, 1 u in beweging');
  });
});

describe('weergave', () => {
  it('schrijft duur en afstand zoals je ze zegt', () => {
    expect(alsDuur(45 * 60)).toBe('45 min');
    expect(alsDuur(200 * 60)).toBe('3 u 20 min');
    expect(alsSamenvatting({ afstandM: 850, punten: 2 })).toBe('850 m');
  });

  it('tekent een svg met een lijn per stuk', () => {
    const svg = alsSvg([
      {
        lijnen: [
          [
            [35, 135],
            [35.01, 135.01],
          ],
        ],
        kleur: '#dc2626',
      },
    ]);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('stroke="#dc2626"');
    expect(svg.match(/<polyline/g)).toHaveLength(1);
    expect(alsSvg([{ lijnen: [[[35, 135]]], kleur: '#dc2626' }])).toBe('');
  });
});
