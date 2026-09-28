import { describe, expect, it } from 'vitest';
import type { Accommodatie, Reisschema, Stad, Vlucht } from '@/domein/schema';
import { nachtenVolgensSchema, reisperiode, watOntbreekt } from './compleet';
import { LEGE_GEGEVENS, orden, verblijfVanNacht } from './orden';

const NU = '2026-09-28T10:00:00.000Z';

const SCHEMA: Reisschema = {
  naam: 'test',
  segmenten: [
    {
      stad: 'hanoi',
      van: '2026-10-04',
      tot: '2026-10-04',
      verblijf: { via: 'anders', nachten: 0 },
    },
    {
      stad: 'osaka',
      van: '2026-10-05',
      tot: '2026-10-06',
      verblijf: { via: 'booking', nachten: 2 },
    },
    { stad: 'shirakawa-go', van: '2026-10-16', tot: '2026-10-16' },
    {
      stad: 'kyoto',
      van: '2026-10-08',
      tot: '2026-10-12',
      verblijf: { via: 'booking', nachten: 5 },
    },
    { stad: 'hanoi', van: '2026-10-23', tot: '2026-10-23' },
  ],
};

const STEDEN = [
  { id: 'osaka', naam: 'Osaka' },
  { id: 'kyoto', naam: 'Kyoto' },
] as Stad[];

const verblijf = (deel: Partial<Accommodatie>): Accommodatie => ({
  soort: 'accommodatie',
  id: 'a',
  naam: 'Hotel',
  stadId: 'kyoto',
  incheck: { datum: '2026-10-08' },
  uitcheck: { datum: '2026-10-13' },
  gewijzigdOp: NU,
  ...deel,
});

const vlucht = (deel: Partial<Vlucht>): Vlucht => ({
  soort: 'vlucht',
  id: 'v',
  vluchtnummer: 'VN1',
  van: 'AMS',
  naar: 'HAN',
  vertrek: { datum: '2026-10-03', tijd: '12:00', tijdzone: 'Europe/Amsterdam' },
  aankomst: { datum: '2026-10-04', tijd: '06:00', tijdzone: 'Asia/Ho_Chi_Minh' },
  gewijzigdOp: NU,
  ...deel,
});

describe('nachten en periode', () => {
  it('telt de nachten uit het schema, niet uit van en tot', () => {
    const nachten = nachtenVolgensSchema(SCHEMA);
    expect(nachten.map((n) => n.datum)).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
    ]);
  });

  it('vindt de eerste en de laatste dag', () => {
    expect(reisperiode(SCHEMA)).toEqual({ van: '2026-10-04', tot: '2026-10-23' });
  });

  it('laat de uitcheckdag niet meetellen als nacht', () => {
    const a = verblijf({});
    expect(verblijfVanNacht('2026-10-12', [a])).toBe(a);
    expect(verblijfVanNacht('2026-10-13', [a])).toBeUndefined();
  });
});

describe('watOntbreekt', () => {
  it('noemt alles als er nog niets is ingevuld', () => {
    const ids = watOntbreekt(LEGE_GEGEVENS, SCHEMA, STEDEN).map((o) => o.id);
    expect(ids).toEqual([
      'noodnummer',
      'polisnummer',
      'noodcontact',
      'verblijf-osaka-2026-10-05',
      'verblijf-kyoto-2026-10-08',
      'vluchten',
    ]);
  });

  it('voegt aaneengesloten nachten samen en vult het formulier voor', () => {
    const kyoto = watOntbreekt(LEGE_GEGEVENS, SCHEMA, STEDEN).find(
      (o) => o.id === 'verblijf-kyoto-2026-10-08',
    );
    expect(kyoto?.tekst).toBe('Waar je slaapt in Kyoto, de nachten van 8 t/m 12 okt');
    expect(kyoto?.nieuw).toEqual({ stadId: 'kyoto', van: '2026-10-08', tot: '2026-10-13' });
  });

  it('is tevreden als alles er staat', () => {
    const gegevens = orden([
      {
        soort: 'verzekering',
        id: 'verzekering',
        noodnummer: '+31 70 000 0000',
        polisnummer: '123',
        gewijzigdOp: NU,
      },
      { soort: 'noodcontact', id: 'c', naam: 'Iemand', gewijzigdOp: NU },
      verblijf({ adresLokaal: '京都' }),
      verblijf({
        id: 'b',
        stadId: 'osaka',
        adresLokaal: '大阪',
        incheck: { datum: '2026-10-05' },
        uitcheck: { datum: '2026-10-07' },
      }),
      vlucht({}),
      vlucht({
        id: 'terug',
        vertrek: { datum: '2026-10-23', tijd: '09:30', tijdzone: 'Asia/Tokyo' },
        aankomst: { datum: '2026-10-23', tijd: '13:00', tijdzone: 'Asia/Ho_Chi_Minh' },
      }),
    ]);
    expect(watOntbreekt(gegevens, SCHEMA, STEDEN)).toEqual([]);
  });

  it('meldt een verblijf zonder lokaal adres en een vlucht zonder tijden', () => {
    const gegevens = orden([
      verblijf({}),
      vlucht({ aankomst: { datum: '2026-10-04', tijdzone: 'Asia/Ho_Chi_Minh' } }),
    ]);
    const ids = watOntbreekt(gegevens, SCHEMA, STEDEN).map((o) => o.id);
    expect(ids).toContain('adres-a');
    expect(ids).toContain('tijden-v');
    expect(ids).toContain('vlucht-terug');
    expect(ids).not.toContain('vlucht-heen');
  });
});
