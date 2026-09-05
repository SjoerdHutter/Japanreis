import { describe, expect, it } from 'vitest';
import type { Koersen } from '@/domein/valuta/koers';
import {
  contantVoorraad,
  haaltTaxFreeDrempel,
  perDag,
  totalen,
  type Opname,
  type Uitgave,
} from './uitgaven';

const KOERSEN: Koersen = {
  perEuro: { JPY: 172, VND: 28500 },
  datum: '2026-01-01',
  bron: 'ingebakken',
};

const uitgave = (
  id: string,
  bedrag: number,
  valuta: 'JPY' | 'VND' | 'EUR',
  contant: boolean,
  categorie: Uitgave['categorie'] = 'eten',
  datum = '2026-04-05',
): Uitgave => ({
  id,
  omschrijving: id,
  bedrag: { bedrag, valuta },
  categorie,
  contant,
  datum,
});

describe('totalen', () => {
  const uitgaven = [
    uitgave('ramen', 1200, 'JPY', true),
    uitgave('museum', 1000, 'JPY', false, 'attracties'),
    uitgave('pho', 50000, 'VND', true),
  ];

  it('telt alles op in euro, want yen en dong optellen betekent niets', () => {
    const uit = totalen(uitgaven, KOERSEN);
    // ¥2.200 is ongeveer EUR 12,8 en ₫50.000 ongeveer EUR 1,8.
    expect(uit.euro).toBeCloseTo(2200 / 172 + 50000 / 28500, 5);
  });

  it('houdt de bedragen per valuta apart, want dat zit er in je portemonnee', () => {
    const uit = totalen(uitgaven, KOERSEN);
    expect(uit.perValuta.get('JPY')).toBe(2200);
    expect(uit.perValuta.get('VND')).toBe(50000);
  });

  it('houdt contant en kaart apart', () => {
    const uit = totalen(uitgaven, KOERSEN);
    expect(uit.contantEuro).toBeCloseTo(1200 / 172 + 50000 / 28500, 5);
    expect(uit.kaartEuro).toBeCloseTo(1000 / 172, 5);
    expect(uit.contantEuro + uit.kaartEuro).toBeCloseTo(uit.euro, 5);
  });

  it('telt per categorie', () => {
    const uit = totalen(uitgaven, KOERSEN);
    expect(uit.perCategorie.get('attracties')).toBeCloseTo(1000 / 172, 5);
    expect(uit.perCategorie.get('vervoer')).toBeUndefined();
  });

  it('rekent een bedrag dat al in euro staat niet nog een keer om', () => {
    const uit = totalen([uitgave('vlucht', 700, 'EUR', false, 'vervoer')], KOERSEN);
    expect(uit.euro).toBe(700);
  });

  it('geeft nul terug voor een lege lijst', () => {
    const uit = totalen([], KOERSEN);
    expect(uit.euro).toBe(0);
    expect(uit.perValuta.size).toBe(0);
  });
});

describe('contantVoorraad', () => {
  const opnames: Opname[] = [
    { id: 'a', bedrag: { bedrag: 30000, valuta: 'JPY' }, datum: '2026-04-02' },
    { id: 'b', bedrag: { bedrag: 2000000, valuta: 'VND' }, datum: '2026-04-01' },
  ];

  it('trekt contante uitgaven af van wat je hebt opgenomen', () => {
    const voorraad = contantVoorraad(opnames, [
      uitgave('ramen', 1200, 'JPY', true),
      uitgave('pho', 50000, 'VND', true),
    ]);
    expect(voorraad.get('JPY')).toBe(28800);
    expect(voorraad.get('VND')).toBe(1950000);
  });

  it('laat uitgaven met kaart de contantvoorraad ongemoeid', () => {
    const voorraad = contantVoorraad(opnames, [uitgave('hotel', 20000, 'JPY', false, 'verblijf')]);
    expect(voorraad.get('JPY')).toBe(30000);
  });

  it('mag negatief worden, want dan ben je iets vergeten in te voeren', () => {
    // Liever een getal dat zichtbaar niet klopt dan een dat stilletjes op nul
    // blijft staan en doet alsof de boekhouding rond is.
    const voorraad = contantVoorraad([], [uitgave('ramen', 1200, 'JPY', true)]);
    expect(voorraad.get('JPY')).toBe(-1200);
  });
});

describe('perDag', () => {
  it('groepeert per dag, nieuwste eerst', () => {
    const dagen = perDag([
      uitgave('a', 100, 'JPY', true, 'eten', '2026-04-05'),
      uitgave('b', 200, 'JPY', true, 'eten', '2026-04-07'),
      uitgave('c', 300, 'JPY', true, 'eten', '2026-04-05'),
    ]);
    expect(dagen.map((d) => d.datum)).toEqual(['2026-04-07', '2026-04-05']);
    expect(dagen[1].uitgaven).toHaveLength(2);
  });
});

describe('haaltTaxFreeDrempel', () => {
  it('kent de drempel van ¥5.000 per winkel per dag', () => {
    expect(haaltTaxFreeDrempel({ bedrag: 5000, valuta: 'JPY' })).toBe(true);
    expect(haaltTaxFreeDrempel({ bedrag: 4999, valuta: 'JPY' })).toBe(false);
  });

  it('geldt niet buiten Japan', () => {
    expect(haaltTaxFreeDrempel({ bedrag: 5000000, valuta: 'VND' })).toBe(false);
  });
});
