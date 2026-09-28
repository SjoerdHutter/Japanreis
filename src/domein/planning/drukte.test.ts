import { describe, expect, it } from 'vitest';
import { STEDEN, laadPlaatsen } from '@/data/content';
import { alsTijdslotTekst, ankerVan, leesTijdslot } from './drukte';
import { maakDagplan } from './dagplanner';

describe('het rustigste moment lezen', () => {
  it('leest de vormen die in de content staan', () => {
    expect(leesTijdslot('voor 08:00')).toEqual({ tot: 480 });
    expect(leesTijdslot('Na 17:30')).toEqual({ van: 1050 });
    expect(leesTijdslot('07:00 tot 09:00')).toEqual({ van: 420, tot: 540 });
    expect(leesTijdslot('bij opening')).toEqual({ opening: true });
    expect(leesTijdslot('als het regent')).toBeNull();
    expect(alsTijdslotTekst({ van: 420, tot: 540 })).toBe('07:00 tot 09:00');
  });

  it('plant alleen vroeg of laat als de openingstijden dat toelaten', () => {
    expect(ankerVan({ tot: 480 }, null)).toBe('vroeg');
    expect(ankerVan({ tot: 480 }, { van: 540, tot: 1020 })).toBeNull();
    expect(ankerVan({ van: 1080 }, { van: 540, tot: 1020 })).toBeNull();
    expect(ankerVan({ van: 1080 }, null)).toBe('laat');
    expect(ankerVan({ van: 1020, tot: 1140 }, null)).toBe('laat');
  });
});

describe('de dagplanner en de drukte', () => {
  it('zet Fushimi Inari vooraan en legt uit waarom', async () => {
    const kyoto = STEDEN.find((s) => s.id === 'kyoto')!;
    const plaatsen = await laadPlaatsen('kyoto');
    const kies = (...ids: string[]) => plaatsen.filter((p) => ids.includes(p.id));
    const plan = maakDagplan({
      plaatsen: kies('nijo-jo', 'nishiki-markt', 'fushimi-inari'),
      stad: kyoto,
      datum: '2026-10-09',
      startMinuten: 7 * 60,
      eindMinuten: 20 * 60,
    });
    expect(plan.stops[0].plaats.id).toBe('fushimi-inari');
    expect(plan.stops[0].uitleg).toBe('Vroeg ingepland: voor 08:00 is het hier het rustigst.');
  });

  it('zegt het eerlijk als je dag te laat begint voor het rustige moment', async () => {
    const kyoto = STEDEN.find((s) => s.id === 'kyoto')!;
    const plaatsen = (await laadPlaatsen('kyoto')).filter((p) => p.id === 'arashiyama-bamboe');
    const plan = maakDagplan({
      plaatsen,
      stad: kyoto,
      datum: '2026-10-09',
      startMinuten: 9 * 60,
      eindMinuten: 18 * 60,
    });
    expect(plan.stops[0].uitleg).toBe(
      'Het rustigst voor 07:30; begin je dag eerder om dat te halen.',
    );
  });

  it('zet Shibuya Crossing achteraan en wacht tot de avond', async () => {
    const tokio = STEDEN.find((s) => s.id === 'tokio')!;
    const plaatsen = (await laadPlaatsen('tokio')).filter((p) =>
      ['shibuya-crossing', 'meiji-jingu'].includes(p.id),
    );
    const plan = maakDagplan({
      plaatsen,
      stad: tokio,
      datum: '2026-10-19',
      startMinuten: 9 * 60,
      eindMinuten: 21 * 60,
    });
    const laatste = plan.stops[plan.stops.length - 1];
    expect(laatste.plaats.id).toBe('shibuya-crossing');
    expect(laatste.aankomst).toBe(18 * 60);
    expect(laatste.uitleg).toContain('na 18:00');
  });
});
