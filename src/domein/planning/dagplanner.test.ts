import { describe, expect, it } from 'vitest';
import type { Plaats, Stad } from '@/domein/schema';
import { alsKlok, looproute, maakDagplan, venster } from './dagplanner';

const KYOTO: Stad = {
  id: 'kyoto',
  naam: 'Kyoto',
  land: 'japan',
  tijdzone: 'Asia/Tokyo',
  valuta: 'JPY',
  centrum: { lat: 35.0116, lon: 135.7681 },
  straalKm: 20,
  kaartgebied: { zuidwest: { lat: 34.93, lon: 135.66 }, noordoost: { lat: 35.08, lon: 135.83 } },
  tijdlijn: 'japan',
  tijdvakken: [],
  korteBeschrijving: '',
  volgorde: 1,
};

const plaats = (id: string, lat: number, lon: number, extra: Partial<Plaats> = {}): Plaats => ({
  id,
  naam: id,
  stad: 'kyoto',
  categorie: 'attractie',
  coordinaten: { lat, lon },
  attractie: { type: 'tempel', bezoekduurMinuten: 60 },
  ...extra,
});

// Woensdag 8 april 2026 en maandag 13 april 2026.
const WOENSDAG = '2026-04-08';
const MAANDAG = '2026-04-13';

describe('alsKlok', () => {
  it('schrijft minuten na middernacht als klok', () => {
    expect(alsKlok(9 * 60 + 30)).toBe('09:30');
    expect(alsKlok(0)).toBe('00:00');
  });
});

describe('venster', () => {
  it('leest de eerste opening en de laatste sluiting', () => {
    const p = plaats('x', 35, 135, { openingstijden: { standaard: '09:00-17:00' } });
    expect(venster(p, 'woensdag')).toEqual({ van: 540, tot: 1020 });
  });

  it('pakt bij twee blokken de buitenste tijden', () => {
    const p = plaats('x', 35, 135, { openingstijden: { standaard: '06:00-10:00, 18:00-20:30' } });
    expect(venster(p, 'woensdag')).toEqual({ van: 360, tot: 1230 });
  });

  it('geeft niets terug als er geen klok in de tekst staat', () => {
    const p = plaats('x', 35, 135, { openingstijden: { standaard: 'Dag en nacht open' } });
    expect(venster(p, 'woensdag')).toBeNull();
  });

  it('geeft niets terug op een sluitingsdag', () => {
    const p = plaats('x', 35, 135, {
      openingstijden: { standaard: '09:00-17:00', perDag: { maandag: 'gesloten' } },
    });
    expect(venster(p, 'maandag')).toBeNull();
  });
});

describe('looproute', () => {
  it('loopt telkens naar het dichtstbijzijnde punt', () => {
    // Vier punten op een rij; de route hoort ze op volgorde af te gaan, ook al
    // staan ze door elkaar in de lijst.
    const punten = [
      plaats('d', 35.03, 135.77),
      plaats('a', 35.0, 135.77),
      plaats('c', 35.02, 135.77),
      plaats('b', 35.01, 135.77),
    ];
    expect(looproute(punten).map((p) => p.id)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('begint bij het opgegeven startpunt als dat er is', () => {
    const a = plaats('a', 35.0, 135.77);
    const b = plaats('b', 35.01, 135.77);
    const c = plaats('c', 35.02, 135.77);
    expect(looproute([b, c], a).map((p) => p.id)).toEqual(['b', 'c']);
  });

  it('valt niet om op een lege lijst', () => {
    expect(looproute([])).toEqual([]);
  });
});

describe('maakDagplan', () => {
  const tempel = plaats('tempel', 35.0, 135.77, {
    openingstijden: { standaard: '06:00-18:00' },
    attractie: { type: 'tempel', bezoekduurMinuten: 60 },
  });
  const museum = plaats('museum', 35.005, 135.775, {
    openingstijden: { standaard: '09:30-17:00', perDag: { maandag: 'gesloten' } },
    attractie: { type: 'museum', bezoekduurMinuten: 90 },
  });
  const tuin = plaats('tuin', 35.01, 135.78, {
    openingstijden: { standaard: '08:00-17:00' },
    attractie: { type: 'tuin', bezoekduurMinuten: 45 },
  });

  it('bouwt een dag met aankomst- en vertrektijden', () => {
    const plan = maakDagplan({
      plaatsen: [tempel, museum, tuin],
      stad: KYOTO,
      datum: WOENSDAG,
      startMinuten: 9 * 60,
      eindMinuten: 18 * 60,
    });
    expect(plan.stops).toHaveLength(3);
    expect(plan.stops[0].aankomst).toBeGreaterThanOrEqual(9 * 60);
    for (const stop of plan.stops) {
      expect(stop.vertrek).toBeGreaterThan(stop.aankomst);
    }
  });

  it('haalt een plaats die die dag gesloten is uit het plan en zegt waarom', () => {
    const plan = maakDagplan({
      plaatsen: [tempel, museum, tuin],
      stad: KYOTO,
      datum: MAANDAG,
      startMinuten: 9 * 60,
      eindMinuten: 18 * 60,
    });
    expect(plan.stops.map((s) => s.plaats.id)).not.toContain('museum');
    expect(plan.nietGepland.map((p) => p.id)).toContain('museum');
    expect(plan.waarschuwingen.some((w) => w.includes('museum') && w.includes('maandag'))).toBe(
      true,
    );
  });

  it('laat je wachten als je te vroeg bent in plaats van je binnen te laten', () => {
    const plan = maakDagplan({
      plaatsen: [museum],
      stad: KYOTO,
      datum: WOENSDAG,
      startMinuten: 8 * 60,
      eindMinuten: 18 * 60,
    });
    expect(plan.stops[0].aankomst).toBe(9 * 60 + 30);
    expect(plan.stops[0].waarschuwingen.some((w) => w.includes('09:30'))).toBe(true);
  });

  it('plant niets meer in nadat een plaats gesloten is', () => {
    const plan = maakDagplan({
      plaatsen: [museum],
      stad: KYOTO,
      datum: WOENSDAG,
      startMinuten: 17 * 60 + 30,
      eindMinuten: 20 * 60,
    });
    expect(plan.stops).toHaveLength(0);
    expect(plan.nietGepland.map((p) => p.id)).toEqual(['museum']);
    expect(plan.waarschuwingen.some((w) => w.includes('17:00'))).toBe(true);
  });

  it('rekent looptijd tussen de stops mee', () => {
    const plan = maakDagplan({
      plaatsen: [tempel, tuin],
      stad: KYOTO,
      datum: WOENSDAG,
      startMinuten: 9 * 60,
      eindMinuten: 18 * 60,
    });
    expect(plan.stops[0].looptijd).toBe(0);
    expect(plan.stops[1].looptijd).toBeGreaterThan(0);
    expect(plan.looptijdTotaal).toBe(plan.stops[1].looptijd);
  });

  it('meldt een reserveringsplicht bij de stop zelf', () => {
    const kaiseki = plaats('kaiseki', 35.0, 135.77, {
      categorie: 'eten',
      eten: { keuken: 'kaiseki' },
      reservering: 'verplicht',
      openingstijden: { standaard: '17:30-21:00' },
      attractie: undefined,
    });
    const plan = maakDagplan({
      plaatsen: [kaiseki],
      stad: KYOTO,
      datum: WOENSDAG,
      startMinuten: 17 * 60,
      eindMinuten: 22 * 60,
    });
    expect(plan.stops[0].waarschuwingen.some((w) => w.includes('Reserveren'))).toBe(true);
  });

  it('zegt het als de openingstijden geen klok bevatten in plaats van te gokken', () => {
    const schrijn = plaats('schrijn', 35.0, 135.77, {
      openingstijden: { standaard: 'Dag en nacht open' },
    });
    const plan = maakDagplan({
      plaatsen: [schrijn],
      stad: KYOTO,
      datum: WOENSDAG,
      startMinuten: 9 * 60,
      eindMinuten: 18 * 60,
    });
    expect(plan.stops).toHaveLength(1);
    expect(plan.stops[0].waarschuwingen.some((w) => w.includes('kijk ze na'))).toBe(true);
  });

  it('zet wat niet meer past apart in plaats van het te laten verdwijnen', () => {
    const plan = maakDagplan({
      plaatsen: [tempel, museum, tuin],
      stad: KYOTO,
      datum: WOENSDAG,
      startMinuten: 9 * 60,
      eindMinuten: 11 * 60,
    });
    expect(plan.stops.length + plan.nietGepland.length).toBe(3);
    expect(plan.nietGepland.length).toBeGreaterThan(0);
  });

  it('waarschuwt als de dag over je eindtijd heen loopt', () => {
    const plan = maakDagplan({
      plaatsen: [tempel, tuin],
      stad: KYOTO,
      datum: WOENSDAG,
      startMinuten: 9 * 60,
      eindMinuten: 10 * 60,
    });
    expect(
      plan.waarschuwingen.some((w) => w.includes('later dan')) || plan.nietGepland.length > 0,
    ).toBe(true);
  });

  it('valt niet om op een lege dag', () => {
    const plan = maakDagplan({
      plaatsen: [],
      stad: KYOTO,
      datum: WOENSDAG,
      startMinuten: 9 * 60,
      eindMinuten: 18 * 60,
    });
    expect(plan.stops).toEqual([]);
    expect(plan.waarschuwingen).toEqual([]);
  });
});
