import { describe, expect, it } from 'vitest';
import { bepaalReisstatus } from './reisstatus';
import type { Reisschema } from '@/domein/schema';

const SCHEMA: Reisschema = {
  naam: 'Japan en Hanoi',
  segmenten: [
    { stad: 'hanoi', van: '2026-10-04', tot: '2026-10-04' },
    { stad: 'osaka', van: '2026-10-05', tot: '2026-10-06' },
    { stad: 'tokio', van: '2026-10-18', tot: '2026-10-23' },
  ],
};

describe('bepaalReisstatus', () => {
  it('telt de dagen tot vertrek', () => {
    const status = bepaalReisstatus(SCHEMA, '2026-09-06');
    expect(status.fase).toBe('voor-vertrek');
    expect(status.dagenTot).toBe(28);
    expect(status.vertrek).toBe('2026-10-04');
    expect(status.terug).toBe('2026-10-23');
  });

  it('zegt onderweg op de eerste en de laatste dag zelf', () => {
    expect(bepaalReisstatus(SCHEMA, '2026-10-04').fase).toBe('onderweg');
    expect(bepaalReisstatus(SCHEMA, '2026-10-23').fase).toBe('onderweg');
  });

  it('zegt onderweg op een dag tussen twee steden in, ook zonder segment', () => {
    // 7 tot en met 17 oktober zit in geen enkel segment van dit testschema,
    // maar je bent dan wel degelijk op reis.
    expect(bepaalReisstatus(SCHEMA, '2026-10-12').fase).toBe('onderweg');
  });

  it('zegt afgelopen vanaf de dag na terugkomst', () => {
    expect(bepaalReisstatus(SCHEMA, '2026-10-24').fase).toBe('afgelopen');
  });

  it('zegt geen-datums bij een schema waar niets is ingevuld', () => {
    const leeg: Reisschema = { naam: 'x', segmenten: [{ stad: 'tokio' }, { stad: 'kyoto' }] };
    expect(bepaalReisstatus(leeg, '2026-09-06')).toEqual({ fase: 'geen-datums' });
  });

  it('telt één dag als vertrek morgen is', () => {
    expect(bepaalReisstatus(SCHEMA, '2026-10-03').dagenTot).toBe(1);
  });
});
