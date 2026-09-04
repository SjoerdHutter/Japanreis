import { describe, expect, it } from 'vitest';
import {
  PRIJSKLASSEN,
  formatteerBedrag,
  formatteerEuro,
  formatteerLokaal,
  formatteerPrijs,
  formatteerPrijsklasse,
  naarEuro,
  prijsklasseVan,
} from './formatteer';
import type { Koersen } from './koers';

/** De koers die de voorbeelden uit de functiespecificatie oplevert. */
const KOERSEN: Koersen = {
  perEuro: { JPY: 172, VND: 28500 },
  datum: '2026-01-01',
  bron: 'ingebakken',
};

describe('formatteerLokaal', () => {
  it('zet een punt als duizendtal, zoals we dat in het Nederlands schrijven', () => {
    expect(formatteerLokaal(1200, 'JPY')).toBe('¥1.200');
    expect(formatteerLokaal(50000, 'VND')).toBe('₫50.000');
  });
});

describe('formatteerBedrag', () => {
  it('doet het voorbeeld uit de specificatie: ¥1.200 (EUR 7)', () => {
    expect(formatteerBedrag({ bedrag: 1200, valuta: 'JPY' }, KOERSEN)).toBe('¥1.200 (EUR 7)');
  });

  it('doet de prijsklassen uit hoofdstuk 3', () => {
    expect(formatteerBedrag({ bedrag: 1500, valuta: 'JPY' }, KOERSEN)).toBe('¥1.500 (EUR 9)');
    expect(formatteerBedrag({ bedrag: 4000, valuta: 'JPY' }, KOERSEN)).toBe('¥4.000 (EUR 23)');
    expect(formatteerBedrag({ bedrag: 10000, valuta: 'JPY' }, KOERSEN)).toBe('¥10.000 (EUR 58)');
  });

  it('doet het voorbeeld van de JR Pass: ¥80.000 (EUR 465)', () => {
    expect(formatteerBedrag({ bedrag: 80000, valuta: 'JPY' }, KOERSEN)).toBe('¥80.000 (EUR 465)');
  });

  it('zet bij een reeks maar één keer haakjes, zoals bij een goshuin', () => {
    expect(formatteerBedrag({ bedrag: 300, tot: 500, valuta: 'JPY' }, KOERSEN)).toBe(
      '¥300 tot ¥500 (EUR 2 tot 3)',
    );
  });

  it('trekt een reeks samen als beide kanten op hetzelfde hele bedrag uitkomen', () => {
    expect(formatteerBedrag({ bedrag: 300, tot: 340, valuta: 'JPY' }, KOERSEN)).toBe(
      '¥300 tot ¥340 (EUR 2)',
    );
  });

  it('rekent ook dong om', () => {
    expect(formatteerBedrag({ bedrag: 50000, valuta: 'VND' }, KOERSEN)).toBe('₫50.000 (EUR 2)');
  });

  it('zet geen haakjes bij een bedrag dat al in euro staat', () => {
    expect(formatteerBedrag({ bedrag: 45, valuta: 'EUR' }, KOERSEN)).toBe('EUR 45');
  });

  it('zegt bij een kleine post niet EUR 0, want dat leest als gratis', () => {
    expect(formatteerBedrag({ bedrag: 50, valuta: 'JPY' }, KOERSEN)).toBe('¥50 (minder dan EUR 1)');
  });
});

describe('formatteerPrijs', () => {
  it('houdt gratis gratis, en maakt er geen nul van', () => {
    expect(formatteerPrijs('gratis', KOERSEN)).toBe('gratis');
  });
});

describe('naarEuro', () => {
  it('rekent met de koers die meegegeven wordt en niet met een eigen aanname', () => {
    expect(naarEuro(1720, 'JPY', KOERSEN)).toBeCloseTo(10, 6);
  });

  it('geeft niets terug voor euro zelf', () => {
    expect(naarEuro(10, 'EUR', KOERSEN)).toBeNull();
  });

  it('valt niet om op een koers van nul', () => {
    const stuk: Koersen = { ...KOERSEN, perEuro: { JPY: 0, VND: 0 } };
    expect(naarEuro(1000, 'JPY', stuk)).toBeNull();
    expect(formatteerBedrag({ bedrag: 1000, valuta: 'JPY' }, stuk)).toBe('¥1.000');
  });
});

describe('formatteerEuro', () => {
  it('rondt af op hele euro', () => {
    expect(formatteerEuro(6.98)).toBe('EUR 7');
    expect(formatteerEuro(464.6)).toBe('EUR 465');
  });
});

describe('prijsklassen', () => {
  it('schrijft de klassen uit zoals in de specificatie', () => {
    const [een, twee, drie, vier] = PRIJSKLASSEN.JPY;
    expect(formatteerPrijsklasse(een, KOERSEN)).toBe('tot ¥1.500 (tot EUR 9)');
    expect(formatteerPrijsklasse(twee, KOERSEN)).toBe('¥1.500 tot ¥4.000 (EUR 9 tot 23)');
    expect(formatteerPrijsklasse(drie, KOERSEN)).toBe('¥4.000 tot ¥10.000 (EUR 23 tot 58)');
    expect(formatteerPrijsklasse(vier, KOERSEN)).toBe('¥10.000 en hoger (EUR 58 en hoger)');
  });

  it('deelt een bedrag in de juiste klasse in, met de grens naar boven open', () => {
    expect(prijsklasseVan({ bedrag: 900, valuta: 'JPY' })?.id).toBe('jpy-1');
    expect(prijsklasseVan({ bedrag: 1500, valuta: 'JPY' })?.id).toBe('jpy-2');
    expect(prijsklasseVan({ bedrag: 25000, valuta: 'JPY' })?.id).toBe('jpy-4');
    expect(prijsklasseVan({ bedrag: 50000, valuta: 'VND' })?.id).toBe('vnd-1');
  });
});
