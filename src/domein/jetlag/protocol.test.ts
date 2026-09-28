import { describe, expect, it } from 'vitest';
import type { Reisschema } from '@/domein/schema';
import {
  STANDAARD_INSTELLINGEN,
  dagVanVandaag,
  maakJetlagplan,
  plusDagen,
  type JetlagInstellingen,
  type Jetlagdag,
  type Jetlagplan,
} from './protocol';

const STEDEN = [
  { id: 'hanoi', tijdzone: 'Asia/Ho_Chi_Minh' },
  { id: 'osaka', tijdzone: 'Asia/Tokyo' },
  { id: 'hiroshima', tijdzone: 'Asia/Tokyo' },
  { id: 'kyoto', tijdzone: 'Asia/Tokyo' },
  { id: 'tokio', tijdzone: 'Asia/Tokyo' },
];

/** De echte reis, ingekort: 13 tot en met 17 oktober ontbreekt met opzet. */
const SCHEMA: Reisschema = {
  naam: 'Japan en Hanoi',
  segmenten: [
    {
      stad: 'hanoi',
      van: '2026-10-04',
      tot: '2026-10-04',
      verblijf: { via: 'nog-te-boeken', nachten: 0 },
    },
    {
      stad: 'osaka',
      van: '2026-10-05',
      tot: '2026-10-06',
      verblijf: { via: 'booking', nachten: 2 },
    },
    { stad: 'hiroshima', van: '2026-10-07', tot: '2026-10-07' },
    { stad: 'kyoto', van: '2026-10-08', tot: '2026-10-12' },
    {
      stad: 'tokio',
      van: '2026-10-18',
      tot: '2026-10-23',
      verblijf: { via: 'airbnb', nachten: 5 },
    },
    { stad: 'hanoi', van: '2026-10-23', tot: '2026-10-23' },
  ],
};

const plan = (instellingen: Partial<JetlagInstellingen> = {}): Jetlagplan => {
  const uitkomst = maakJetlagplan({
    reisschema: SCHEMA,
    steden: STEDEN,
    instellingen: { ...STANDAARD_INSTELLINGEN, ...instellingen },
  });
  if (!uitkomst) throw new Error('geen plan');
  return uitkomst;
};

const dag = (p: Jetlagplan, datum: string): Jetlagdag => {
  const gevonden = [...p.heen, ...p.terug].find((d) => d.datum === datum);
  if (!gevonden) throw new Error(`geen dag ${datum}`);
  return gevonden;
};

/** "07:00" als minuten na middernacht, zodat de verwachtingen leesbaar blijven. */
const om = (tijd: string): number => {
  const [uur, minuut] = tijd.split(':').map(Number);
  return uur * 60 + minuut;
};

describe('maakJetlagplan, de heenreis', () => {
  it('vertrekt de dag voor de eerste dag in het reisschema', () => {
    const p = plan();
    expect(p.vertrekdag).toBe('2026-10-03');
    expect(p.hoofdbestemming).toBe('Asia/Tokyo');
    // Thuis is het in oktober nog zomertijd, dus Japan loopt zeven uur voor.
    expect(p.verschilHeen).toBe(420);
  });

  it('begint drie dagen voor vertrek met voorbereiden', () => {
    const p = plan();
    expect(p.heen.slice(0, 4).map((d) => [d.datum, d.soort])).toEqual([
      ['2026-09-30', 'voorbereiding'],
      ['2026-10-01', 'voorbereiding'],
      ['2026-10-02', 'voorbereiding'],
      ['2026-10-03', 'vertrek'],
    ]);
    expect(p.heen.map((d) => d.volgnummer).slice(0, 3)).toEqual([1, 2, 3]);
  });

  it('schuift thuis elke dag een uur op, met fel licht direct na het opstaan', () => {
    const p = plan();
    const eerste = dag(p, '2026-09-30');
    expect(eerste.opstaan).toBe(om('07:00'));
    expect(eerste.naarBed).toBe(om('22:00'));
    expect(eerste.lichtZoeken).toEqual({ van: om('07:00'), tot: om('08:00'), vanafOpstaan: true });
    expect(eerste.lichtMijden).toBeNull();

    const tweede = dag(p, '2026-10-01');
    expect(tweede.opstaan).toBe(om('06:00'));
    expect(tweede.naarBed).toBe(om('21:00'));
    expect(tweede.lichtZoeken).toEqual({ van: om('06:00'), tot: om('07:00'), vanafOpstaan: true });

    const derde = dag(p, '2026-10-02');
    expect(derde.opstaan).toBe(om('05:00'));
    expect(derde.naarBed).toBe(om('20:00'));
    expect(derde.cafeineTot).toBe(om('12:00'));
  });

  it('laat je op de vertrekdag vroeg opstaan en de nacht in het vliegtuig slapen', () => {
    const vertrek = dag(plan(), '2026-10-03');
    expect(vertrek.opstaan).toBe(om('04:00'));
    expect(vertrek.naarBed).toBeNull();
    expect(vertrek.nachtvlucht).toBe(true);
    expect(vertrek.lichtZoeken).toEqual({ van: om('04:00'), tot: om('05:00'), vanafOpstaan: true });
  });

  it('rekent de overstap in Hanoi al naar Japan toe, in de tijd van Hanoi', () => {
    const hanoi = dag(plan(), '2026-10-04');
    expect(hanoi.tijdzone).toBe('Asia/Ho_Chi_Minh');
    expect(hanoi.naNachtvlucht).toBe(true);
    // Geen bed in Hanoi en morgen in Osaka: de nacht zit je weer in het vliegtuig.
    expect(hanoi.nachtvlucht).toBe(true);
    expect(hanoi.naarBed).toBeNull();
    // Drie uur voorbereid, dus nog vier te gaan naar Japan, niet twee naar Vietnam.
    expect(hanoi.achterstand).toBe(240);
    expect(hanoi.richting).toBe('vervroegen');
    expect(hanoi.dieptepunt).toBe(om('06:00'));
    expect(hanoi.lichtZoeken).toEqual({ van: om('07:00'), tot: om('10:00'), vanafOpstaan: true });
    expect(hanoi.lichtMijden).toBeNull();
  });

  it('volgt in Japan de lokale klok, met het licht elke dag een uur eerder', () => {
    const p = plan();
    const osaka = dag(p, '2026-10-05');
    expect(osaka.naNachtvlucht).toBe(true);
    expect(osaka.opstaan).toBeNull();
    expect(osaka.naarBed).toBe(om('23:00'));
    expect(osaka.achterstand).toBe(180);
    expect(osaka.dieptepunt).toBe(om('07:00'));
    expect(osaka.lichtZoeken).toEqual({ van: om('07:00'), tot: om('11:00'), vanafOpstaan: true });
    expect(osaka.cafeineTot).toBe(om('15:00'));

    expect(dag(p, '2026-10-06').dieptepunt).toBe(om('06:00'));
    expect(dag(p, '2026-10-06').opstaan).toBe(om('07:00'));
    expect(dag(p, '2026-10-07').achterstand).toBe(60);
  });

  it('is op de eerste dag in Kyoto aangepast, en daar houdt de heenreis op', () => {
    const p = plan();
    const laatste = p.heen[p.heen.length - 1];
    expect(laatste.datum).toBe('2026-10-08');
    expect(laatste.aangepast).toBe(true);
    expect(laatste.lichtZoeken).toBeNull();
    expect(laatste.cafeineTot).toBeNull();
    expect(laatste.stadIds).toEqual(['kyoto']);
  });

  it('zegt zonder voorbereiding in Hanoi eerst: geen fel licht', () => {
    const p = plan({ voorbereidingsdagen: 0 });
    expect(p.heen[0].soort).toBe('vertrek');
    expect(p.heen[0].opstaan).toBe(om('07:00'));

    const hanoi = dag(p, '2026-10-04');
    expect(hanoi.achterstand).toBe(420);
    // Je lichaam zit om 09:00 in Hanoi nog in de nacht. Licht voor dat moment
    // duwt je klok de verkeerde kant op.
    expect(hanoi.dieptepunt).toBe(om('09:00'));
    expect(hanoi.lichtMijden).toEqual({ van: om('07:00'), tot: om('09:00'), vanafOpstaan: true });
    expect(hanoi.lichtZoeken).toEqual({ van: om('09:00'), tot: om('13:00'), vanafOpstaan: false });

    expect(p.heen[p.heen.length - 1].datum).toBe('2026-10-11');
  });

  it('houdt het bij drie dagen voorbereiden, ook als je meer vraagt', () => {
    expect(plan({ voorbereidingsdagen: 7 }).heen[0].datum).toBe('2026-09-30');
  });

  it('zet melatonine alleen in het plan als je dat wil, bij bedtijd ter plaatse', () => {
    expect(dag(plan(), '2026-10-05').melatonine).toBeNull();

    const met = plan({ melatonine: true });
    expect(dag(met, '2026-10-05').melatonine).toBe(om('23:00'));
    // Niet tijdens de voorbereiding, en niet op de terugweg naar het westen.
    expect(dag(met, '2026-09-30').melatonine).toBeNull();
    expect(dag(met, '2026-10-24').melatonine).toBeNull();
  });

  it('rekent met een bedtijd na middernacht', () => {
    const laat = plan({ bedtijd: '00:30', wektijd: '08:00' });
    const eerste = dag(laat, '2026-09-30');
    expect(eerste.naarBed).toBe(om('23:30'));
    expect(eerste.lichtZoeken).toEqual({ van: om('08:00'), tot: om('09:00'), vanafOpstaan: true });
  });
});

describe('maakJetlagplan, de terugreis', () => {
  it('begint op de laatste dag van het reisschema, zonder vensters', () => {
    const p = plan();
    const reisdag = p.terug[0];
    expect(reisdag.datum).toBe('2026-10-23');
    expect(reisdag.soort).toBe('terugreis');
    expect(reisdag.tijdzone).toBe('Asia/Tokyo');
    expect(reisdag.opstaan).toBeNull();
    expect(reisdag.lichtZoeken).toBeNull();
    expect(p.thuiskomst).toBe('2026-10-24');
    expect(p.verschilTerug).toBe(-420);
  });

  it('zoekt thuis het licht in de avond, want je klok moet terug', () => {
    const thuis = dag(plan(), '2026-10-24');
    expect(thuis.soort).toBe('thuis');
    expect(thuis.richting).toBe('verlaten');
    expect(thuis.achterstand).toBe(-420);
    expect(thuis.dieptepunt).toBe(om('21:00'));
    expect(thuis.lichtZoeken).toEqual({ van: om('17:00'), tot: om('21:00'), vanafOpstaan: false });
    expect(thuis.lichtMijden).toEqual({ van: om('21:00'), tot: om('23:00'), vanafOpstaan: false });
  });

  it('telt de wintertijd van 25 oktober mee', () => {
    const p = plan();
    expect(p.klokWisselThuis).toEqual({ datum: '2026-10-25', minuten: -60 });
    // Anderhalf uur ingelopen, maar de klok thuis ging een uur terug.
    expect(dag(p, '2026-10-25').achterstand).toBe(-390);
  });

  it('loopt na zes dagen thuis weer gelijk', () => {
    const p = plan();
    expect(p.terug.map((d) => d.datum)).toEqual([
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
    ]);
    expect(p.terug[p.terug.length - 1].aangepast).toBe(true);
  });
});

describe('maakJetlagplan, zonder bruikbare invoer', () => {
  it('geeft niets bij een reisschema zonder datums', () => {
    const leeg: Reisschema = { naam: 'x', segmenten: [{ stad: 'tokio' }] };
    expect(
      maakJetlagplan({ reisschema: leeg, steden: STEDEN, instellingen: STANDAARD_INSTELLINGEN }),
    ).toBeNull();
  });

  it('geeft niets bij een bedtijd die halverwege het typen is', () => {
    expect(
      maakJetlagplan({
        reisschema: SCHEMA,
        steden: STEDEN,
        instellingen: { ...STANDAARD_INSTELLINGEN, bedtijd: '2' },
      }),
    ).toBeNull();
  });
});

describe('dagVanVandaag', () => {
  it('vindt een voorbereidingsdag thuis', () => {
    expect(dagVanVandaag(plan(), new Date('2026-10-01T10:00:00Z'))?.datum).toBe('2026-10-01');
  });

  it('kiest midden in de vlucht al de dag in Hanoi', () => {
    // 23:30 thuis, 04:30 in Hanoi.
    expect(dagVanVandaag(plan(), new Date('2026-10-03T21:30:00Z'))?.datum).toBe('2026-10-04');
  });

  it('houdt de avond van thuiskomst bij de terugreis', () => {
    // 23:00 thuis op de 23e, in Tokio al de 24e.
    expect(dagVanVandaag(plan(), new Date('2026-10-23T21:00:00Z'))?.datum).toBe('2026-10-23');
  });

  it('geeft niets midden in de reis, als je allang bent aangepast', () => {
    expect(dagVanVandaag(plan(), new Date('2026-10-15T03:00:00Z'))).toBeNull();
  });
});

describe('plusDagen', () => {
  it('telt over een maandgrens heen, en terug', () => {
    expect(plusDagen('2026-09-30', 1)).toBe('2026-10-01');
    expect(plusDagen('2026-10-01', -2)).toBe('2026-09-29');
  });
});
