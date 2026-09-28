import { describe, expect, it } from 'vitest';
import { alsReistijd } from './weergave';

describe('alsReistijd', () => {
  it('schrijft minuten en uren kort, afgerond op vijf minuten', () => {
    expect(alsReistijd(4)).toBe('5 min');
    expect(alsReistijd(20)).toBe('20 min');
    expect(alsReistijd(60)).toBe('1 uur');
    expect(alsReistijd(85)).toBe('1 uur 25 min');
    expect(alsReistijd(226)).toBe('3 uur 45 min');
  });
});
