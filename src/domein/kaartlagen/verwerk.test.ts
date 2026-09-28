import { describe, expect, it } from 'vitest';
import { alsPunt, overpassVraag, pasInGrens, verwerk, type OsmElement } from './verwerk';

const node = (id: number, lat: number, lon: number, tags: Record<string, string>): OsmElement => ({
  type: 'node',
  id,
  lat,
  lon,
  tags,
});

describe('kaartlagen uit OpenStreetMap', () => {
  it('neemt in Japan alleen de automaten van Seven Bank en Japan Post', () => {
    const { geld } = verwerk(
      [
        node(1, 35.0, 135.7, { amenity: 'atm', operator: 'セブン銀行' }),
        node(2, 35.01, 135.7, { amenity: 'atm', operator: 'MUFG' }),
        node(3, 35.02, 135.7, { amenity: 'atm', name: 'ゆうちょ銀行 ATM', opening_hours: '24/7' }),
      ],
      'japan',
    );
    expect(geld.map((p) => p[0])).toEqual([35.0, 35.02]);
    expect(geld[1][4]).toBe('24/7');
  });

  it('telt een 7-Eleven en een postkantoor mee, tenzij er al een automaat staat', () => {
    const { geld } = verwerk(
      [
        node(1, 35.0, 135.7, { amenity: 'atm', operator: 'Seven Bank' }),
        node(2, 35.0001, 135.7001, { shop: 'convenience', brand: 'セブン-イレブン' }),
        node(3, 35.1, 135.8, {
          shop: 'convenience',
          'brand:en': '7-Eleven',
          name: 'セブンイレブン 京都駅前店',
        }),
        node(4, 35.2, 135.9, { amenity: 'post_office', name: '京都中央郵便局' }),
        node(5, 35.3, 135.9, { shop: 'convenience', brand: 'Lawson' }),
      ],
      'japan',
    );
    expect(geld).toHaveLength(3);
    expect(geld[1][3]).toBe('Seven Bank (セブン銀行)');
    expect(geld[2][2]).toBe('Postkantoor 京都中央郵便局');
  });

  it('neemt in Hanoi elke automaat', () => {
    const { geld } = verwerk(
      [node(1, 21.0, 105.8, { amenity: 'atm', operator: 'Vietcombank' })],
      'vietnam',
    );
    expect(geld).toEqual([[21, 105.8, '', 'Vietcombank']]);
  });

  it('laat pakketkluisjes en besloten toiletten weg', () => {
    const { kluisjes, toiletten } = verwerk(
      [
        node(1, 35, 135, { amenity: 'locker', operator: 'JR' }),
        node(2, 35, 135, { amenity: 'locker', locker: 'parcel_pickup' }),
        node(3, 35, 135, { amenity: 'toilets' }),
        node(4, 35, 135, { amenity: 'toilets', access: 'private' }),
      ],
      'japan',
    );
    expect(kluisjes).toHaveLength(1);
    expect(toiletten).toHaveLength(1);
  });

  it('rondt af op vijf decimalen en laat lege velden achteraan weg', () => {
    expect(alsPunt({ lat: 35.123456789, lon: 135.987654321 }, 'x', '', '')).toEqual([
      35.12346,
      135.98765,
      'x',
    ]);
  });

  it('snoeit tot het bestand onder de grens past', () => {
    const veel = Array.from({ length: 5000 }, (_, i) =>
      alsPunt({ lat: 35 + i / 1e4, lon: 135 }, 'Openbaar toilet', 'Kyoto City', '06:00-22:00'),
    );
    const lagen = {
      stad: 'kyoto',
      bron: 'osm',
      opgehaaldOp: 'x',
      geld: [],
      kluisjes: [],
      toiletten: veel,
    };
    const past = pasInGrens(lagen, 150 * 1024);
    expect(past).not.toBeNull();
    expect(new TextEncoder().encode(JSON.stringify(past)).length).toBeLessThanOrEqual(150 * 1024);
    expect(pasInGrens(lagen, 10 * 1024)).toBeNull();
  });

  it('vraagt in Japan ook naar winkels en postkantoren', () => {
    const gebied = { zuid: 34.93, west: 135.66, noord: 35.08, oost: 135.83 };
    expect(overpassVraag(gebied, 'japan')).toContain('post_office');
    expect(overpassVraag(gebied, 'vietnam')).not.toContain('post_office');
    expect(overpassVraag(gebied, 'japan')).toContain('(34.93,135.66,35.08,135.83)');
  });
});
