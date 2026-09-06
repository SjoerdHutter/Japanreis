import { describe, expect, it } from 'vitest';
import { stukkenVan, tekstVan } from './tekst';
import type { Koersen } from '@/domein/valuta/koers';

const KOERSEN: Koersen = {
  datum: '2026-09-06',
  bron: 'ingebakken',
  perEuro: { JPY: 181.59, VND: 27000 },
};

describe('stukkenVan', () => {
  it('vult een plaatshouder met het bedrag en de euro ernaast', () => {
    const stukken = stukkenVan(
      { tekst: 'Een bento kost {0} na zevenen.', bedragen: [{ bedrag: 500, valuta: 'JPY' }] },
      KOERSEN,
    );
    expect(stukken).toEqual([
      { soort: 'tekst', inhoud: 'Een bento kost ' },
      { soort: 'bedrag', inhoud: '¥500 (EUR 3)' },
      { soort: 'tekst', inhoud: ' na zevenen.' },
    ]);
  });

  it('houdt meerdere bedragen in de goede volgorde', () => {
    expect(
      tekstVan(
        {
          tekst: 'De ene {0}, de andere {1}.',
          bedragen: [
            { bedrag: 22, valuta: 'EUR' },
            { bedrag: 9, valuta: 'EUR' },
          ],
        },
        KOERSEN,
      ),
    ).toBe('De ene EUR 22, de andere EUR 9.');
  });

  it('laat een plaatshouder zonder bedrag staan in plaats van een gat te maken', () => {
    // Kan niet uit het schema komen, wel uit een oude cache. Een zichtbare
    // {3} is beter dan een zin waar de prijs stilletjes uit verdwenen is.
    expect(tekstVan({ tekst: 'Kost {3} ongeveer.' }, KOERSEN)).toBe('Kost {3} ongeveer.');
  });

  it('geeft een tip zonder bedragen ongewijzigd terug', () => {
    const stukken = stukkenVan({ tekst: 'Buig terug naar de herten.' }, KOERSEN);
    expect(stukken).toEqual([{ soort: 'tekst', inhoud: 'Buig terug naar de herten.' }]);
  });

  it('werkt als de zin met een bedrag begint of eindigt', () => {
    expect(
      tekstVan(
        { tekst: '{0} per dag', bedragen: [{ bedrag: 1600, tot: 2800, valuta: 'JPY' }] },
        KOERSEN,
      ),
    ).toBe('¥1.600 tot ¥2.800 (EUR 9 tot 15) per dag');
    expect(
      tekstVan({ tekst: 'vanaf {0}', bedragen: [{ bedrag: 500, valuta: 'JPY' }] }, KOERSEN),
    ).toBe('vanaf ¥500 (EUR 3)');
  });
});
