import { describe, expect, it } from 'vitest';
import type { Plaats } from '@/domein/schema';
import {
  AANKOMST_MINUTEN,
  RIT_MINUTEN,
  TERUG_VOOR_VERTREK_MINUTEN,
  alsDuur,
  alsMinuten,
  alsTijd,
  berekenOverstap,
  stelDagdeelVoor,
} from './overstap';

describe('alsMinuten en alsTijd', () => {
  it('rekent heen en weer', () => {
    expect(alsMinuten('09:30')).toBe(570);
    expect(alsTijd(570)).toBe('09:30');
  });

  it('neemt genoegen met één cijfer voor het uur', () => {
    expect(alsMinuten('9:05')).toBe(545);
  });

  it('geeft niets terug bij iets dat geen tijd is', () => {
    expect(alsMinuten('09')).toBeNull();
    expect(alsMinuten('25:00')).toBeNull();
    expect(alsMinuten('09:75')).toBeNull();
    expect(alsMinuten('')).toBeNull();
  });

  it('rekent een tijd voorbij middernacht terug naar de klok', () => {
    expect(alsTijd(1500)).toBe('01:00');
  });
});

describe('alsDuur', () => {
  it('schrijft uren en minuten uit', () => {
    expect(alsDuur(260)).toBe('4 uur en 20 minuten');
    expect(alsDuur(120)).toBe('2 uur');
    expect(alsDuur(35)).toBe('35 minuten');
    expect(alsDuur(61)).toBe('1 uur en 1 minuut');
  });
});

describe('de overstapplanner uit hoofdstuk 14', () => {
  it('levert een realistisch dagdeel bij een ruime overstap', () => {
    // Landen om 06:00, doorvliegen om 22:00. Dat is de situatie waarvoor deze
    // planner bestaat, en hij hoort een bruikbaar antwoord te geven.
    const uit = berekenOverstap({
      richting: 'heenreis',
      landing: '06:00',
      vertrek: '22:00',
      bagageOphalen: false,
    })!;
    expect(uit.haalbaar).toBe(true);
    // 06:00 + een uur luchthaven + 45 minuten rijden = 07:45 in de stad.
    expect(alsTijd(uit.inStadVanaf)).toBe('07:45');
    // 22:00 min drie uur incheck min 45 minuten rijden = 18:15 vertrekken.
    expect(alsTijd(uit.uitStadVoor)).toBe('18:15');
    expect(uit.tijdInStadMinuten).toBe(630);
  });

  it('zegt eerlijk dat een korte overstap niet kan', () => {
    const uit = berekenOverstap({
      richting: 'heenreis',
      landing: '10:00',
      vertrek: '14:00',
      bagageOphalen: false,
    })!;
    expect(uit.haalbaar).toBe(false);
    expect(uit.tijdInStadMinuten).toBeLessThan(0);
    expect(uit.waarschuwingen.some((w) => w.includes('te kort'))).toBe(true);
  });

  it('waarschuwt als het krap wordt in plaats van het stilzwijgend goed te keuren', () => {
    // Genoeg om er te komen, maar een uur in de stad is geen dagdeel.
    const uit = berekenOverstap({
      richting: 'heenreis',
      landing: '08:00',
      vertrek: '14:30',
      bagageOphalen: false,
    })!;
    expect(uit.haalbaar).toBe(true);
    expect(uit.tijdInStadMinuten).toBeLessThan(90);
    expect(uit.waarschuwingen.some((w) => w.includes('krap'))).toBe(true);
  });

  it('rekent een overstap over middernacht heen goed uit', () => {
    const uit = berekenOverstap({
      richting: 'terugreis',
      landing: '22:00',
      vertrek: '10:00',
      bagageOphalen: false,
    })!;
    expect(uit.overstapMinuten).toBe(12 * 60);
    expect(uit.haalbaar).toBe(true);
  });

  it('rekent een halfuur extra als je bagage moet ophalen', () => {
    const zonder = berekenOverstap({
      richting: 'heenreis',
      landing: '06:00',
      vertrek: '22:00',
      bagageOphalen: false,
    })!;
    const met = berekenOverstap({
      richting: 'heenreis',
      landing: '06:00',
      vertrek: '22:00',
      bagageOphalen: true,
    })!;
    expect(met.tijdInStadMinuten).toBe(zonder.tijdInStadMinuten - 30);
  });

  it('noemt de bagage altijd, want dat bepaalt of de trip überhaupt kan', () => {
    const met = berekenOverstap({
      richting: 'heenreis',
      landing: '06:00',
      vertrek: '22:00',
      bagageOphalen: true,
    })!;
    expect(met.waarschuwingen.some((w) => w.includes('locker'))).toBe(true);

    const zonder = berekenOverstap({
      richting: 'heenreis',
      landing: '06:00',
      vertrek: '22:00',
      bagageOphalen: false,
    })!;
    expect(zonder.waarschuwingen.some((w) => w.includes('doorgecheckt'))).toBe(true);
  });

  it('waarschuwt bij een aankomst midden in de nacht', () => {
    const uit = berekenOverstap({
      richting: 'terugreis',
      landing: '01:00',
      vertrek: '14:00',
      bagageOphalen: false,
    })!;
    expect(uit.waarschuwingen.some((w) => w.includes('nacht'))).toBe(true);
  });

  it('rekent met 45 minuten elke kant op, zoals de specificatie vraagt', () => {
    expect(RIT_MINUTEN).toBe(45);
    const uit = berekenOverstap({
      richting: 'heenreis',
      landing: '06:00',
      vertrek: '22:00',
      bagageOphalen: false,
    })!;
    expect(uit.inStadVanaf - alsMinuten('06:00')!).toBe(AANKOMST_MINUTEN + RIT_MINUTEN);
    expect(alsMinuten('22:00')! - uit.uitStadVoor).toBe(TERUG_VOOR_VERTREK_MINUTEN + RIT_MINUTEN);
  });

  it('geeft niets terug bij halve invoer, zodat het typen niet stukloopt', () => {
    expect(
      berekenOverstap({
        richting: 'heenreis',
        landing: '09:3',
        vertrek: '22:00',
        bagageOphalen: false,
      }),
    ).toBeNull();
  });
});

describe('stelDagdeelVoor', () => {
  const plaats = (
    id: string,
    minuten: number,
    categorie: Plaats['categorie'] = 'attractie',
  ): Plaats => ({
    id,
    naam: id,
    stad: 'hanoi',
    categorie,
    coordinaten: { lat: 21.03, lon: 105.85 },
    ...(categorie === 'attractie'
      ? { attractie: { type: 'tempel' as const, bezoekduurMinuten: minuten } }
      : { eten: { keuken: 'pho' as const } }),
  });

  const PLAATSEN = [
    plaats('meer', 45),
    plaats('tempel', 30),
    plaats('oude-wijk', 120),
    plaats('museum', 75),
    plaats('pho', 0, 'eten'),
  ];

  it('vult de beschikbare tijd, kortste bezoeken eerst', () => {
    const voorstel = stelDagdeelVoor(PLAATSEN, 180);
    expect(voorstel.length).toBeGreaterThan(1);
    const totaal = voorstel.reduce((t, v) => t + v.minuten, 0);
    expect(totaal).toBeLessThanOrEqual(180);
  });

  it('rekent verplaatsingstijd mee tussen de punten', () => {
    const voorstel = stelDagdeelVoor(PLAATSEN, 180);
    // Het eerste punt kost alleen de bezoekduur; daarna komt er reistijd bij.
    expect(voorstel[0].minuten).toBe(30);
    expect(voorstel[1].minuten).toBeGreaterThan(
      voorstel[1].plaats.attractie?.bezoekduurMinuten ?? 45,
    );
  });

  it('geeft niets terug als er geen tijd is', () => {
    expect(stelDagdeelVoor(PLAATSEN, 0)).toEqual([]);
    expect(stelDagdeelVoor(PLAATSEN, -60)).toEqual([]);
  });

  it('geeft een enkel punt als er maar voor één tijd is', () => {
    const voorstel = stelDagdeelVoor(PLAATSEN, 40);
    expect(voorstel).toHaveLength(1);
    expect(voorstel[0].plaats.id).toBe('tempel');
  });

  it('geeft een eetlocatie zonder bezoekduur een redelijke schatting', () => {
    const voorstel = stelDagdeelVoor([plaats('pho', 0, 'eten')], 60);
    expect(voorstel[0].minuten).toBe(45);
  });
});
