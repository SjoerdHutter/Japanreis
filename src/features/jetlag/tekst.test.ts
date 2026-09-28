import { describe, expect, it } from 'vitest';
import type { Jetlagdag } from '@/domein/jetlag/protocol';
import { alsDagLabel, alsUren, alsVenster, kernregel, plekVan, regelsVan } from './tekst';

const basis: Jetlagdag = {
  datum: '2026-10-04',
  soort: 'bestemming',
  tijdzone: 'Asia/Ho_Chi_Minh',
  stadIds: ['hanoi'],
  achterstand: 420,
  richting: 'vervroegen',
  aangepast: false,
  dieptepunt: 9 * 60,
  opstaan: null,
  naarBed: null,
  lichtZoeken: { van: 9 * 60, tot: 13 * 60, vanafOpstaan: false },
  lichtMijden: { van: 7 * 60, tot: 9 * 60, vanafOpstaan: true },
  cafeineTot: null,
  melatonine: null,
  nachtvlucht: true,
  naNachtvlucht: true,
};

describe('de losse bouwstenen', () => {
  it('schrijft een datum als woorden', () => {
    expect(alsDagLabel('2026-09-30')).toBe('Woensdag 30 september');
  });

  it('rondt af op halve uren, met een komma', () => {
    expect(alsUren(420)).toBe('7 uur');
    expect(alsUren(-390)).toBe('6,5 uur');
    expect(alsUren(30)).toBe('een half uur');
  });

  it('laat de begintijd weg als het venster bij het opstaan begint', () => {
    expect(alsVenster({ van: 420, tot: 540, vanafOpstaan: true })).toBe('tot 09:00');
    expect(alsVenster({ van: 540, tot: 780, vanafOpstaan: false })).toBe('09:00 tot 13:00');
  });

  it('noemt de stad, of wat voor dag het is', () => {
    const namen: Record<string, string> = { hanoi: 'Hanoi' };
    const naam = (id: string) => namen[id];
    expect(plekVan(basis, naam, 3)).toBe('Hanoi');
    expect(plekVan({ ...basis, soort: 'voorbereiding', volgnummer: 2 }, naam, 3)).toBe(
      'Thuis, voorbereiding 2 van 3',
    );
  });
});

describe('kernregel', () => {
  it('zet in Hanoi eerst het donker en dan het licht', () => {
    expect(kernregel(basis)).toBe(
      'Geen fel licht tot 09:00, fel licht van 09:00 tot 13:00, slapen in het vliegtuig.',
    );
  });

  it('zegt het kort als je al bent aangepast', () => {
    expect(kernregel({ ...basis, aangepast: true })).toBe(
      'Je klok loopt gelijk. Gewoon je eigen ritme.',
    );
  });
});

describe('regelsVan', () => {
  it('zet de regels met een tijd op volgorde van de klok, ook na middernacht', () => {
    const dag: Jetlagdag = {
      ...basis,
      soort: 'thuis',
      richting: 'verlaten',
      achterstand: -300,
      opstaan: 8 * 60,
      naarBed: 30,
      lichtZoeken: { van: 20 * 60, tot: 24 * 60, vanafOpstaan: false },
      lichtMijden: null,
      cafeineTot: 16 * 60 + 30,
      nachtvlucht: false,
      naNachtvlucht: false,
    };
    const tijden = regelsVan(dag)
      .map((r) => r.tijd)
      .filter(Boolean);
    expect(tijden).toEqual(['08:00', 'na 16:30', '20:00 tot 00:00', '00:30']);
  });

  it('gebruikt nergens een streepje als leesteken', () => {
    const alle = [
      ...regelsVan(basis),
      ...regelsVan({ ...basis, soort: 'terugreis' }),
      ...regelsVan({ ...basis, soort: 'vertrek', naNachtvlucht: false }),
    ];
    for (const regel of alle) expect(regel.tekst).not.toMatch(/ [-–—] /);
  });
});
