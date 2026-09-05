import { describe, expect, it } from 'vitest';
import { afstandKm, binnenGebied } from './afstand';

const TOKIO = { lat: 35.6812, lon: 139.7671 };
const KYOTO = { lat: 35.0116, lon: 135.7681 };
const HANOI = { lat: 21.0285, lon: 105.8542 };

describe('afstandKm', () => {
  it('geeft nul voor hetzelfde punt', () => {
    expect(afstandKm(TOKIO, TOKIO)).toBe(0);
  });

  it('rekent Tokio naar Kyoto op ongeveer 370 kilometer', () => {
    const km = afstandKm(TOKIO, KYOTO);
    expect(km).toBeGreaterThan(360);
    expect(km).toBeLessThan(380);
  });

  it('rekent Tokio naar Hanoi op ongeveer 3700 kilometer', () => {
    const km = afstandKm(TOKIO, HANOI);
    expect(km).toBeGreaterThan(3600);
    expect(km).toBeLessThan(3800);
  });

  it('is symmetrisch', () => {
    expect(afstandKm(TOKIO, HANOI)).toBeCloseTo(afstandKm(HANOI, TOKIO), 6);
  });
});

describe('binnenGebied', () => {
  const gebied = {
    zuidwest: { lat: 35.58, lon: 139.6 },
    noordoost: { lat: 35.78, lon: 139.85 },
  };

  it('herkent een punt binnen het gebied', () => {
    expect(binnenGebied(TOKIO, gebied)).toBe(true);
  });

  it('herkent een punt erbuiten', () => {
    expect(binnenGebied(KYOTO, gebied)).toBe(false);
  });

  it('rekent de rand mee, zodat een punt op de grens niet wegvalt', () => {
    expect(binnenGebied({ lat: 35.58, lon: 139.6 }, gebied)).toBe(true);
    expect(binnenGebied({ lat: 35.78, lon: 139.85 }, gebied)).toBe(true);
  });
});
