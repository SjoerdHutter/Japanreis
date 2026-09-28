import { describe, expect, it } from 'vitest';
import { LAATSTE_TREINEN } from '@/data/content';
import type { Accommodatie } from '@/domein/schema';
import {
  alsAvondMinuten,
  bekendeTerugstations,
  laatsteTreinVoor,
  stationSleutel,
} from './laatsteTrein';

const verblijf = (deel: Partial<Accommodatie>): Accommodatie => ({
  soort: 'accommodatie',
  id: 'a',
  naam: 'Hotel',
  stadId: 'kyoto',
  incheck: { datum: '2026-10-08' },
  uitcheck: { datum: '2026-10-13' },
  terugstation: 'Kyoto Station',
  gewijzigdOp: 'x',
  ...deel,
});

// Gion, bij Shijo-Kawaramachi.
const GION = { lat: 35.0037, lon: 135.7745 };
const minuten = (tijd: string) => alsAvondMinuten(tijd);

describe('laatste trein', () => {
  it('leest stationsnamen op dezelfde manier', () => {
    expect(stationSleutel('Kyoto Station')).toBe(stationSleutel('kyoto'));
    expect(stationSleutel('京都駅')).toBe(stationSleutel('京都'));
    expect(stationSleutel('Shinjuku eki')).toBe('shinjuku');
  });

  it('telt een tijd na middernacht als laat op de avond', () => {
    expect(alsAvondMinuten('00:30')).toBe(24 * 60 + 30);
    expect(alsAvondMinuten('23:30')).toBe(23 * 60 + 30);
  });

  it('kiest het knooppunt dat het dichtst bij je laatste stop ligt', () => {
    const uit = laatsteTreinVoor({
      stadId: 'kyoto',
      laatsteStop: { coordinaten: GION, vertrek: minuten('21:00') },
      verblijf: verblijf({}),
      treinen: LAATSTE_TREINEN,
    });
    expect(uit.soort).toBe('bekend');
    if (uit.soort === 'bekend') {
      expect(uit.trein?.id).toBe('kyoto-kawaramachi-kyoto-station');
      expect(uit.knelt).toBe(false);
    }
  });

  it('waarschuwt als de laatste stop na de trein min een half uur eindigt', () => {
    const uit = laatsteTreinVoor({
      stadId: 'kyoto',
      laatsteStop: { coordinaten: GION, vertrek: minuten('22:10') },
      verblijf: verblijf({}),
      treinen: LAATSTE_TREINEN,
    });
    expect(uit.soort === 'bekend' && uit.knelt).toBe(true);
  });

  it('rekent in Tokio met een trein na middernacht', () => {
    const uit = laatsteTreinVoor({
      stadId: 'tokio',
      laatsteStop: { coordinaten: { lat: 35.659, lon: 139.7 }, vertrek: minuten('23:50') },
      verblijf: verblijf({ stadId: 'tokio', terugstation: 'Shinjuku' }),
      treinen: LAATSTE_TREINEN,
    });
    expect(uit.soort === 'bekend' && uit.trein?.van).toBe('Shibuya');
    expect(uit.soort === 'bekend' && uit.knelt).toBe(false);
  });

  it('zegt niets als je verblijf op loopafstand ligt', () => {
    const uit = laatsteTreinVoor({
      stadId: 'kyoto',
      laatsteStop: { coordinaten: GION, vertrek: minuten('23:50') },
      verblijf: verblijf({ coordinaten: { lat: 35.005, lon: 135.772 } }),
      treinen: LAATSTE_TREINEN,
    });
    expect(uit.soort).toBe('loopafstand');
  });

  it('gebruikt je eigen tijd boven de content', () => {
    const uit = laatsteTreinVoor({
      stadId: 'kyoto',
      laatsteStop: { coordinaten: GION, vertrek: minuten('22:10') },
      verblijf: verblijf({ terugstation: 'Ergens' }),
      treinen: LAATSTE_TREINEN,
      eigenTijd: '23:55',
    });
    expect(uit).toMatchObject({
      soort: 'bekend',
      laatsteVertrek: '23:55',
      knelt: false,
      trein: null,
    });
  });

  it('zegt eerlijk wanneer het niet bekend is', () => {
    const basis = {
      stadId: 'kyoto',
      laatsteStop: { coordinaten: GION, vertrek: minuten('22:00') },
      treinen: LAATSTE_TREINEN,
    };
    expect(laatsteTreinVoor(basis)).toEqual({ soort: 'onbekend', reden: 'geen-verblijf' });
    expect(laatsteTreinVoor({ ...basis, verblijf: verblijf({ terugstation: undefined }) })).toEqual(
      {
        soort: 'onbekend',
        reden: 'geen-terugstation',
      },
    );
    expect(laatsteTreinVoor({ ...basis, verblijf: verblijf({ terugstation: 'Nergens' }) })).toEqual(
      {
        soort: 'onbekend',
        reden: 'geen-gegevens',
      },
    );
  });

  it('kent de terugstations per stad, ook van een dagtrip', () => {
    expect(bekendeTerugstations(LAATSTE_TREINEN, 'tokio')).toContain('Shinjuku');
    expect(bekendeTerugstations(LAATSTE_TREINEN, 'kyoto')).toEqual(['Kyoto Station']);
  });
});
