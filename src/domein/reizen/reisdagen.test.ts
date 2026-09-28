import { describe, expect, it } from 'vitest';
import type { Reisdag } from '@/domein/schema';
import {
  alternatieven,
  hoofdroute,
  reisdagenRondom,
  reistijd,
  reserveringNodig,
  routeLink,
} from './reisdagen';

const OSAKA_HIROSHIMA: Reisdag = {
  id: 'osaka-hiroshima',
  datum: '2026-10-07',
  titel: 'Van Osaka naar Hiroshima',
  van: 'osaka',
  naar: 'hiroshima',
  stappen: [
    {
      vervoer: 'trein',
      naam: 'JR Kyoto-lijn',
      van: 'Osaka Station',
      naar: 'Shin-Osaka Station',
      minuten: 5,
      reserveren: 'niet-nodig',
    },
    {
      vervoer: 'shinkansen',
      naam: 'Nozomi',
      van: 'Shin-Osaka Station',
      naar: 'Hiroshima Station',
      minuten: 85,
      reserveren: 'aanbevolen',
    },
    {
      vervoer: 'bus',
      naam: 'Nachtbus',
      van: 'Umeda',
      naar: 'Hiroshima Station',
      minuten: 300,
      alternatief: true,
    },
  ],
};

const FUJI: Reisdag = {
  id: 'fuji',
  wanneer: 'Een dag bij helder weer',
  titel: 'Dagtrip naar de Fuji',
  naar: 'fujikawaguchiko',
  stappen: [
    {
      vervoer: 'limited-express',
      naam: 'Fuji Excursion',
      van: 'Shinjuku Station',
      naar: 'Kawaguchiko Station',
      minuten: 115,
      reserveren: 'verplicht',
    },
  ],
};

const REISDAGEN = [OSAKA_HIROSHIMA, FUJI];

describe('reisdagenRondom', () => {
  const USJ: Reisdag = { ...OSAKA_HIROSHIMA, id: 'usj', datum: '2026-10-06', titel: 'Naar USJ' };

  it('geeft de reisdag van vandaag', () => {
    expect(reisdagenRondom(REISDAGEN, '2026-10-07')).toEqual([
      { reisdag: OSAKA_HIROSHIMA, wanneer: 'vandaag' },
    ]);
  });

  it('kondigt hem de avond ervoor al aan', () => {
    expect(reisdagenRondom(REISDAGEN, '2026-10-06').map((r) => r.wanneer)).toEqual(['morgen']);
  });

  it('geeft vandaag en morgen allebei als ze er allebei zijn, vandaag eerst', () => {
    expect(
      reisdagenRondom([OSAKA_HIROSHIMA, USJ], '2026-10-06').map((r) => [r.reisdag.id, r.wanneer]),
    ).toEqual([
      ['usj', 'vandaag'],
      ['osaka-hiroshima', 'morgen'],
    ]);
  });

  it('kijkt ook over een maandgrens naar morgen', () => {
    const eersteNovember: Reisdag = { ...OSAKA_HIROSHIMA, datum: '2026-11-01' };
    expect(reisdagenRondom([eersteNovember], '2026-10-31')[0]?.wanneer).toBe('morgen');
  });

  it('zegt niets op een dag zonder reis, en niets over een dag zonder datum', () => {
    expect(reisdagenRondom(REISDAGEN, '2026-10-10')).toEqual([]);
  });
});

describe('de route van een dag', () => {
  it('telt alleen de stappen die je neemt, niet de alternatieven', () => {
    expect(hoofdroute(OSAKA_HIROSHIMA).map((s) => s.naam)).toEqual(['JR Kyoto-lijn', 'Nozomi']);
    expect(alternatieven(OSAKA_HIROSHIMA).map((s) => s.naam)).toEqual(['Nachtbus']);
    expect(reistijd(OSAKA_HIROSHIMA)).toBe(90);
  });

  it('zegt of er gereserveerd moet worden, met verplicht boven aanbevolen', () => {
    expect(reserveringNodig(OSAKA_HIROSHIMA)).toBe('aanbevolen');
    expect(reserveringNodig(FUJI)).toBe('verplicht');
  });
});

describe('routeLink', () => {
  it('opent de route met het openbaar vervoer, met veilig gecodeerde namen', () => {
    const link = new URL(routeLink({ van: 'Shin-Osaka Station', naar: 'Busta Shinjuku & co' }));
    expect(link.origin).toBe('https://www.google.com');
    expect(link.searchParams.get('origin')).toBe('Shin-Osaka Station');
    expect(link.searchParams.get('destination')).toBe('Busta Shinjuku & co');
    expect(link.searchParams.get('travelmode')).toBe('transit');
  });
});
