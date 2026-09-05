import { describe, expect, it } from 'vitest';
import type { Traject, Treinpas } from '@/domein/schema';
import { kostenZonderPas, reistijdMinuten, reken, rekenAlles, zoekTraject } from './jrpass';

const traject = (van: string, naar: string, bedrag: number, minuten: number): Traject => ({
  van,
  naar,
  enkeleReis: { bedrag, valuta: 'JPY' },
  minuten,
});

const TOKIO_KYOTO = traject('tokio', 'kyoto', 14000, 160);
const KYOTO_HIROSHIMA = traject('kyoto', 'hiroshima', 11500, 110);
const KYOTO_NARA = traject('kyoto', 'nara', 720, 45);

const PAS_7: Treinpas = {
  id: 'landelijk-7',
  naam: 'JR Pass 7 dagen',
  dagen: 7,
  prijs: { bedrag: 50000, valuta: 'JPY' },
};
const PAS_14: Treinpas = {
  id: 'landelijk-14',
  naam: 'JR Pass 14 dagen',
  dagen: 14,
  prijs: { bedrag: 80000, valuta: 'JPY' },
};

describe('kostenZonderPas', () => {
  it('telt de losse kaartjes op', () => {
    expect(
      kostenZonderPas(
        [
          { traject: TOKIO_KYOTO, aantal: 1 },
          { traject: KYOTO_NARA, aantal: 2 },
        ],
        'JPY',
      ),
    ).toEqual({ bedrag: 14000 + 1440, valuta: 'JPY' });
  });

  it('geeft nul voor een lege lijst', () => {
    expect(kostenZonderPas([], 'JPY')).toEqual({ bedrag: 0, valuta: 'JPY' });
  });
});

describe('reken', () => {
  it('zegt dat een pas niet loont bij één rit heen en terug', () => {
    // Tokio naar Kyoto en terug is ¥28.000; de pas van zeven dagen ¥50.000.
    const uitkomst = reken([{ traject: TOKIO_KYOTO, aantal: 2 }], PAS_7);
    expect(uitkomst.loont).toBe(false);
    expect(uitkomst.losseKaartjes).toEqual({ bedrag: 28000, valuta: 'JPY' });
    expect(uitkomst.tekort).toEqual({ bedrag: 22000, valuta: 'JPY' });
  });

  it('zegt dat een pas wel loont zodra je genoeg ritten maakt', () => {
    const uitkomst = reken(
      [
        { traject: TOKIO_KYOTO, aantal: 1 },
        { traject: KYOTO_HIROSHIMA, aantal: 2 },
        { traject: TOKIO_KYOTO, aantal: 1 },
      ],
      PAS_7,
    );
    // ¥14.000 + ¥23.000 + ¥14.000 = ¥51.000, net boven de pas van ¥50.000.
    expect(uitkomst.losseKaartjes.bedrag).toBe(51000);
    expect(uitkomst.loont).toBe(true);
    expect(uitkomst.verschil).toEqual({ bedrag: 1000, valuta: 'JPY' });
    expect(uitkomst.tekort).toBeNull();
  });

  it('noemt precies quitte niet lonend, want dan betaal je voor niets extra', () => {
    const pas: Treinpas = { ...PAS_7, prijs: { bedrag: 28000, valuta: 'JPY' } };
    const uitkomst = reken([{ traject: TOKIO_KYOTO, aantal: 2 }], pas);
    expect(uitkomst.loont).toBe(false);
    expect(uitkomst.verschil.bedrag).toBe(0);
  });

  it('weigert te rekenen met yen en dong door elkaar', () => {
    const inDong: Traject = { ...TOKIO_KYOTO, enkeleReis: { bedrag: 500000, valuta: 'VND' } };
    expect(() => reken([{ traject: inDong, aantal: 1 }], PAS_7)).toThrow(/valuta/);
  });
});

describe('rekenAlles', () => {
  it('zet de voordeligste keuze bovenaan', () => {
    // Genoeg ritten om de pas van zeven dagen te laten lonen, maar niet die van
    // veertien; dan hoort de goedkoopste bovenaan te staan.
    const ritten = [
      { traject: TOKIO_KYOTO, aantal: 2 },
      { traject: KYOTO_HIROSHIMA, aantal: 2 },
    ];
    const uitkomsten = rekenAlles(ritten, [PAS_14, PAS_7]);
    expect(uitkomsten[0].pas.id).toBe('landelijk-7');
    expect(uitkomsten[0].loont).toBe(true);
    expect(uitkomsten[1].loont).toBe(false);
  });

  it('werkt ook als geen enkele pas uit kan', () => {
    const uitkomsten = rekenAlles([{ traject: KYOTO_NARA, aantal: 2 }], [PAS_7, PAS_14]);
    expect(uitkomsten.every((u) => !u.loont)).toBe(true);
    // Zonder lonende pas is wat je kwijt bent overal gelijk, dus de volgorde
    // mag alles zijn; het gaat erom dat er niets omvalt.
    expect(uitkomsten).toHaveLength(2);
  });
});

describe('reistijdMinuten', () => {
  it('telt de reistijd van alle ritten op', () => {
    expect(
      reistijdMinuten([
        { traject: TOKIO_KYOTO, aantal: 2 },
        { traject: KYOTO_NARA, aantal: 1 },
      ]),
    ).toBe(365);
  });
});

describe('zoekTraject', () => {
  const trajecten = [TOKIO_KYOTO, KYOTO_HIROSHIMA];

  it('vindt een traject in de richting waarin het staat', () => {
    expect(zoekTraject(trajecten, 'tokio', 'kyoto')).toBe(TOKIO_KYOTO);
  });

  it('vindt hetzelfde traject ook andersom, want een trein rijdt twee kanten op', () => {
    expect(zoekTraject(trajecten, 'kyoto', 'tokio')).toBe(TOKIO_KYOTO);
  });

  it('geeft niets terug voor een traject dat er niet in staat', () => {
    expect(zoekTraject(trajecten, 'tokio', 'hanoi')).toBeUndefined();
  });
});
