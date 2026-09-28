import { describe, expect, it } from 'vitest';
import type { Plaats, Stad } from '@/domein/schema';
import { splitsBijRegen } from './regen';

const STAD = { id: 'kyoto', tijdzone: 'Asia/Tokyo', valuta: 'JPY' } as Stad;
const plaats = (id: string, deel: Partial<Plaats>): Plaats =>
  ({
    id,
    naam: id,
    stad: 'kyoto',
    categorie: 'attractie',
    coordinaten: { lat: 35, lon: 135.7 },
    ...deel,
  }) as Plaats;

describe('splitsBijRegen', () => {
  it('houdt regenbestendige attracties en eten, en zet de rest apart', () => {
    const { binnen, buiten } = splitsBijRegen(
      [
        plaats('museum', { attractie: { type: 'museum', regenbestendig: true } }),
        plaats('bamboe', { attractie: { type: 'park', regenbestendig: false } }),
        plaats('tempel', { attractie: { type: 'tempel' } }),
        plaats('ramen', { categorie: 'eten', eten: { keuken: 'ramen' } }),
      ],
      STAD,
    );
    expect(binnen.map((p) => p.id)).toEqual(['museum', 'ramen']);
    expect(buiten.map((p) => p.id)).toEqual(['bamboe', 'tempel']);
  });
});
