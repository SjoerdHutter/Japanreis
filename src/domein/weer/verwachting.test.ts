import { describe, expect, it } from 'vitest';
import type { Reisschema, Stad } from '@/domein/schema';
import {
  binnenHorizon,
  isRegendag,
  isVers,
  leesVerwachting,
  opTeHalen,
  verwachtingUrl,
  voegDagenSamen,
  weersoort,
  windNiveau,
  type Dagweer,
} from './verwachting';

const KYOTO = {
  id: 'kyoto',
  naam: 'Kyoto',
  tijdzone: 'Asia/Tokyo',
  centrum: { lat: 35.0116, lon: 135.7681 },
} as Stad;
const HANOI = {
  id: 'hanoi',
  naam: 'Hanoi',
  tijdzone: 'Asia/Ho_Chi_Minh',
  centrum: { lat: 21.0285, lon: 105.8542 },
} as Stad;

const SCHEMA: Reisschema = {
  naam: 't',
  segmenten: [
    { stad: 'hanoi', van: '2026-10-04', tot: '2026-10-04' },
    { stad: 'kyoto', van: '2026-10-08', tot: '2026-10-12' },
    { stad: 'hanoi', van: '2026-10-23', tot: '2026-10-23' },
  ],
};

const dag = (deel: Partial<Dagweer>): Dagweer => ({
  datum: '2026-10-08',
  min: 14,
  max: 22,
  regenkans: 10,
  regenMm: 0,
  windstoten: 20,
  code: 1,
  ...deel,
});

describe('weersverwachting', () => {
  it('vraagt de dagen op in de tijdzone van de stad', () => {
    const url = new URL(verwachtingUrl(KYOTO, '2026-10-08', '2026-10-12'));
    expect(url.hostname).toBe('api.open-meteo.com');
    expect(url.searchParams.get('timezone')).toBe('Asia/Tokyo');
    expect(url.searchParams.get('start_date')).toBe('2026-10-08');
    expect(url.searchParams.get('daily')).toContain('wind_gusts_10m_max');
  });

  it('haalt alleen op wat binnen zestien dagen valt', () => {
    // Op 28 september is 13 oktober de zestiende dag: Kyoto tot en met 12
    // oktober past, de terugreis over Hanoi op 23 oktober nog niet.
    const nu = new Date('2026-09-28T10:00:00Z');
    const lijst = opTeHalen(SCHEMA, [KYOTO, HANOI], nu);
    expect(lijst.map((l) => [l.stad.id, l.van, l.tot])).toEqual([
      ['hanoi', '2026-10-04', '2026-10-04'],
      ['kyoto', '2026-10-08', '2026-10-12'],
    ]);
    expect(binnenHorizon('2026-10-13', KYOTO, nu)).toBe(true);
    expect(binnenHorizon('2026-10-14', KYOTO, nu)).toBe(false);
  });

  it('begint bij vandaag als je al onderweg bent, en voegt twee bezoeken samen', () => {
    const nu = new Date('2026-10-10T03:00:00Z');
    const lijst = opTeHalen(SCHEMA, [KYOTO, HANOI], nu);
    expect(lijst.find((l) => l.stad.id === 'kyoto')).toMatchObject({
      van: '2026-10-10',
      tot: '2026-10-12',
    });
    expect(lijst.find((l) => l.stad.id === 'hanoi')).toMatchObject({
      van: '2026-10-23',
      tot: '2026-10-23',
    });
  });

  it('leest het antwoord van Open-Meteo, ook met gaten', () => {
    const dagen = leesVerwachting({
      timezone: 'Asia/Tokyo',
      daily: {
        time: ['2026-10-08', '2026-10-09'],
        temperature_2m_min: [14.2, null],
        temperature_2m_max: [22.1, 20],
        precipitation_probability_max: [70, 5],
        precipitation_sum: [3.2, 0],
        wind_gusts_10m_max: [45, 95],
        weather_code: [61, 2],
      },
    });
    expect(dagen[0]).toMatchObject({ datum: '2026-10-08', regenkans: 70, code: 61 });
    expect(dagen[1].min).toBeNull();
    expect(() => leesVerwachting({ fout: true })).toThrow();
  });

  it('noemt een dag een regendag vanaf zestig procent of vijf millimeter', () => {
    expect(isRegendag(dag({ regenkans: 60 }))).toBe(true);
    expect(isRegendag(dag({ regenkans: 30, regenMm: 5 }))).toBe(true);
    expect(isRegendag(dag({ regenkans: 59, regenMm: 4.9 }))).toBe(false);
    expect(isRegendag(undefined)).toBe(false);
  });

  it('waarschuwt vanaf 60 km/h en harder vanaf 90', () => {
    expect(windNiveau(dag({ windstoten: 59 }))).toBeNull();
    expect(windNiveau(dag({ windstoten: 60 }))).toBe('hard');
    expect(windNiveau(dag({ windstoten: 90 }))).toBe('storm');
  });

  it('houdt voorbije dagen vast en ververst de rest', () => {
    const samen = voegDagenSamen(
      [dag({ datum: '2026-10-08', max: 20 }), dag({ datum: '2026-10-09', max: 21 })],
      [dag({ datum: '2026-10-09', max: 25 }), dag({ datum: '2026-10-10' })],
    );
    expect(samen.map((d) => [d.datum, d.max])).toEqual([
      ['2026-10-08', 20],
      ['2026-10-09', 25],
      ['2026-10-10', 22],
    ]);
  });

  it('is drie uur vers', () => {
    const nu = new Date('2026-10-08T12:00:00Z');
    expect(isVers('2026-10-08T09:30:00Z', nu)).toBe(true);
    expect(isVers('2026-10-08T08:59:00Z', nu)).toBe(false);
    expect(isVers(undefined, nu)).toBe(false);
  });

  it('vertaalt de weercode naar iets wat je ziet', () => {
    expect(weersoort(0)).toBe('zon');
    expect(weersoort(3)).toBe('bewolkt');
    expect(weersoort(63)).toBe('regen');
    expect(weersoort(81)).toBe('regen');
    expect(weersoort(95)).toBe('onweer');
  });
});
