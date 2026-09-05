import { describe, expect, it } from 'vitest';
import { dagdeelIn, datumIn, momentInZone, uurIn, volgendeMiddernacht } from './zones';

const TOKIO = 'Asia/Tokyo';
const HANOI = 'Asia/Ho_Chi_Minh';
const THUIS = 'Europe/Amsterdam';

describe('datumIn', () => {
  it('geeft de datum in de zone zelf, niet die van het toestel', () => {
    // 23:00 UTC is in Japan al de volgende ochtend.
    const moment = new Date('2026-04-10T23:00:00Z');
    expect(datumIn(TOKIO, moment)).toBe('2026-04-11');
    expect(datumIn(HANOI, moment)).toBe('2026-04-11');
    expect(datumIn(THUIS, moment)).toBe('2026-04-11');
  });

  it('laat de drie zones uit elkaar lopen waar dat hoort', () => {
    // 18:00 UTC: in Japan is het al de elfde, in Vietnam en thuis nog de tiende.
    const moment = new Date('2026-04-10T18:00:00Z');
    expect(datumIn(TOKIO, moment)).toBe('2026-04-11');
    expect(datumIn(HANOI, moment)).toBe('2026-04-11');
    expect(datumIn(THUIS, moment)).toBe('2026-04-10');
  });
});

describe('volgendeMiddernacht', () => {
  it('valt in Japan op 15:00 UTC, want Japan loopt negen uur voor', () => {
    const moment = new Date('2026-04-10T10:00:00Z');
    expect(volgendeMiddernacht(TOKIO, moment).toISOString()).toBe('2026-04-10T15:00:00.000Z');
  });

  it('valt in Vietnam op 17:00 UTC, want Vietnam loopt zeven uur voor', () => {
    const moment = new Date('2026-04-10T10:00:00Z');
    expect(volgendeMiddernacht(HANOI, moment).toISOString()).toBe('2026-04-10T17:00:00.000Z');
  });

  it('ligt altijd in de toekomst, ook vlak voor middernacht', () => {
    const netVoorMiddernachtInJapan = new Date('2026-04-10T14:59:00Z');
    const grens = volgendeMiddernacht(TOKIO, netVoorMiddernachtInJapan);
    expect(grens.getTime()).toBeGreaterThan(netVoorMiddernachtInJapan.getTime());
    expect(grens.toISOString()).toBe('2026-04-10T15:00:00.000Z');
  });

  it('rekent over een maandgrens heen', () => {
    const moment = new Date('2026-04-30T10:00:00Z');
    expect(volgendeMiddernacht(TOKIO, moment).toISOString()).toBe('2026-04-30T15:00:00.000Z');
    const laterOpDeDag = new Date('2026-04-30T16:00:00Z');
    expect(volgendeMiddernacht(TOKIO, laterOpDeDag).toISOString()).toBe('2026-05-01T15:00:00.000Z');
  });

  it('houdt de zomertijd thuis netjes aan', () => {
    // In de nacht van 28 op 29 maart 2026 gaat de klok in Amsterdam vooruit.
    const moment = new Date('2026-03-28T12:00:00Z');
    expect(volgendeMiddernacht(THUIS, moment).toISOString()).toBe('2026-03-28T23:00:00.000Z');
  });
});

describe('uurIn en dagdeelIn', () => {
  it('leest het uur in de zone van de stad', () => {
    const moment = new Date('2026-04-10T00:00:00Z');
    expect(uurIn(TOKIO, moment)).toBe(9);
    expect(uurIn(HANOI, moment)).toBe(7);
  });

  it('deelt de dag in', () => {
    expect(dagdeelIn(TOKIO, new Date('2026-04-09T22:00:00Z'))).toBe('ochtend');
    expect(dagdeelIn(TOKIO, new Date('2026-04-10T05:00:00Z'))).toBe('middag');
    expect(dagdeelIn(TOKIO, new Date('2026-04-10T10:00:00Z'))).toBe('avond');
    expect(dagdeelIn(TOKIO, new Date('2026-04-10T18:00:00Z'))).toBe('nacht');
  });
});

describe('momentInZone', () => {
  it('leest een wandklok in de zone van de stad', () => {
    // 18:30 in Tokio is 09:30 UTC, want Japan loopt negen uur voor.
    expect(momentInZone(TOKIO, '2026-04-02T18:30:00')?.toISOString()).toBe(
      '2026-04-02T09:30:00.000Z',
    );
  });

  it('geeft dezelfde wandklok een ander moment in een andere zone', () => {
    expect(momentInZone(HANOI, '2026-04-02T18:30:00')?.toISOString()).toBe(
      '2026-04-02T11:30:00.000Z',
    );
  });

  it('neemt genoegen met een spatie in plaats van een T, en met ontbrekende seconden', () => {
    expect(momentInZone(TOKIO, '2026-04-02 18:30')?.toISOString()).toBe('2026-04-02T09:30:00.000Z');
  });

  it('houdt rekening met de zomertijd thuis', () => {
    // Eind april geldt in Amsterdam UTC+2.
    expect(momentInZone(THUIS, '2026-04-20T12:00:00')?.toISOString()).toBe(
      '2026-04-20T10:00:00.000Z',
    );
  });

  it('geeft niets terug bij iets dat geen wandklok is', () => {
    expect(momentInZone(TOKIO, 'gisteravond')).toBeNull();
    expect(momentInZone(TOKIO, '')).toBeNull();
  });
});
