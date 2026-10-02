import { describe, expect, it } from 'vitest';
import { ZINNEN } from '@/data/content';
import { zinSchema } from '@/domein/schema';

/**
 * De antwoorden bij de zinnen. Elke zin die je aan iemand stelt hoort te laten
 * zien wat je terug kunt horen; alleen de borden niet, want een bord antwoordt
 * niet.
 */

describe('antwoorden bij de zinnen', () => {
  it('elke zin buiten de borden heeft antwoorden, met elk antwoord één keer', () => {
    const zinnen = ZINNEN.filter((z) => z.categorie !== 'borden' && !z.id.startsWith('wijs-'));
    expect(zinnen.length).toBeGreaterThan(30);
    for (const zin of zinnen) {
      const antwoorden = zin.antwoorden ?? [];
      expect(antwoorden.length, zin.id).toBeGreaterThanOrEqual(2);
      const lokaal = antwoorden.map((a) => a.lokaal);
      expect(new Set(lokaal).size, `${zin.id} heeft een antwoord dubbel`).toBe(lokaal.length);
      expect(zin.antwoordenGecontroleerd, zin.id).toBe(false);
    }
  });

  it('een gedeeld rijtje komt terug bij elke zin die het noemt, met de eigen antwoorden erachter', () => {
    const uitgang = ZINNEN.find((z) => z.id === 'waar-uitgang')!;
    const lokaal = uitgang.antwoorden!.map((a) => a.lokaal);
    expect(lokaal[0]).toBe('まっすぐです');
    expect(lokaal).toContain('〇番出口です');

    const station = ZINNEN.find((z) => z.id === 'station')!;
    expect(station.antwoorden!.map((a) => a.lokaal)).toContain('まっすぐです');
  });

  it('het verzoek om een antwoord aan te wijzen staat er in beide talen', () => {
    expect(ZINNEN.find((z) => z.id === 'wijs-antwoord-ja')?.land).toBe('japan');
    expect(ZINNEN.find((z) => z.id === 'wijs-antwoord-vn')?.land).toBe('vietnam');
  });

  it('maakt van een rijtje uit een alias één platte lijst', () => {
    const een = { lokaal: 'はい', uitspraak: 'hai', nederlands: 'Ja' };
    const twee = { lokaal: 'いいえ', uitspraak: 'iie', nederlands: 'Nee' };
    const zin = zinSchema.parse({
      id: 'x',
      categorie: 'basis',
      land: 'japan',
      nederlands: 'Vraag',
      lokaal: 'か',
      uitspraak: 'ka',
      antwoorden: [[een], twee],
    });
    expect(zin.antwoorden).toEqual([een, twee]);
  });
});
