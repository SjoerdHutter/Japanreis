import { describe, expect, it } from 'vitest';
import type { Plaats, Stad } from '@/domein/schema';
import { naamGelijkenis, normaliseer, stadVoorPunt, stelVoor } from './koppel';

const stad = (id: string, lat: number, lon: number, straalKm = 20): Stad => ({
  id,
  naam: id,
  land: 'japan',
  tijdzone: 'Asia/Tokyo',
  valuta: 'JPY',
  centrum: { lat, lon },
  straalKm,
  kaartgebied: {
    zuidwest: { lat: lat - 0.2, lon: lon - 0.2 },
    noordoost: { lat: lat + 0.2, lon: lon + 0.2 },
  },
  tijdlijn: 'japan',
  tijdvakken: [],
  korteBeschrijving: '',
  volgorde: 1,
});

const plaats = (id: string, naam: string, stadId: string, lat: number, lon: number): Plaats => ({
  id,
  naam,
  stad: stadId,
  categorie: 'attractie',
  coordinaten: { lat, lon },
  attractie: { type: 'tempel' },
});

const STEDEN = [stad('kyoto', 35.0116, 135.7681), stad('tokio', 35.6812, 139.7671, 30)];
const PLAATSEN = [
  plaats('fushimi-inari', 'Fushimi Inari Taisha', 'kyoto', 34.9671, 135.7727),
  plaats('kinkaku-ji', 'Kinkaku-ji', 'kyoto', 35.0394, 135.7292),
  plaats('senso-ji', 'Sensō-ji', 'tokio', 35.7148, 139.7967),
];

describe('normaliseer en naamGelijkenis', () => {
  it('haalt accenten en leestekens weg', () => {
    expect(normaliseer('Sensō-ji')).toBe('senso ji');
  });

  it('ziet dezelfde plek door een andere schrijfwijze heen', () => {
    expect(naamGelijkenis('Sensō-ji', 'Sensoji Temple')).toBeGreaterThanOrEqual(0.8);
    expect(naamGelijkenis('Kiyomizu-dera Temple', 'Kiyomizu-dera')).toBeGreaterThanOrEqual(0.8);
  });

  it('haalt twee verschillende tempels niet door elkaar', () => {
    expect(naamGelijkenis('Kinkaku-ji', 'Ginkaku-ji')).toBeLessThan(0.6);
    expect(naamGelijkenis('Fushimi Inari', 'Sensō-ji')).toBe(0);
  });
});

describe('stadVoorPunt', () => {
  it('vindt de stad waarin een punt valt', () => {
    expect(
      stadVoorPunt({ naam: 'x', coordinaten: { lat: 35.0116, lon: 135.7681 } }, STEDEN)?.id,
    ).toBe('kyoto');
  });

  it('geeft niets terug voor een punt buiten alle steden', () => {
    expect(stadVoorPunt({ naam: 'x', coordinaten: { lat: 52.37, lon: 4.9 } }, STEDEN)).toBeNull();
  });

  it('geeft niets terug voor een punt zonder coördinaten', () => {
    expect(stadVoorPunt({ naam: 'x' }, STEDEN)).toBeNull();
  });
});

describe('stelVoor', () => {
  it('koppelt zonder twijfel als naam en plek allebei kloppen', () => {
    const [voorstel] = stelVoor(
      [{ naam: 'Fushimi Inari Shrine', coordinaten: { lat: 34.9672, lon: 135.7726 } }],
      STEDEN,
      PLAATSEN,
    );
    expect(voorstel.zekerheid).toBe('zeker');
    expect(voorstel.plaatsId).toBe('fushimi-inari');
    expect(voorstel.stadId).toBe('kyoto');
  });

  it('vraagt om bevestiging als de plek klopt maar de naam anders is', () => {
    // Een eetzaak vlak naast de tempel is niet dezelfde plek, dus dit moet je
    // zelf bevestigen in plaats van dat de app ze samenvoegt.
    const [voorstel] = stelVoor(
      [{ naam: 'Koffie bij de poort', coordinaten: { lat: 34.9672, lon: 135.7726 } }],
      STEDEN,
      PLAATSEN,
    );
    expect(voorstel.zekerheid).toBe('twijfel');
    expect(voorstel.plaatsId).toBe('fushimi-inari');
  });

  it('maakt een nieuw punt van iets dat de app nog niet kent', () => {
    const [voorstel] = stelVoor(
      [{ naam: 'Een café', coordinaten: { lat: 35.0116, lon: 135.7681 } }],
      STEDEN,
      PLAATSEN,
    );
    expect(voorstel.zekerheid).toBe('geen');
    expect(voorstel.plaatsId).toBeUndefined();
    expect(voorstel.stadId).toBe('kyoto');
    expect(voorstel.reden).toContain('kyoto');
  });

  it('gooit een punt buiten alle steden niet weg', () => {
    const [voorstel] = stelVoor(
      [{ naam: 'Iets in Nikko', coordinaten: { lat: 36.7581, lon: 139.5986 } }],
      STEDEN,
      PLAATSEN,
    );
    expect(voorstel.zekerheid).toBe('geen');
    expect(voorstel.stadId).toBeUndefined();
    expect(voorstel.ruw.naam).toBe('Iets in Nikko');
  });

  it('houdt een punt zonder coördinaten staan en vraagt om handwerk', () => {
    const [voorstel] = stelVoor([{ naam: 'Een zaak zonder link' }], STEDEN, PLAATSEN);
    expect(voorstel.zekerheid).toBe('geen');
    expect(voorstel.reden).toContain('met de hand');
  });

  it('stelt bij een punt zonder coördinaten wel een naamkoppeling voor, maar met twijfel', () => {
    const [voorstel] = stelVoor([{ naam: 'Sensoji Temple' }], STEDEN, PLAATSEN);
    expect(voorstel.zekerheid).toBe('twijfel');
    expect(voorstel.plaatsId).toBe('senso-ji');
  });

  it('koppelt nooit twee tempels die vlak bij elkaar staan zomaar aan elkaar', () => {
    // Kinkaku-ji ligt op honderd meter van dit punt, maar de naam is anders;
    // dat mag hoogstens twijfel opleveren, nooit een zekere koppeling.
    const [voorstel] = stelVoor(
      [{ naam: 'Ginkaku-ji', coordinaten: { lat: 35.0395, lon: 135.7293 } }],
      STEDEN,
      PLAATSEN,
    );
    expect(voorstel.zekerheid).not.toBe('zeker');
  });
});
