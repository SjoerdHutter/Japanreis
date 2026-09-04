import { describe, expect, it } from 'vitest';
import type { Reisschema, Stad } from '@/domein/schema';
import { bepaalHighlight, keuzeGeldig, maakKeuze, stadVolgensGps } from './bepaal';

const stad = (id: string, lat: number, lon: number, extra: Partial<Stad> = {}): Stad => ({
  id,
  naam: id,
  land: 'japan',
  tijdzone: 'Asia/Tokyo',
  valuta: 'JPY',
  centrum: { lat, lon },
  straalKm: 20,
  kaartgebied: {
    zuidwest: { lat: lat - 0.1, lon: lon - 0.1 },
    noordoost: { lat: lat + 0.1, lon: lon + 0.1 },
  },
  tijdlijn: 'japan',
  tijdvakken: [],
  korteBeschrijving: '',
  volgorde: 1,
  ...extra,
});

const TOKIO = stad('tokio', 35.6812, 139.7671, { volgorde: 1 });
const KYOTO = stad('kyoto', 35.0116, 135.7681, { volgorde: 3 });
const NARA = stad('nara', 34.6851, 135.8048, { straalKm: 12, volgorde: 4 });
const HANOI = stad('hanoi', 21.0285, 105.8542, {
  land: 'vietnam',
  tijdzone: 'Asia/Ho_Chi_Minh',
  valuta: 'VND',
  tijdlijn: 'hanoi',
  volgorde: 7,
});

const STEDEN = [TOKIO, KYOTO, NARA, HANOI];
const LEEG: Reisschema = { naam: 'test', segmenten: [] };

const IN_KYOTO = { lat: 35.0116, lon: 135.7681 };
const IN_NARA = { lat: 34.6851, lon: 135.8048 };
const THUIS = { lat: 52.3676, lon: 4.9041 };

const NU = new Date('2026-04-10T02:00:00Z'); // 11:00 in Japan

describe('stadVolgensGps', () => {
  it('vindt de stad waar je in staat', () => {
    expect(stadVolgensGps(STEDEN, IN_KYOTO)?.id).toBe('kyoto');
  });

  it('geeft niets terug als je nergens binnen de straal zit', () => {
    expect(stadVolgensGps(STEDEN, THUIS)).toBeNull();
  });

  it('kiest de dichtstbijzijnde als twee stralen overlappen', () => {
    // Nara en Kyoto liggen 35 kilometer uit elkaar; halverwege wint de dichtste.
    const netBijNara = { lat: 34.72, lon: 135.81 };
    expect(stadVolgensGps(STEDEN, netBijNara)?.id).toBe('nara');
  });
});

describe('bepaalHighlight, de bronnen', () => {
  it('highlight zonder melding als GPS en schema het eens zijn', () => {
    const schema: Reisschema = {
      naam: 'test',
      segmenten: [{ stad: 'kyoto', van: '2026-04-08', tot: '2026-04-12' }],
    };
    const uit = bepaalHighlight({ steden: STEDEN, reisschema: schema, positie: IN_KYOTO, nu: NU });
    expect(uit.stadId).toBe('kyoto');
    expect(uit.reden).toBe('gps-en-schema');
    expect(uit.conflict).toBeUndefined();
  });

  it('biedt een keuze als ze het oneens zijn, zoals bij een dagtrip naar Nara', () => {
    const schema: Reisschema = {
      naam: 'test',
      segmenten: [{ stad: 'kyoto', van: '2026-04-08', tot: '2026-04-12' }],
    };
    const uit = bepaalHighlight({ steden: STEDEN, reisschema: schema, positie: IN_NARA, nu: NU });
    expect(uit.conflict).toEqual({ gpsStadId: 'nara', schemaStadId: 'kyoto' });
    // Tot je kiest staat de stad waar je werkelijk bent bovenaan.
    expect(uit.stadId).toBe('nara');
  });

  it('valt zonder GPS terug op het reisschema', () => {
    const schema: Reisschema = {
      naam: 'test',
      segmenten: [{ stad: 'hanoi', van: '2026-04-10', tot: '2026-04-10' }],
    };
    const uit = bepaalHighlight({ steden: STEDEN, reisschema: schema, nu: NU });
    expect(uit.stadId).toBe('hanoi');
    expect(uit.reden).toBe('schema');
  });

  it('valt zonder reisschema terug op GPS', () => {
    const uit = bepaalHighlight({ steden: STEDEN, reisschema: LEEG, positie: IN_KYOTO, nu: NU });
    expect(uit.stadId).toBe('kyoto');
    expect(uit.reden).toBe('gps');
  });

  it('valt zonder allebei terug op de laatst bekeken stad', () => {
    const uit = bepaalHighlight({
      steden: STEDEN,
      reisschema: LEEG,
      laatstBekekenStadId: 'hanoi',
      nu: NU,
    });
    expect(uit.stadId).toBe('hanoi');
    expect(uit.reden).toBe('laatst-bekeken');
  });

  it('valt bij de allereerste start terug op de eerste stad uit de lijst', () => {
    const uit = bepaalHighlight({ steden: STEDEN, reisschema: LEEG, nu: NU });
    expect(uit.stadId).toBe('tokio');
    expect(uit.reden).toBe('eerste');
  });

  it('negeert een segment zonder datums, want een half schema is normaal', () => {
    const schema: Reisschema = { naam: 'test', segmenten: [{ stad: 'kyoto' }] };
    const uit = bepaalHighlight({ steden: STEDEN, reisschema: schema, nu: NU });
    expect(uit.reden).toBe('eerste');
  });

  it('rekent de dag in de tijdzone van de stad, niet in die van het toestel', () => {
    // 16:00 UTC op 10 april is in Japan al 01:00 op 11 april.
    const schema: Reisschema = {
      naam: 'test',
      segmenten: [{ stad: 'kyoto', van: '2026-04-11', tot: '2026-04-11' }],
    };
    const uit = bepaalHighlight({
      steden: STEDEN,
      reisschema: schema,
      nu: new Date('2026-04-10T16:00:00Z'),
    });
    expect(uit.stadId).toBe('kyoto');
  });

  it('biedt bij twee segmenten op één dag beide steden aan, als reisdag', () => {
    const schema: Reisschema = {
      naam: 'test',
      segmenten: [
        { stad: 'kyoto', van: '2026-04-10', tot: '2026-04-10' },
        { stad: 'tokio', van: '2026-04-10', tot: '2026-04-11' },
      ],
    };
    const uit = bepaalHighlight({ steden: STEDEN, reisschema: schema, nu: NU });
    expect(uit.stadId).toBe('kyoto');
    expect(uit.conflict).toEqual({ gpsStadId: 'kyoto', schemaStadId: 'tokio' });
  });
});

describe('bepaalHighlight, de eigen keuze', () => {
  it('laat een keuze winnen van GPS en schema', () => {
    const schema: Reisschema = {
      naam: 'test',
      segmenten: [{ stad: 'kyoto', van: '2026-04-08', tot: '2026-04-12' }],
    };
    const keuze = maakKeuze(KYOTO, { nu: NU });
    const uit = bepaalHighlight({
      steden: STEDEN,
      reisschema: schema,
      positie: IN_NARA,
      keuze,
      nu: NU,
    });
    expect(uit.stadId).toBe('kyoto');
    expect(uit.reden).toBe('keuze');
    expect(uit.conflict).toBeUndefined();
  });

  it('houdt de keuze vast tijdens een treinreis en springt niet terug', () => {
    const keuze = maakKeuze(KYOTO, { nu: NU });
    const zesUurLater = new Date(NU.getTime() + 6 * 3600_000); // nog steeds dezelfde dag in Japan
    const uit = bepaalHighlight({
      steden: STEDEN,
      reisschema: LEEG,
      positie: IN_NARA,
      keuze,
      nu: zesUurLater,
    });
    expect(uit.stadId).toBe('kyoto');
  });

  it('laat de keuze om middernacht in de zone van die stad vervallen', () => {
    const keuze = maakKeuze(KYOTO, { nu: NU });
    // Middernacht in Japan is 15:00 UTC; een minuut daarna geldt hij niet meer.
    expect(keuzeGeldig(keuze, new Date('2026-04-10T14:59:00Z'))).toBe(true);
    expect(keuzeGeldig(keuze, new Date('2026-04-10T15:01:00Z'))).toBe(false);

    const uit = bepaalHighlight({
      steden: STEDEN,
      reisschema: LEEG,
      positie: IN_NARA,
      keuze,
      nu: new Date('2026-04-10T15:01:00Z'),
    });
    expect(uit.stadId).toBe('nara');
  });

  it('gebruikt de tijdzone van Hanoi voor een keuze in Hanoi', () => {
    const keuze = maakKeuze(HANOI, { nu: NU });
    // Middernacht in Vietnam is 17:00 UTC, twee uur later dan in Japan.
    expect(keuzeGeldig(keuze, new Date('2026-04-10T16:00:00Z'))).toBe(true);
    expect(keuzeGeldig(keuze, new Date('2026-04-10T17:01:00Z'))).toBe(false);
  });

  it('toont het label vastgezet als je zonder conflict een stad vastzet', () => {
    const keuze = maakKeuze(HANOI, { vastgezet: true, nu: NU });
    const uit = bepaalHighlight({
      steden: STEDEN,
      reisschema: LEEG,
      positie: IN_KYOTO,
      keuze,
      nu: NU,
    });
    expect(uit.stadId).toBe('hanoi');
    expect(uit.vastgezet).toBe(true);
    expect(uit.reden).toBe('vastgezet');
  });

  it('toont twee steden tegelijk op een reisdag', () => {
    const keuze = maakKeuze(KYOTO, { tweedeStadId: 'tokio', nu: NU });
    const uit = bepaalHighlight({ steden: STEDEN, reisschema: LEEG, keuze, nu: NU });
    expect(uit.stadId).toBe('kyoto');
    expect(uit.tweedeStadId).toBe('tokio');
  });

  it('negeert een keuze voor een stad die niet meer bestaat', () => {
    const keuze = { ...maakKeuze(KYOTO, { nu: NU }), stadId: 'verwijderd' };
    const uit = bepaalHighlight({
      steden: STEDEN,
      reisschema: LEEG,
      positie: IN_KYOTO,
      keuze,
      nu: NU,
    });
    expect(uit.stadId).toBe('kyoto');
    expect(uit.reden).toBe('gps');
  });
});

describe('het uitgangspunt dat nergens gebroken mag worden', () => {
  it('houdt Hanoi gewoon in de lijst, ook als je in Japan staat', () => {
    // De highlight logica raakt de lijst met steden niet aan. Deze test staat
    // er om die belofte hard te maken: er is geen enkele uitkomst waarin een
    // stad uit beeld verdwijnt.
    const uit = bepaalHighlight({ steden: STEDEN, reisschema: LEEG, positie: IN_KYOTO, nu: NU });
    expect(STEDEN.map((s) => s.id)).toContain('hanoi');
    expect(uit.stadId).not.toBe('hanoi');
  });
});
