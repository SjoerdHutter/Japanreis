import { describe, expect, it } from 'vitest';
import { leesCoordinaten, leesSluitingen, sluitingenAlsTekst } from './invoer';

describe('leesCoordinaten', () => {
  it('leest geplakte coördinaten, met komma of spatie', () => {
    expect(leesCoordinaten('21.0287, 105.8524')).toEqual({ lat: 21.0287, lon: 105.8524 });
    expect(leesCoordinaten('21.0287 105.8524')).toEqual({ lat: 21.0287, lon: 105.8524 });
  });

  it('haalt ze uit een link van Google Maps', () => {
    expect(leesCoordinaten('https://www.google.com/maps/place/x/@21.0367,105.8347,17z')).toEqual({
      lat: 21.0367,
      lon: 105.8347,
    });
    expect(leesCoordinaten('https://maps.google.com/?q=21.03,105.85')).toEqual({
      lat: 21.03,
      lon: 105.85,
    });
  });

  it('geeft null bij iets wat geen plek is', () => {
    expect(leesCoordinaten('Hoan Kiem')).toBeNull();
    expect(leesCoordinaten('95.0, 105.0')).toBeNull();
  });
});

describe('leesSluitingen', () => {
  it('leest een sluiting per regel en kan weer terug naar tekst', () => {
    const uitkomst = leesSluitingen('2026-09-04 tot 2026-11-02: onderhoud\n\n');
    expect(uitkomst).toEqual({
      sluitingen: [{ van: '2026-09-04', tot: '2026-11-02', reden: 'onderhoud' }],
    });
    if ('sluitingen' in uitkomst) {
      expect(sluitingenAlsTekst(uitkomst.sluitingen)).toBe('2026-09-04 tot 2026-11-02: onderhoud');
    }
  });

  it('wijst een regel aan die niet te lezen is', () => {
    expect(leesSluitingen('in september dicht')).toEqual({ fout: 'in september dicht' });
    expect(leesSluitingen('2026-11-02 tot 2026-09-04: omgekeerd')).toEqual({
      fout: '2026-11-02 tot 2026-09-04: omgekeerd',
    });
  });
});
