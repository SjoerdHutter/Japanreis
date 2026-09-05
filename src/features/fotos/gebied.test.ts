import { describe, expect, it } from 'vitest';
import { omhullendGebied } from './gebied';

const TERUGVAL = {
  zuidwest: { lat: 34.9, lon: 135.6 },
  noordoost: { lat: 35.1, lon: 135.9 },
};

describe('omhullendGebied', () => {
  it('valt terug op het meegegeven gebied als er geen punten zijn', () => {
    expect(omhullendGebied([], TERUGVAL)).toBe(TERUGVAL);
  });

  it('omvat alle punten, met een rand eromheen', () => {
    const gebied = omhullendGebied(
      [
        { lat: 21.0287, lon: 105.8524 },
        { lat: 35.7148, lon: 139.7967 },
      ],
      TERUGVAL,
    );
    expect(gebied.zuidwest.lat).toBeLessThan(21.0287);
    expect(gebied.noordoost.lat).toBeGreaterThan(35.7148);
    expect(gebied.zuidwest.lon).toBeLessThan(105.8524);
    expect(gebied.noordoost.lon).toBeGreaterThan(139.7967);
  });

  it('geeft ook bij één punt een gebied met hoogte en breedte', () => {
    const gebied = omhullendGebied([{ lat: 35, lon: 135 }], TERUGVAL);
    expect(gebied.noordoost.lat).toBeGreaterThan(gebied.zuidwest.lat);
    expect(gebied.noordoost.lon).toBeGreaterThan(gebied.zuidwest.lon);
  });
});
