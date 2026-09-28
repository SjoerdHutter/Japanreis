import { describe, expect, it } from 'vitest';
import { REISDAGEN, REISSCHEMA } from '@/data/content';
import { dagenVanDeReis, reisdagenZonderDatum } from './dagen';

describe('de reis dag voor dag', () => {
  const dagen = dagenVanDeReis(REISSCHEMA, REISDAGEN);

  it('heeft een kaart voor elke dag van de reis', () => {
    expect(dagen[0].datum).toBe('2026-10-04');
    expect(dagen[dagen.length - 1].datum).toBe('2026-10-23');
    expect(dagen).toHaveLength(20);
  });

  it('kent een dagtrip als tweede stad van de dag', () => {
    const dag = dagen.find((d) => d.datum === '2026-10-16')!;
    expect(dag.steden).toEqual(['shirakawa-go', 'takayama']);
    expect(dag.nachtStadId).toBe('takayama');
  });

  it('slaapt nergens op de nacht in het vliegtuig', () => {
    expect(dagen[0].nachtStadId).toBeUndefined();
    expect(dagen.find((d) => d.datum === '2026-10-23')!.nachtStadId).toBeUndefined();
  });

  it('zet de trein bij de dag waarop hij rijdt, en de rest apart', () => {
    expect(dagen.find((d) => d.datum === '2026-10-07')!.reisdagen.map((r) => r.id)).toEqual([
      'osaka-hiroshima',
    ]);
    expect(reisdagenZonderDatum(REISDAGEN).map((r) => r.id)).toEqual(['fuji']);
  });
});
