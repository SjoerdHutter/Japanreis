import { describe, expect, it } from 'vitest';
import { leesImport } from './importeer';
import { maakSjabloon } from './sjabloon';
import { LEGE_GEGEVENS, orden } from './orden';

const NU = '2026-09-28T10:00:00.000Z';
let teller = 0;
const OPTIES = { nieuweId: () => `id-${++teller}`, nu: NU, stadIds: ['kyoto', 'tokio'] };
const LEEG = { gegevens: LEGE_GEGEVENS, reserveringen: [] };

describe('het sjabloon', () => {
  it('leest zijn eigen voorbeeld foutloos in, en waarschuwt voor de voorbeelden', () => {
    const voorstel = leesImport(maakSjabloon(OPTIES.stadIds), LEEG, OPTIES);
    expect(voorstel.fouten).toEqual([]);
    expect(voorstel.regels.map((r) => r.sectie)).toEqual([
      'verzekering',
      'noodcontacten',
      'vluchten',
      'accommodaties',
      'reserveringen',
    ]);
    expect(voorstel.regels.every((r) => r.actie === 'nieuw')).toBe(true);
    expect(voorstel.regels.every((r) => r.voorbeeld)).toBe(true);
  });

  it('slaat een medische sectie met alleen lege velden over', () => {
    const voorstel = leesImport(maakSjabloon(OPTIES.stadIds), LEEG, OPTIES);
    expect(voorstel.regels.some((r) => r.sectie === 'medisch')).toBe(false);
  });

  it('geeft met je huidige gegevens hetzelfde terug, als ongewijzigd', () => {
    const eerste = leesImport(maakSjabloon(OPTIES.stadIds), LEEG, OPTIES);
    const gegevens = orden(
      eerste.regels.flatMap((r) => (r.record.soort === 'gegeven' ? [r.record.waarde] : [])),
    );
    const reserveringen = eerste.regels.flatMap((r) =>
      r.record.soort === 'reservering' ? [r.record.waarde] : [],
    );
    const tweede = leesImport(
      maakSjabloon(OPTIES.stadIds, { gegevens, reserveringen }),
      { gegevens, reserveringen },
      OPTIES,
    );
    expect(tweede.fouten).toEqual([]);
    expect(tweede.regels.every((r) => r.actie === 'ongewijzigd')).toBe(true);
  });
});

describe('samenvoegen', () => {
  const bestaand = {
    gegevens: orden([
      {
        soort: 'verzekering',
        id: 'verzekering',
        maatschappij: 'Oud',
        polisnummer: 'P1',
        gewijzigdOp: NU,
      },
      {
        soort: 'vlucht',
        id: 'v1',
        vluchtnummer: 'VN 123',
        van: 'HAN',
        naar: 'KIX',
        vertrek: { datum: '2026-10-05', tijdzone: 'Asia/Ho_Chi_Minh' },
        aankomst: { datum: '2026-10-05', tijdzone: 'Asia/Tokyo' },
        gewijzigdOp: NU,
      },
    ]),
    reserveringen: [],
  };

  it('laat een leeg veld in het bestand staan wat er al was', () => {
    const voorstel = leesImport(
      { verzekering: { maatschappij: '', noodnummer: '+31 70 111 2222' } },
      bestaand,
      OPTIES,
    );
    const regel = voorstel.regels[0];
    expect(regel.actie).toBe('gewijzigd');
    expect(regel.record.waarde).toMatchObject({
      maatschappij: 'Oud',
      polisnummer: 'P1',
      noodnummer: '+31 70 111 2222',
    });
  });

  it('herkent een vlucht aan nummer en datum, ook met andere spaties', () => {
    const voorstel = leesImport(
      {
        vluchten: [
          {
            vluchtnummer: 'vn123',
            van: 'HAN',
            naar: 'KIX',
            vertrek: { datum: '2026-10-05', tijd: '00:15', tijdzone: 'Asia/Ho_Chi_Minh' },
            aankomst: { datum: '2026-10-05', tijd: '06:40', tijdzone: 'Asia/Tokyo' },
          },
        ],
      },
      bestaand,
      OPTIES,
    );
    expect(voorstel.fouten).toEqual([]);
    expect(voorstel.regels[0].actie).toBe('gewijzigd');
    expect(voorstel.regels[0].record.waarde.id).toBe('v1');
  });

  it('meldt fouten met de plek erbij, en een onbekende stad', () => {
    const voorstel = leesImport(
      {
        vlucht: [],
        noodcontacten: [{ naam: 'A', telefoon: '0612345678' }],
        accommodaties: [
          {
            naam: 'X',
            stadId: 'parijs',
            incheck: { datum: '2026-10-08' },
            uitcheck: { datum: '2026-10-09' },
          },
        ],
      },
      LEEG,
      OPTIES,
    );
    expect(voorstel.fouten).toContain('Onbekend onderdeel "vlucht"; tikfout?');
    expect(voorstel.fouten.some((f) => f.startsWith('Noodcontact 1, telefoon:'))).toBe(true);
    expect(voorstel.fouten).toContain('Accommodatie 1: de stad "parijs" kent de app niet.');
  });

  it('weigert meer dan drie noodcontacten', () => {
    const voorstel = leesImport(
      { noodcontacten: [{ naam: 'A' }, { naam: 'B' }, { naam: 'C' }, { naam: 'D' }] },
      LEEG,
      OPTIES,
    );
    expect(voorstel.fouten.some((f) => f.includes('hoogstens 3'))).toBe(true);
  });

  it('weigert iets wat geen object is', () => {
    expect(leesImport([], LEEG, OPTIES).fouten).toHaveLength(1);
  });
});
