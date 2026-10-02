import { describe, expect, it } from 'vitest';
import { dagenIn, isVoorbij, periodeVan, verblijfIn } from './verblijf';
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

describe('dagenIn', () => {
  it('geeft elke dag in de stad, ook over meerdere verblijven', () => {
    expect(dagenIn(SCHEMA, 'hanoi')).toEqual(['2026-10-04', '2026-10-23']);
    expect(dagenIn(SCHEMA, 'kanazawa')).toEqual(['2026-10-13', '2026-10-14', '2026-10-15']);
    expect(dagenIn(SCHEMA, 'nara')).toEqual([]);
  });
});

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

describe('periodeVan', () => {
  const periode = (van: string, tot: string) => periodeVan([{ van, tot }]);

  it('schrijft één dag, twee dagen en een reeks dagen elk op hun eigen manier', () => {
    expect(periode('2026-10-04', '2026-10-04')).toBe('4 okt');
    expect(periode('2026-10-05', '2026-10-06')).toBe('5 en 6 okt');
    expect(periode('2026-10-08', '2026-10-12')).toBe('8 t/m 12 okt');
  });

  it('noemt beide maanden als het bezoek over een maandgrens loopt', () => {
    expect(periode('2026-09-30', '2026-10-02')).toBe('30 sep t/m 2 okt');
    expect(periode('2026-10-31', '2026-11-01')).toBe('31 okt en 1 nov');
  });

  it('zet twee bezoeken achter elkaar, zoals Hanoi heen en terug', () => {
    expect(periodeVan(verblijfIn(SCHEMA, 'hanoi'))).toBe('4 okt, 23 okt');
  });

  it('geeft niets voor een stad zonder datums', () => {
    expect(periodeVan(verblijfIn(SCHEMA, 'nara'))).toBeNull();
  });
});

describe('isVoorbij', () => {
  it('is pas voorbij de dag na het laatste bezoek', () => {
    const kanazawa = verblijfIn(SCHEMA, 'kanazawa');
    expect(isVoorbij(kanazawa, '2026-10-15')).toBe(false);
    expect(isVoorbij(kanazawa, '2026-10-16')).toBe(true);
  });

  it('telt een stad met nog een bezoek in het verschiet niet als voorbij', () => {
    expect(isVoorbij(verblijfIn(SCHEMA, 'hanoi'), '2026-10-10')).toBe(false);
  });

  it('noemt een stad zonder datums nooit voorbij', () => {
    expect(isVoorbij(verblijfIn(SCHEMA, 'nara'), '2026-12-31')).toBe(false);
  });
});
