import { describe, expect, it } from 'vitest';
import type { Plaats, Stad } from '@/domein/schema';
import { STEDEN, laadPlaatsen } from '@/data/content';
import {
  alsKlok,
  looproute,
  maakDagplan,
  maaltijdvoorstellen,
  openingsraam,
  venster,
  type Stop,
} from './dagplanner';

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
    expect(venster(p, WOENSDAG)).toEqual({ van: 540, tot: 1020 });
  });

  it('pakt bij twee blokken de buitenste tijden', () => {
    const p = plaats('x', 35, 135, { openingstijden: { standaard: '06:00-10:00, 18:00-20:30' } });
    expect(venster(p, WOENSDAG)).toEqual({ van: 360, tot: 1230 });
  });

  it('geeft niets terug als er geen klok in de tekst staat', () => {
    const p = plaats('x', 35, 135, { openingstijden: { standaard: 'Dag en nacht open' } });
    expect(venster(p, WOENSDAG)).toBeNull();
  });

  it('geeft niets terug op een sluitingsdag', () => {
    const p = plaats('x', 35, 135, {
      openingstijden: { standaard: '09:00-17:00', perDag: { maandag: 'gesloten' } },
    });
    expect(venster(p, MAANDAG)).toBeNull();
  });

  it('kijkt naar de datum: de eerste maandag van de maand dicht, de tweede open', () => {
    const p = plaats('x', 35, 135, {
      openingstijden: { osm: 'Mo-Su 08:00-12:00,13:30-17:00; Mo[1] off' },
    });
    expect(venster(p, '2026-04-06')).toBeNull();
    expect(venster(p, MAANDAG)).toEqual({ van: 480, tot: 1020 });
  });

  it('geeft niets terug in een sluitingsperiode', () => {
    const p = plaats('x', 35, 135, {
      openingstijden: { standaard: '09:00-17:00' },
      sluitingen: [{ van: '2026-04-01', tot: '2026-04-30', reden: 'Onderhoud' }],
    });
    expect(venster(p, WOENSDAG)).toBeNull();
  });
});

describe('openingsraam', () => {
  it('trekt een blok over middernacht door, en neemt de nacht ervoor mee', () => {
    const bar = plaats('bar', 35, 135, { openingstijden: { osm: 'Mo-Su 18:00-02:00' } });
    expect(openingsraam(bar, WOENSDAG)).toEqual({
      soort: 'open',
      blokken: [
        { van: 0, tot: 120 },
        { van: 1080, tot: 1560 },
      ],
    });
  });

  it('zegt onbekend bij tijden zonder klok', () => {
    const p = plaats('x', 35, 135, { openingstijden: { tekst: 'Wisselend' } });
    expect(openingsraam(p, WOENSDAG)).toEqual({ soort: 'onbekend' });
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

describe('maakDagplan met openingstijden per datum', () => {
  const pagode = plaats('pagode', 35.0, 135.77, {
    openingstijden: { osm: 'Mo-Su 07:30-11:00,13:30-17:00' },
    attractie: { type: 'tempel', bezoekduurMinuten: 60 },
  });

  it('wacht in de middagpauze tot het weer opengaat', () => {
    const plan = maakDagplan({
      plaatsen: [pagode],
      stad: KYOTO,
      datum: WOENSDAG,
      startMinuten: 12 * 60,
      eindMinuten: 18 * 60,
    });
    expect(plan.stops[0].aankomst).toBe(13 * 60 + 30);
    expect(plan.stops[0].waarschuwingen).toContain('Gaat om 13:30 weer open, dus je wacht even.');
  });

  it('schuift een bezoek dat niet meer voor de pauze past naar erna', () => {
    const plan = maakDagplan({
      plaatsen: [pagode],
      stad: KYOTO,
      datum: WOENSDAG,
      startMinuten: 10 * 60 + 45,
      eindMinuten: 18 * 60,
    });
    expect(plan.stops[0].aankomst).toBe(13 * 60 + 30);
    expect(plan.stops[0].waarschuwingen[0]).toContain('Tussen 11:00 en 13:30');
  });

  it('kort een bezoek in tot de sluitingstijd en plant nooit binnen als het dicht is', () => {
    const plan = maakDagplan({
      plaatsen: [pagode],
      stad: KYOTO,
      datum: WOENSDAG,
      startMinuten: 16 * 60 + 20,
      eindMinuten: 18 * 60,
    });
    expect(plan.stops[0].vertrek).toBe(17 * 60);
    expect(plan.stops[0].waarschuwingen.some((w) => w.includes('maar tot 17:00'))).toBe(true);
  });

  it('laat een plek in een sluitingsperiode weg en noemt de reden', () => {
    const dicht = plaats('mausoleum', 35.0, 135.77, {
      naam: 'Mausoleum',
      openingstijden: { standaard: '07:30-10:30' },
      sluitingen: [{ van: '2026-04-01', tot: '2026-04-30', reden: 'Jaarlijks onderhoud' }],
    });
    const plan = maakDagplan({
      plaatsen: [dicht, pagode],
      stad: KYOTO,
      datum: WOENSDAG,
      startMinuten: 8 * 60,
      eindMinuten: 18 * 60,
    });
    expect(plan.stops.map((s) => s.plaats.id)).toEqual(['pagode']);
    expect(plan.nietGepland.map((p) => p.id)).toEqual(['mausoleum']);
    expect(plan.waarschuwingen).toContain(
      'Mausoleum is tijdelijk gesloten (1 t/m 30 apr). Jaarlijks onderhoud.',
    );
  });

  it('noemt de datum bij een sluiting die niet elke week is', () => {
    const museum = plaats('museum', 35.0, 135.77, {
      openingstijden: { osm: 'Mo-Su 08:00-17:00; Mo[1] off' },
    });
    const plan = maakDagplan({
      plaatsen: [museum],
      stad: KYOTO,
      datum: '2026-04-06',
      startMinuten: 9 * 60,
      eindMinuten: 18 * 60,
    });
    expect(plan.waarschuwingen).toEqual(['museum is op maandag 6 apr gesloten.']);
  });

  it('gebruikt de bezoekduur van een eetplek en een spa', () => {
    const spa = plaats('spa', 35.0, 135.77, {
      categorie: 'spa',
      attractie: undefined,
      spa: { bezoekduurMinuten: 120 },
    });
    const plan = maakDagplan({
      plaatsen: [spa],
      stad: KYOTO,
      datum: WOENSDAG,
      startMinuten: 10 * 60,
      eindMinuten: 18 * 60,
    });
    expect(plan.stops[0].vertrek - plan.stops[0].aankomst).toBe(120);
  });
});

describe('maakDagplan met voorstellingen', () => {
  const theater = plaats('theater', 35.0, 135.77, {
    attractie: { type: 'ervaring', bezoekduurMinuten: 50 },
    openingstijden: { tekst: 'Meerdere voorstellingen per dag' },
    voorstellingen: ['16:10', '17:20', '18:30', '20:00'],
  });
  const tempel = plaats('tempel', 35.001, 135.771, {
    openingstijden: { standaard: '08:00-17:00' },
  });

  it('plant op de eerstvolgende voorstelling en zet hem achteraan de dag', () => {
    const plan = maakDagplan({
      plaatsen: [theater, tempel],
      stad: KYOTO,
      datum: WOENSDAG,
      startMinuten: 9 * 60,
      eindMinuten: 21 * 60,
    });
    expect(plan.stops.map((s) => s.plaats.id)).toEqual(['tempel', 'theater']);
    expect(plan.stops[1].aankomst).toBe(16 * 60 + 10);
    expect(plan.stops[1].vertrek).toBe(17 * 60);
    expect(plan.stops[1].uitleg).toContain('16:10');
    expect(plan.stops[1].waarschuwingen).toEqual([]);
  });

  it('neemt de volgende voorstelling als je de eerste mist', () => {
    const plan = maakDagplan({
      plaatsen: [theater],
      stad: KYOTO,
      datum: WOENSDAG,
      startMinuten: 16 * 60 + 30,
      eindMinuten: 21 * 60,
    });
    expect(plan.stops[0].aankomst).toBe(17 * 60 + 20);
  });

  it('laat hem weg als er geen voorstelling meer is', () => {
    const plan = maakDagplan({
      plaatsen: [theater],
      stad: KYOTO,
      datum: WOENSDAG,
      startMinuten: 20 * 60 + 15,
      eindMinuten: 23 * 60,
    });
    expect(plan.stops).toEqual([]);
    expect(plan.nietGepland.map((p) => p.id)).toEqual(['theater']);
    expect(plan.waarschuwingen[0]).toContain('geen voorstelling meer');
  });
});

describe('maaltijdvoorstellen', () => {
  const museum = plaats('museum', 35.0, 135.77, { openingstijden: { standaard: '09:00-17:00' } });
  const tempel = plaats('tempel', 35.004, 135.77, { openingstijden: { standaard: '09:00-17:00' } });
  const eten = (id: string, lat: number, extra: Partial<Plaats> = {}) =>
    plaats(id, lat, 135.77, {
      categorie: 'eten',
      attractie: undefined,
      eten: { keuken: 'restaurant' },
      openingstijden: { standaard: '11:00-21:00' },
      ...extra,
    });
  const stop = (p: Plaats, aankomst: number, vertrek: number): Stop => ({
    plaats: p,
    aankomst,
    vertrek,
    looptijd: 0,
    waarschuwingen: [],
  });
  const STOPS = [stop(museum, 540, 720), stop(tempel, 730, 850)];

  it('kiest eerst een open plek die bij de vorige stop hoort, ook als een andere dichterbij is', () => {
    const dichtbij = eten('dichtbij', 35.0005);
    const gekoppeld = eten('gekoppeld', 35.003, { inDeBuurtVan: ['museum'] });
    const [lunch] = maaltijdvoorstellen(STOPS, [dichtbij, gekoppeld], WOENSDAG, 540);
    expect(lunch).toMatchObject({
      maaltijd: 'lunch',
      moment: 720,
      gekoppeld: true,
    });
    expect(lunch.plaats.id).toBe('gekoppeld');
    expect(lunch.bij.id).toBe('museum');
    expect(lunch.na?.id).toBe('museum');
  });

  it('slaat een gekoppelde plek over die dan dicht is en neemt de dichtstbijzijnde open plek', () => {
    const dicht = eten('dicht', 35.003, {
      inDeBuurtVan: ['museum'],
      openingstijden: { standaard: '17:00-22:00' },
    });
    const open = eten('open', 35.002);
    const ver = eten('ver', 35.02);
    const [lunch] = maaltijdvoorstellen(STOPS, [dicht, open, ver], WOENSDAG, 540);
    expect(lunch.plaats.id).toBe('open');
    expect(lunch.gekoppeld).toBe(false);
  });

  it('stelt niets voor buiten 800 meter, voor koffie of als er al een maaltijd in de dag staat', () => {
    expect(maaltijdvoorstellen(STOPS, [eten('ver', 35.02)], WOENSDAG, 540)).toEqual([]);
    const koffie = eten('koffie', 35.001, { eten: { keuken: 'koffie' } });
    expect(maaltijdvoorstellen(STOPS, [koffie], WOENSDAG, 540)).toEqual([]);
    const lunchStop = eten('lunch', 35.001);
    const metLunch = [stop(museum, 540, 700), stop(lunchStop, 705, 760)];
    expect(maaltijdvoorstellen(metLunch, [eten('ander', 35.001)], WOENSDAG, 540)).toEqual([]);
  });

  it('stelt op een regendag geen plek buiten voor', () => {
    const stoep = eten('stoep', 35.001, { eten: { keuken: 'restaurant', regenbestendig: false } });
    expect(maaltijdvoorstellen(STOPS, [stoep], WOENSDAG, 540, { regen: true })).toEqual([]);
    expect(maaltijdvoorstellen(STOPS, [stoep], WOENSDAG, 540)).toHaveLength(1);
  });

  it('stelt een diner voor na de laatste stop', () => {
    const avond = [stop(museum, 900, 1090)];
    const [diner] = maaltijdvoorstellen(avond, [eten('diner', 35.001)], WOENSDAG, 900);
    expect(diner).toMatchObject({ maaltijd: 'diner', moment: 1090 });
  });
});

describe('de dagplanner met de plekken in Hanoi', () => {
  const hanoi = STEDEN.find((s) => s.id === 'hanoi')!;

  it('laat het mausoleum weg op de Hanoi dagen en noemt de reden', async () => {
    const alle = await laadPlaatsen('hanoi');
    const kies = (...ids: string[]) => alle.filter((p) => ids.includes(p.id));
    const plan = maakDagplan({
      plaatsen: kies('ho-chi-minh-mausoleum', 'hoa-lo', 'literatuurtempel'),
      stad: hanoi,
      datum: '2026-10-04',
      startMinuten: 8 * 60,
      eindMinuten: 18 * 60,
      alle,
    });
    expect(plan.nietGepland.map((p) => p.id)).toEqual(['ho-chi-minh-mausoleum']);
    expect(plan.waarschuwingen[0]).toMatch(
      /^Ho Chi Minh .* is tijdelijk gesloten \(4 sep t\/m 2 nov\)\. Jaarlijks onderhoud/,
    );
    expect(plan.stops).toHaveLength(2);
  });

  it('stelt bij lunch een eetplek voor die bij een van de stops hoort en dan open is', async () => {
    const alle = await laadPlaatsen('hanoi');
    const kies = (...ids: string[]) => alle.filter((p) => ids.includes(p.id));
    const plan = maakDagplan({
      plaatsen: kies('hoa-lo', 'hoan-kiem'),
      stad: hanoi,
      datum: '2026-10-04',
      startMinuten: 10 * 60,
      eindMinuten: 15 * 60,
      alle,
    });
    const lunch = plan.maaltijden.find((m) => m.maaltijd === 'lunch');
    expect(lunch).toBeDefined();
    expect(lunch!.gekoppeld).toBe(true);
    expect(lunch!.plaats.inDeBuurtVan).toContain(lunch!.bij.id);
  });
});
