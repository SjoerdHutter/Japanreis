import { describe, expect, it } from 'vitest';
import type { Reisschema, Stad } from '@/domein/schema';
import { vandaagOpReis } from './vandaag';

const stad = (id: string, tijdzone: string): Stad => ({
  id,
  naam: id,
  land: tijdzone === 'Asia/Tokyo' ? 'japan' : 'vietnam',
  tijdzone,
  valuta: tijdzone === 'Asia/Tokyo' ? 'JPY' : 'VND',
  centrum: { lat: 0, lon: 0 },
  straalKm: 20,
  kaartgebied: { zuidwest: { lat: 0, lon: 0 }, noordoost: { lat: 1, lon: 1 } },
  tijdlijn: 'japan',
  tijdvakken: [],
  korteBeschrijving: '',
  volgorde: 1,
});

const STEDEN = [
  stad('hanoi', 'Asia/Ho_Chi_Minh'),
  stad('osaka', 'Asia/Tokyo'),
  stad('kyoto', 'Asia/Tokyo'),
  stad('tokio', 'Asia/Tokyo'),
];

const SCHEMA: Reisschema = {
  naam: 'Japan en Hanoi',
  segmenten: [
    { stad: 'hanoi', van: '2026-10-04', tot: '2026-10-04' },
    { stad: 'osaka', van: '2026-10-05', tot: '2026-10-06' },
    { stad: 'kyoto', van: '2026-10-08', tot: '2026-10-12' },
    { stad: 'tokio', van: '2026-10-18', tot: '2026-10-23' },
    { stad: 'hanoi', van: '2026-10-23', tot: '2026-10-23' },
  ],
};

const op = (iso: string): string => vandaagOpReis(STEDEN, SCHEMA, new Date(iso));

describe('vandaagOpReis', () => {
  it('geeft om acht uur in Kyoto de dag van Kyoto, niet die van UTC', () => {
    // 08:00 in Kyoto op de negende is 23:00 UTC op de achtste.
    expect(op('2026-10-08T23:00:00Z')).toBe('2026-10-09');
  });

  it('rekent in Hanoi met de tijd van Hanoi', () => {
    // 06:30 in Hanoi is 23:30 UTC de dag ervoor.
    expect(op('2026-10-03T23:30:00Z')).toBe('2026-10-04');
  });

  it('rekent voor de reis met de tijd van thuis, ook net na middernacht', () => {
    // 01:30 thuis op de 29e is in UTC nog de 28e.
    expect(op('2026-09-28T23:30:00Z')).toBe('2026-09-29');
  });

  it('rekent na de reis weer met thuis, ook na de wintertijd', () => {
    // 00:30 thuis op de 26e, in de wintertijd UTC+1.
    expect(op('2026-10-25T23:30:00Z')).toBe('2026-10-26');
  });

  it('begint de terugreisdag in Tokio, ook als het thuis nog avond is', () => {
    // 01:00 in Tokio op de 23e is thuis en in UTC nog de 22e.
    expect(op('2026-10-22T16:00:00Z')).toBe('2026-10-23');
  });

  it('geeft onderweg al de dag van de bestemming', () => {
    // 23:30 op Schiphol is in Hanoi al 04:30 op de vierde.
    expect(op('2026-10-03T21:30:00Z')).toBe('2026-10-04');
  });

  it('valt zonder datums in het reisschema terug op thuis', () => {
    const leeg: Reisschema = { naam: 'x', segmenten: [{ stad: 'kyoto' }] };
    // 18:00 thuis, terwijl het in Japan al de negende is.
    expect(vandaagOpReis(STEDEN, leeg, new Date('2026-10-08T16:00:00Z'))).toBe('2026-10-08');
  });
});
