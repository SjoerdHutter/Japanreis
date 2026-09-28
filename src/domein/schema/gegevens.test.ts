import { describe, expect, it } from 'vitest';
import {
  accommodatieSchema,
  isInternationaalNummer,
  medischSchema,
  schoon,
  telLink,
  utcVan,
  vluchtSchema,
} from './gegevens';

const NU = '2026-09-28T10:00:00.000Z';

describe('telefoonnummers', () => {
  it('neemt een internationaal nummer aan, ook met spaties en haakjes', () => {
    expect(isInternationaalNummer('+31 20 123 4567')).toBe(true);
    expect(isInternationaalNummer('+81 (3) 5776-5400')).toBe(true);
  });

  it('weigert een nummer zonder landnummer, want dat werkt in Japan niet', () => {
    expect(isInternationaalNummer('020 123 4567')).toBe(false);
    expect(isInternationaalNummer('+31 bel me')).toBe(false);
    expect(isInternationaalNummer('+0 123 456 789')).toBe(false);
  });

  it('maakt er een tel-link zonder spaties van', () => {
    expect(telLink('+31 20 123 4567')).toBe('tel:+31201234567');
  });
});

describe('schoon', () => {
  it('haalt lege tekst weg, ook diep in een object', () => {
    expect(
      schoon({ naam: '  Hotel  ', adres: '', incheck: { datum: '2026-10-08', tijd: '' } }),
    ).toEqual({ naam: 'Hotel', incheck: { datum: '2026-10-08' } });
  });

  it('laat getallen, booleans en gevulde lijsten staan', () => {
    expect(schoon({ lat: 0, aan: false, lijst: ['a', '', 'b'], leeg: [''] })).toEqual({
      lat: 0,
      aan: false,
      lijst: ['a', 'b'],
    });
  });
});

describe('vluchten', () => {
  const vlucht = {
    soort: 'vlucht' as const,
    id: 'v1',
    vluchtnummer: 'VN123',
    van: 'HAN',
    naar: 'KIX',
    vertrek: { datum: '2026-10-05', tijd: '00:15', tijdzone: 'Asia/Ho_Chi_Minh' },
    aankomst: { datum: '2026-10-05', tijd: '06:40', tijdzone: 'Asia/Tokyo' },
    gewijzigdOp: NU,
  };

  it('rekent de vertrektijd om naar het echte moment in de zone van vertrek', () => {
    // 00:15 in Hanoi is 17:15 UTC de avond ervoor.
    expect(new Date(utcVan(vlucht.vertrek)!).toISOString()).toBe('2026-10-04T17:15:00.000Z');
  });

  it('accepteert een vlucht die over een tijdzone heen aankomt', () => {
    expect(vluchtSchema.safeParse(vlucht).success).toBe(true);
  });

  it('weigert een aankomst voor het vertrek, en zegt waar het misgaat', () => {
    const fout = vluchtSchema.safeParse({
      ...vlucht,
      aankomst: { datum: '2026-10-04', tijd: '23:00', tijdzone: 'Asia/Tokyo' },
    });
    expect(fout.success).toBe(false);
    expect(fout.error?.issues[0].path).toEqual(['aankomst']);
  });

  it('weigert een tijdzone die niet bestaat', () => {
    expect(
      vluchtSchema.safeParse({
        ...vlucht,
        vertrek: { ...vlucht.vertrek, tijdzone: 'Azie/Hanoi' },
      }).success,
    ).toBe(false);
  });
});

describe('accommodaties en medisch', () => {
  it('weigert een uitcheck die niet na de incheck ligt', () => {
    const uitkomst = accommodatieSchema.safeParse({
      soort: 'accommodatie',
      id: 'a1',
      naam: 'Hotel',
      stadId: 'kyoto',
      incheck: { datum: '2026-10-08' },
      uitcheck: { datum: '2026-10-08' },
      gewijzigdOp: NU,
    });
    expect(uitkomst.success).toBe(false);
  });

  it('kent alleen de vaste allergenen', () => {
    const basis = { soort: 'medisch', id: 'medisch', gewijzigdOp: NU };
    expect(medischSchema.safeParse({ ...basis, allergenen: ['pinda', 'sesam'] }).success).toBe(
      true,
    );
    expect(medischSchema.safeParse({ ...basis, allergenen: ['pindas'] }).success).toBe(false);
    expect(medischSchema.parse(basis).allergenen).toEqual([]);
  });
});
