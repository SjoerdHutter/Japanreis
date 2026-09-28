import { describe, expect, it } from 'vitest';
import { REISDAGEN, REISSCHEMA, STEDEN } from '@/data/content';
import { avondVoorNotitie } from './notitie';

describe('de avondvraag om een notitie', () => {
  const vraag = (iso: string) => avondVoorNotitie(new Date(iso), STEDEN, REISSCHEMA, REISDAGEN);

  it('komt na acht uur in de zone van de stad waar je bent', () => {
    // 9 oktober in Kyoto: 20:30 daar is 11:30 UTC.
    expect(vraag('2026-10-09T11:30:00Z')).toBe('2026-10-09');
    // Om half acht nog niet.
    expect(vraag('2026-10-09T10:30:00Z')).toBeNull();
    // Kwart voor twaalf 's avonds nog wel, voor dezelfde dag.
    expect(vraag('2026-10-09T14:45:00Z')).toBe('2026-10-09');
  });

  it('komt niet voor of na de reis', () => {
    expect(vraag('2026-09-28T19:00:00Z')).toBeNull();
    expect(vraag('2026-11-02T19:00:00Z')).toBeNull();
  });
});
