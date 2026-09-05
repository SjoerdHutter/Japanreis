import { describe, expect, it } from 'vitest';
import type { Plaats, Stad } from '@/domein/schema';
import {
  dagstatus,
  nuOpen,
  sluitingswaarschuwing,
  vasteSluitingsdagen,
  waarschuwingstekst,
  weekdagIn,
} from './status';

const KYOTO: Stad = {
  id: 'kyoto',
  naam: 'Kyoto',
  land: 'japan',
  tijdzone: 'Asia/Tokyo',
  valuta: 'JPY',
  centrum: { lat: 35.0116, lon: 135.7681 },
  straalKm: 20,
  kaartgebied: {
    zuidwest: { lat: 34.93, lon: 135.66 },
    noordoost: { lat: 35.08, lon: 135.83 },
  },
  tijdlijn: 'japan',
  tijdvakken: [],
  korteBeschrijving: '',
  volgorde: 1,
};

const museum: Plaats = {
  id: 'museum',
  naam: 'Museum',
  stad: 'kyoto',
  categorie: 'attractie',
  coordinaten: { lat: 35.0, lon: 135.77 },
  attractie: { type: 'museum' },
  openingstijden: { standaard: '09:30-17:00', perDag: { maandag: 'gesloten' } },
};

// Woensdag 8 april 2026, 03:00 UTC is 12:00 in Japan.
const WOENSDAG = new Date('2026-04-08T03:00:00Z');
// Zondag 12 april 2026, 03:00 UTC.
const ZONDAG = new Date('2026-04-12T03:00:00Z');
// Maandag 13 april 2026, 03:00 UTC.
const MAANDAG = new Date('2026-04-13T03:00:00Z');

describe('weekdagIn', () => {
  it('leest de weekdag in de zone van de stad', () => {
    expect(weekdagIn('Asia/Tokyo', WOENSDAG)).toBe('woensdag');
    expect(weekdagIn('Asia/Tokyo', MAANDAG)).toBe('maandag');
  });

  it('rekent de dag om als de zones aan weerszijden van middernacht zitten', () => {
    // 18:00 UTC op zondag: thuis is het 20:00 en nog zondag, in Japan is het
    // al maandagochtend 03:00.
    const moment = new Date('2026-04-12T18:00:00Z');
    expect(weekdagIn('Europe/Amsterdam', moment)).toBe('zondag');
    expect(weekdagIn('Asia/Tokyo', moment)).toBe('maandag');
  });
});

describe('dagstatus', () => {
  it('leest een vaste sluitingsdag', () => {
    expect(dagstatus(museum.openingstijden, 'maandag')).toEqual({ soort: 'gesloten' });
  });

  it('valt op de standaardtijden terug voor een gewone dag', () => {
    expect(dagstatus(museum.openingstijden, 'dinsdag')).toEqual({
      soort: 'open',
      tijden: '09:30-17:00',
    });
  });

  it('zegt onbekend als er niets is ingevuld, in plaats van open te gokken', () => {
    expect(dagstatus(undefined, 'dinsdag')).toEqual({ soort: 'onbekend' });
    expect(dagstatus({}, 'dinsdag')).toEqual({ soort: 'onbekend' });
  });

  it('trekt zich niets aan van hoofdletters in de content', () => {
    expect(dagstatus({ perDag: { dinsdag: 'Gesloten' } }, 'dinsdag')).toEqual({
      soort: 'gesloten',
    });
  });
});

describe('vasteSluitingsdagen', () => {
  it('geeft de dagen in de volgorde van de week', () => {
    const tijden = {
      standaard: '09:00-17:00',
      perDag: { zondag: 'gesloten', dinsdag: 'gesloten' },
    };
    expect(vasteSluitingsdagen(tijden)).toEqual(['dinsdag', 'zondag']);
  });
});

describe('sluitingswaarschuwing', () => {
  it('zwijgt over een plaats die altijd open is, zodat je waarschuwingen blijft lezen', () => {
    const tempel: Plaats = { ...museum, openingstijden: { standaard: '06:00-17:00' } };
    expect(sluitingswaarschuwing(tempel, KYOTO, WOENSDAG)).toBeNull();
  });

  it('meldt dat het museum vandaag dicht is', () => {
    const uitkomst = sluitingswaarschuwing(museum, KYOTO, MAANDAG)!;
    expect(uitkomst.vandaagGesloten).toBe(true);
    expect(waarschuwingstekst(uitkomst)).toBe('Vandaag gesloten');
  });

  it('meldt de sluiting van morgen, want dan kun je nog schuiven', () => {
    const uitkomst = sluitingswaarschuwing(museum, KYOTO, ZONDAG)!;
    expect(uitkomst.vandaagGesloten).toBe(false);
    expect(uitkomst.volgendeSluiting).toEqual({ dag: 'maandag', overDagen: 1 });
    expect(waarschuwingstekst(uitkomst)).toBe('Morgen gesloten (maandag)');
  });

  it('noemt de sluitingsdag gewoon als hij verderop in de week valt', () => {
    const uitkomst = sluitingswaarschuwing(museum, KYOTO, WOENSDAG)!;
    expect(uitkomst.volgendeSluiting).toEqual({ dag: 'maandag', overDagen: 5 });
    expect(waarschuwingstekst(uitkomst)).toBe('Dicht op maandag');
  });

  it('rekent met de dag in Japan en niet met de dag op je eigen toestel', () => {
    // Zondag 18:00 UTC: thuis nog zondag, in Kyoto al maandag en dus dicht.
    const uitkomst = sluitingswaarschuwing(museum, KYOTO, new Date('2026-04-12T18:00:00Z'))!;
    expect(uitkomst.vandaagGesloten).toBe(true);
  });

  it('geeft een onregelmatige sluiting door, ook zonder vaste sluitingsdag', () => {
    const mausoleum: Plaats = {
      ...museum,
      openingstijden: { standaard: '07:30-10:30' },
      geslotenOpmerking: 'Jaarlijks meerdere weken dicht voor onderhoud.',
    };
    const uitkomst = sluitingswaarschuwing(mausoleum, KYOTO, WOENSDAG)!;
    expect(uitkomst.sluitingsdagen).toEqual([]);
    expect(uitkomst.opmerking).toContain('onderhoud');
  });
});

describe('nuOpen', () => {
  it('zegt open binnen de tijden', () => {
    // 12:00 in Japan valt binnen 09:30-17:00.
    expect(nuOpen(museum, KYOTO, WOENSDAG)).toBe(true);
  });

  it('zegt dicht buiten de tijden', () => {
    // 22:00 in Japan.
    expect(nuOpen(museum, KYOTO, new Date('2026-04-08T13:00:00Z'))).toBe(false);
  });

  it('zegt dicht op een vaste sluitingsdag, ook midden op de dag', () => {
    expect(nuOpen(museum, KYOTO, MAANDAG)).toBe(false);
  });

  it('kan overweg met twee blokken op een dag', () => {
    const pho: Plaats = { ...museum, openingstijden: { standaard: '06:00-10:00, 18:00-20:30' } };
    expect(nuOpen(pho, KYOTO, new Date('2026-04-07T22:00:00Z'))).toBe(true); // 07:00
    expect(nuOpen(pho, KYOTO, WOENSDAG)).toBe(false); // 12:00
    expect(nuOpen(pho, KYOTO, new Date('2026-04-08T10:00:00Z'))).toBe(true); // 19:00
  });

  it('kan overweg met een zaak die over middernacht heen doorgaat', () => {
    const izakaya: Plaats = { ...museum, openingstijden: { standaard: '17:00-02:00' } };
    expect(nuOpen(izakaya, KYOTO, new Date('2026-04-08T16:00:00Z'))).toBe(true); // 01:00
    expect(nuOpen(izakaya, KYOTO, WOENSDAG)).toBe(false); // 12:00
  });

  it('geeft niets terug bij tijden waar geen klok in staat, in plaats van te gokken', () => {
    const schrijn: Plaats = {
      ...museum,
      openingstijden: { standaard: 'Zonsopgang tot zonsondergang' },
    };
    expect(nuOpen(schrijn, KYOTO, WOENSDAG)).toBeNull();
    expect(nuOpen({ ...museum, openingstijden: undefined }, KYOTO, WOENSDAG)).toBeNull();
  });
});
