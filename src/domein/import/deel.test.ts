import { describe, expect, it } from 'vitest';
import type { EigenPunt } from '@/domein/schema';
import { leesGoogleCsv } from './googlemaps';
import { alsCsv } from './deel';

const punt = (extra: Partial<EigenPunt>): EigenPunt => ({
  id: 'a',
  naam: 'Fushimi Inari',
  bron: 'google-maps',
  toegevoegdOp: '2026-04-01T00:00:00Z',
  ...extra,
});

describe('alsCsv', () => {
  it('schrijft een kop en een regel per punt', () => {
    const csv = alsCsv([punt({ coordinaten: { lat: 34.9671, lon: 135.7727 } })]);
    const regels = csv.trim().split('\n');
    expect(regels[0]).toContain('Title');
    expect(regels).toHaveLength(2);
  });

  it('levert een bestand dat de eigen importer weer kan lezen', () => {
    // Dit is de hele belofte van de deelfunctie: wie het bestand krijgt, kan het
    // hier openen en heeft jouw punten.
    const origineel = [
      punt({
        naam: 'Nishiki markt',
        notitie: 'drukste rond 12, ga vroeg',
        coordinaten: { lat: 35.005, lon: 135.7649 },
        lijst: 'Japan tips',
      }),
    ];
    const terug = leesGoogleCsv(alsCsv(origineel));
    expect(terug).toHaveLength(1);
    expect(terug[0].naam).toBe('Nishiki markt');
    expect(terug[0].coordinaten).toEqual({ lat: 35.005, lon: 135.7649 });
    expect(terug[0].notitie).toBe('drukste rond 12, ga vroeg');
  });

  it("ontsnapt komma's en aanhalingstekens in plaats van de kolommen te breken", () => {
    const csv = alsCsv([punt({ naam: 'Zaak "De Hoek", achteraf', notitie: 'goed, echt goed' })]);
    const terug = leesGoogleCsv(csv);
    expect(terug[0].naam).toBe('Zaak "De Hoek", achteraf');
    expect(terug[0].notitie).toBe('goed, echt goed');
  });

  it('houdt een punt zonder plek gewoon in het bestand', () => {
    const terug = leesGoogleCsv(alsCsv([punt({ naam: 'Nog te plaatsen' })]));
    expect(terug[0].naam).toBe('Nog te plaatsen');
    expect(terug[0].coordinaten).toBeUndefined();
  });

  it('begint met een byte order mark, anders verminkt Excel de Japanse namen', () => {
    expect(alsCsv([punt({ naam: 'Sensō-ji' })]).startsWith('\uFEFF')).toBe(true);
  });

  it('deelt niets wat privé is', () => {
    const csv = alsCsv([punt({ naam: 'x', stadId: 'kyoto', koppelingPlaatsId: 'fushimi' })]);
    // Alleen wat over de plek gaat; geen interne verwijzingen of eigen ids.
    expect(csv).not.toContain('fushimi');
    expect(csv).not.toContain('toegevoegdOp');
  });
});
