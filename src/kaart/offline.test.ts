import { describe, expect, it } from 'vitest';
import { tegelUrl, tegelsVoorGebied } from './offline';
import { OFFLINE_MAX_TEGELS } from './constanten';
import stedenRuw from '../../data/steden.yaml';
import { stedenBestandSchema } from '@/domein/schema';

describe('tegelsVoorGebied', () => {
  const kyoto = {
    zuidwest: { lat: 34.93, lon: 135.66 },
    noordoost: { lat: 35.08, lon: 135.83 },
  };

  it('geeft één tegel per zoomniveau voor een piepklein gebied', () => {
    const punt = { zuidwest: { lat: 35.0, lon: 135.75 }, noordoost: { lat: 35.0, lon: 135.75 } };
    expect(tegelsVoorGebied(punt, 12, 12)).toEqual([{ z: 12, x: 3592, y: 1622 }]);
  });

  it('telt op naar hogere zoom, want elk niveau is vier keer zoveel', () => {
    const laag = tegelsVoorGebied(kyoto, 12, 12).length;
    const hoog = tegelsVoorGebied(kyoto, 13, 13).length;
    expect(hoog).toBeGreaterThan(laag * 2);
  });

  it('bouwt een geldige tegel-url', () => {
    expect(tegelUrl({ z: 12, x: 3592, y: 1622 })).toBe(
      'https://tile.openstreetmap.org/12/3592/1622.png',
    );
  });
});

describe('de kaartgebieden in de content', () => {
  const steden = stedenBestandSchema.parse(stedenRuw);

  // Deze test bewaakt de belofte uit de constanten: geen enkele stad mag zoveel
  // tegels vragen dat de download tegen de grens aan loopt. Wie een gebied
  // oprekt in steden.yaml krijgt het hier meteen te zien, en niet pas op reis.
  it.each(steden.map((s) => [s.id, s] as const))('houdt %s onder de grens', (_id, stad) => {
    const aantal = tegelsVoorGebied(stad.kaartgebied).length;
    expect(aantal).toBeLessThanOrEqual(OFFLINE_MAX_TEGELS);
  });
});
