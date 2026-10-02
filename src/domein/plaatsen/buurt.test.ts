import { describe, expect, it } from 'vitest';
import type { Plaats } from '@/domein/schema';
import { etenInDeBuurt, top20, vlakbij } from './buurt';

const plek = (id: string, deel: Partial<Plaats>): Plaats => ({
  id,
  naam: id,
  stad: 'hanoi',
  categorie: 'attractie',
  attractie: { type: 'museum' },
  ...deel,
});

// Rond het Hoan Kiem meer; 0,001 graad is ruim honderd meter.
const meer = plek('meer', { rang: 1, coordinaten: { lat: 21.0287, lon: 105.8524 } });
const tempel = plek('tempel', {
  onderdeelVan: 'meer',
  coordinaten: { lat: 21.0308, lon: 105.8525 },
});
const museum = plek('museum', { rang: 2, coordinaten: { lat: 21.0257, lon: 105.8465 } });
const koffie = plek('koffie', {
  categorie: 'eten',
  attractie: undefined,
  eten: { keuken: 'koffie' },
  inDeBuurtVan: ['meer'],
  coordinaten: { lat: 21.0334, lon: 105.8524 },
});
const pho = plek('pho', {
  categorie: 'eten',
  attractie: undefined,
  eten: { keuken: 'pho' },
  coordinaten: { lat: 21.0292, lon: 105.8526 },
});
const ver = plek('ver', {
  categorie: 'eten',
  attractie: undefined,
  eten: { keuken: 'restaurant' },
  coordinaten: { lat: 21.06, lon: 105.82 },
});
const zonderPlek = plek('zonder', {
  categorie: 'eten',
  attractie: undefined,
  eten: { keuken: 'bar' },
  inDeBuurtVan: ['meer'],
});

const alle = [meer, tempel, museum, koffie, pho, ver, zonderPlek];

describe('top20', () => {
  it('zet de plekken op rang, met de onderdelen onder hun hoofdplek', () => {
    const lijst = top20(alle);
    expect(lijst.map((r) => r.plaats.id)).toEqual(['meer', 'museum']);
    expect(lijst[0].onderdelen.map((p) => p.id)).toEqual(['tempel']);
    expect(lijst[1].onderdelen).toEqual([]);
  });
});

describe('etenInDeBuurt', () => {
  it('zet gekoppelde plekken eerst, dan wat binnen 800 meter ligt, op looptijd', () => {
    const uitkomst = etenInDeBuurt(meer, alle);
    expect(uitkomst.map((b) => [b.plaats.id, b.gekoppeld])).toEqual([
      ['koffie', true],
      ['zonder', true],
      ['pho', false],
    ]);
    expect(uitkomst[0].minuten).toBeGreaterThan(0);
    expect(uitkomst[1].minuten).toBeNull();
  });

  it('laat plekken verder dan 800 meter weg als ze niet gekoppeld zijn', () => {
    expect(etenInDeBuurt(meer, alle).some((b) => b.plaats.id === 'ver')).toBe(false);
  });
});

describe('vlakbij', () => {
  it('geeft voor een eetplek eerst zijn eigen koppelingen, dan wat dichtbij ligt', () => {
    expect(vlakbij(koffie, alle).map((b) => [b.plaats.id, b.gekoppeld])).toEqual([
      ['meer', true],
      ['tempel', false],
    ]);
  });
});
