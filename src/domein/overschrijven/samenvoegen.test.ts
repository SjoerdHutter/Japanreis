import { describe, expect, it } from 'vitest';
import { leesPad, overschrijvingId, pasToe, type Overschrijving } from './samenvoegen';

const o = (doel: string, doelId: string, veld: string, waarde: unknown): Overschrijving => ({
  id: overschrijvingId(doel, doelId, veld),
  doel,
  doelId,
  veld,
  waarde,
  gewijzigdOp: '2026-10-08T10:00:00Z',
});

describe('eigen waarden', () => {
  const plaats = {
    id: 'fushimi',
    naam: 'Fushimi',
    attractie: { type: 'schrijn', drukte: { besteMoment: 'vroeg' } },
  };

  it('legt een eigen waarde diep in het object, zonder het origineel te wijzigen', () => {
    const { waarde, eigen } = pasToe(
      plaats,
      [
        o('plaats', 'fushimi', 'attractie.drukte.besteTijdslot', 'voor 07:00'),
        o('plaats', 'ander', 'naam', 'x'),
      ],
      'plaats',
      'fushimi',
    );
    expect(leesPad(waarde, 'attractie.drukte.besteTijdslot')).toBe('voor 07:00');
    expect(leesPad(waarde, 'attractie.drukte.besteMoment')).toBe('vroeg');
    expect(waarde.naam).toBe('Fushimi');
    expect([...eigen]).toEqual(['attractie.drukte.besteTijdslot']);
    expect(leesPad(plaats, 'attractie.drukte.besteTijdslot')).toBeUndefined();
  });

  it('maakt een tak aan die er nog niet was', () => {
    const { waarde } = pasToe(
      { id: 'x' },
      [o('plaats', 'x', 'alleenContant', true)],
      'plaats',
      'x',
    );
    expect(waarde).toEqual({ id: 'x', alleenContant: true });
  });

  it('laat alles staan zonder eigen waarden', () => {
    const { waarde, eigen } = pasToe(plaats, [], 'plaats', 'fushimi');
    expect(waarde).toBe(plaats);
    expect(eigen.size).toBe(0);
  });
});
