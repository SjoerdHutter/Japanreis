import { describe, expect, it } from 'vitest';
import { verblijfIn } from './verblijf';
import type { Reisschema } from '@/domein/schema';

const SCHEMA: Reisschema = {
  naam: 'Japan en Hanoi',
  segmenten: [
    { stad: 'hanoi', van: '2026-10-04', tot: '2026-10-04', opmerking: 'Overstap heen.' },
    {
      stad: 'kanazawa',
      van: '2026-10-13',
      tot: '2026-10-15',
      verblijf: { via: 'booking', nachten: 3, betaald: 'ja', ontbijt: false },
    },
    { stad: 'hanoi', van: '2026-10-23', tot: '2026-10-23', opmerking: 'Overstap terug.' },
    { stad: 'nara' },
  ],
};

describe('verblijfIn', () => {
  it('neemt de nachten over uit het schema in plaats van ze te berekenen', () => {
    // 13 tot en met 15 oktober zijn drie dagen. Of dat twee of drie nachten
    // zijn hangt van de boeking af en niet van de kalender: in Kyoto slaap je
    // ook de laatste dag, in Tokio vertrek je die ochtend. Een som over van en
    // tot heeft het dus in de helft van de gevallen mis.
    const [kanazawa] = verblijfIn(SCHEMA, 'kanazawa');
    expect(kanazawa.verblijf?.nachten).toBe(3);
    expect(kanazawa.verblijf?.via).toBe('booking');
  });

  it('laat een overstap zonder verblijf gewoon zonder nachten', () => {
    expect(verblijfIn(SCHEMA, 'hanoi')[0].verblijf).toBeUndefined();
  });

  it('geeft beide keren terug dat een stad in het schema staat', () => {
    const hanoi = verblijfIn(SCHEMA, 'hanoi');
    expect(hanoi).toHaveLength(2);
    expect(hanoi[0].opmerking).toBe('Overstap heen.');
    expect(hanoi[1].van).toBe('2026-10-23');
  });

  it('laat een segment zonder datums weg in plaats van er nul van te maken', () => {
    expect(verblijfIn(SCHEMA, 'nara')).toEqual([]);
  });

  it('geeft een lege lijst voor een stad die niet in het schema staat', () => {
    expect(verblijfIn(SCHEMA, 'hakone')).toEqual([]);
  });
});
