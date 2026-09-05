import { describe, expect, it } from 'vitest';
import type { Plaats, Stad } from '@/domein/schema';
import { LEEG_FILTER, filterActief, filterPlaatsen, keuzesUit, looptijdMinuten } from './plaatsen';

const KYOTO: Stad = {
  id: 'kyoto',
  naam: 'Kyoto',
  land: 'japan',
  tijdzone: 'Asia/Tokyo',
  valuta: 'JPY',
  centrum: { lat: 35.0116, lon: 135.7681 },
  straalKm: 20,
  kaartgebied: { zuidwest: { lat: 34.93, lon: 135.66 }, noordoost: { lat: 35.08, lon: 135.83 } },
  tijdlijn: 'japan',
  tijdvakken: [],
  korteBeschrijving: '',
  volgorde: 1,
};

const KYOTO_STATION = { lat: 34.9858, lon: 135.7588 };
// Woensdag 8 april 2026, 12:00 in Japan.
const NU = new Date('2026-04-08T03:00:00Z');

const tempel: Plaats = {
  id: 'tempel',
  naam: 'Kiyomizu-dera',
  naamLokaal: '清水寺',
  stad: 'kyoto',
  categorie: 'attractie',
  coordinaten: { lat: 34.9949, lon: 135.785 },
  prijs: { bedrag: 500, valuta: 'JPY' },
  tijdvakken: ['edo'],
  openingstijden: { standaard: '06:00-18:00' },
  attractie: {
    type: 'tempel',
    bezoekduurMinuten: 90,
    regenbestendig: false,
    dagdeel: ['ochtend', 'avond'],
  },
};

const museum: Plaats = {
  id: 'museum',
  naam: 'Nationaal museum',
  stad: 'kyoto',
  categorie: 'attractie',
  coordinaten: { lat: 34.99, lon: 135.7735 },
  prijs: { bedrag: 1000, valuta: 'JPY' },
  tijdvakken: ['heian', 'edo'],
  openingstijden: { standaard: '09:30-17:00', perDag: { maandag: 'gesloten' } },
  attractie: { type: 'museum', bezoekduurMinuten: 150, regenbestendig: true, dagdeel: ['middag'] },
};

const bamboe: Plaats = {
  id: 'bamboe',
  naam: 'Bamboebos',
  stad: 'kyoto',
  categorie: 'attractie',
  coordinaten: { lat: 35.017, lon: 135.6716 },
  prijs: 'gratis',
  openingstijden: { standaard: 'Dag en nacht open' },
  attractie: { type: 'park', bezoekduurMinuten: 30, regenbestendig: false, dagdeel: ['ochtend'] },
};

const ramen: Plaats = {
  id: 'ramen',
  naam: 'Ramen bij het station',
  stad: 'kyoto',
  categorie: 'eten',
  coordinaten: { lat: 34.9862, lon: 135.7595 },
  prijs: { bedrag: 1100, valuta: 'JPY' },
  openingstijden: { standaard: '11:00-23:00' },
  eten: { keuken: 'ramen', lateNight: true, moeite: 'snelle-bak' },
};

const kaiseki: Plaats = {
  id: 'kaiseki',
  naam: 'Kaiseki in Gion',
  stad: 'kyoto',
  categorie: 'eten',
  coordinaten: { lat: 35.0037, lon: 135.7752 },
  prijs: { bedrag: 18000, valuta: 'JPY' },
  reservering: 'verplicht',
  openingstijden: { standaard: '17:30-21:00' },
  eten: { keuken: 'kaiseki', moeite: 'waardig-een-omweg' },
};

const ontbijt: Plaats = {
  id: 'markt',
  naam: 'Nishiki markt',
  stad: 'kyoto',
  categorie: 'eten',
  coordinaten: { lat: 35.005, lon: 135.7649 },
  prijs: { bedrag: 800, valuta: 'JPY' },
  openingstijden: { standaard: '09:00-18:00' },
  eten: { keuken: 'streetfood', ontbijt: true, moeite: 'waardig-een-omweg' },
};

const ALLE = [tempel, museum, bamboe, ramen, kaiseki, ontbijt];
const ids = (plaatsen: Plaats[]) => plaatsen.map((p) => p.id).sort();

describe('een leeg filter', () => {
  it('laat alles staan, zodat je nooit voor een leeg scherm staat', () => {
    expect(filterPlaatsen(ALLE, LEEG_FILTER, KYOTO, NU)).toHaveLength(ALLE.length);
  });

  it('telt niet als actief', () => {
    expect(filterActief(LEEG_FILTER)).toBe(false);
    expect(filterActief({ typen: [] })).toBe(false);
    expect(filterActief({ zoek: '  ' })).toBe(false);
    expect(filterActief({ vanaf: KYOTO_STATION })).toBe(false);
    expect(filterActief({ typen: ['museum'] })).toBe(true);
  });
});

describe('filters voor attracties, hoofdstuk 2', () => {
  it('filtert op type', () => {
    expect(ids(filterPlaatsen(ALLE, { typen: ['museum'] }, KYOTO, NU))).toEqual(['museum']);
    expect(ids(filterPlaatsen(ALLE, { typen: ['tempel', 'park'] }, KYOTO, NU))).toEqual([
      'bamboe',
      'tempel',
    ]);
  });

  it('filtert op bezoekduur', () => {
    expect(ids(filterPlaatsen([tempel, museum, bamboe], { maxBezoekduur: 60 }, KYOTO, NU))).toEqual(
      ['bamboe'],
    );
  });

  it('houdt een punt zonder opgegeven duur staan, want onbekend is geen te lang', () => {
    const zonderDuur: Plaats = { ...bamboe, id: 'zonder', attractie: { type: 'park' } };
    expect(ids(filterPlaatsen([zonderDuur], { maxBezoekduur: 15 }, KYOTO, NU))).toEqual(['zonder']);
  });

  it('filtert op regenbestendig', () => {
    expect(ids(filterPlaatsen(ALLE, { regenbestendig: true }, KYOTO, NU))).toEqual(['museum']);
  });

  it('filtert op dagdeel', () => {
    expect(ids(filterPlaatsen(ALLE, { dagdelen: ['avond'] }, KYOTO, NU))).toEqual(['tempel']);
    expect(ids(filterPlaatsen(ALLE, { dagdelen: ['ochtend'] }, KYOTO, NU))).toEqual([
      'bamboe',
      'tempel',
    ]);
  });
});

describe('filters voor eten, hoofdstuk 3', () => {
  it('filtert op keuken', () => {
    expect(ids(filterPlaatsen(ALLE, { keukens: ['ramen'] }, KYOTO, NU))).toEqual(['ramen']);
  });

  it('filtert op prijsklasse, met de grenzen uit de specificatie', () => {
    // De klasse geldt voor elk punt met een prijs en niet alleen voor eten: een
    // tempel van ¥500 valt net zo goed in de onderste trede, tot ¥1.500 (EUR 9).
    // Het scherm toont deze knoppen bij eten, maar de logica hoeft dat
    // onderscheid niet te kennen.
    expect(ids(filterPlaatsen(ALLE, { prijsklassen: ['jpy-1'] }, KYOTO, NU))).toEqual([
      'bamboe',
      'markt',
      'museum',
      'ramen',
      'tempel',
    ]);
    // ¥18.000 valt in de bovenste klasse, vanaf ¥10.000 (EUR 58).
    expect(ids(filterPlaatsen(ALLE, { prijsklassen: ['jpy-4'] }, KYOTO, NU))).toEqual(['kaiseki']);
  });

  it('rekent gratis mee in de goedkoopste klasse', () => {
    expect(ids(filterPlaatsen([bamboe], { prijsklassen: ['jpy-1'] }, KYOTO, NU))).toEqual([
      'bamboe',
    ]);
  });

  it('markeert ontbijt en late night apart', () => {
    expect(ids(filterPlaatsen(ALLE, { ontbijt: true }, KYOTO, NU))).toEqual(['markt']);
    expect(ids(filterPlaatsen(ALLE, { lateNight: true }, KYOTO, NU))).toEqual(['ramen']);
  });

  it('scheidt een omweg waard van een snelle bak', () => {
    expect(ids(filterPlaatsen(ALLE, { moeite: 'snelle-bak' }, KYOTO, NU))).toEqual(['ramen']);
    expect(ids(filterPlaatsen(ALLE, { moeite: 'waardig-een-omweg' }, KYOTO, NU))).toEqual([
      'kaiseki',
      'markt',
    ]);
  });

  it('toont waar reserveren verplicht is', () => {
    expect(ids(filterPlaatsen(ALLE, { reserveringVerplicht: true }, KYOTO, NU))).toEqual([
      'kaiseki',
    ]);
  });
});

describe('het voorbeeld uit de specificatie', () => {
  it('vindt ramen onder EUR 9 binnen 10 minuten lopen van het station', () => {
    const gevonden = filterPlaatsen(
      ALLE,
      {
        keukens: ['ramen'],
        prijsklassen: ['jpy-1'],
        maxLooptijd: 10,
        vanaf: KYOTO_STATION,
      },
      KYOTO,
      NU,
    );
    expect(ids(gevonden)).toEqual(['ramen']);
  });

  it('laat dezelfde ramenzaak vallen zodra je verder weg staat', () => {
    const gevonden = filterPlaatsen(
      ALLE,
      { keukens: ['ramen'], maxLooptijd: 10, vanaf: { lat: 35.0394, lon: 135.7292 } },
      KYOTO,
      NU,
    );
    expect(gevonden).toEqual([]);
  });

  it('doet niets met een looptijd zonder vertrekpunt, in plaats van alles weg te gooien', () => {
    expect(filterPlaatsen(ALLE, { maxLooptijd: 1 }, KYOTO, NU)).toHaveLength(ALLE.length);
  });
});

describe('filters die met de klok te maken hebben', () => {
  it('verbergt wat vandaag een vaste sluitingsdag heeft', () => {
    const maandag = new Date('2026-04-13T03:00:00Z');
    expect(
      ids(filterPlaatsen(ALLE, { verbergVandaagGesloten: true }, KYOTO, maandag)),
    ).not.toContain('museum');
    expect(ids(filterPlaatsen(ALLE, { verbergVandaagGesloten: true }, KYOTO, NU))).toContain(
      'museum',
    );
  });

  it('filtert op nu open, en rekent daarbij met de klok in Japan', () => {
    // 12:00 in Japan: de kaiseki gaat pas om 17:30 open.
    expect(ids(filterPlaatsen(ALLE, { nuOpen: true }, KYOTO, NU))).not.toContain('kaiseki');
    // 19:00 in Japan: dan wel.
    const avond = new Date('2026-04-08T10:00:00Z');
    expect(ids(filterPlaatsen(ALLE, { nuOpen: true }, KYOTO, avond))).toContain('kaiseki');
  });

  it('verbergt geen plaats waarvan de tijden niet uit te rekenen zijn', () => {
    // "Dag en nacht open" levert geen klok op; die hoort te blijven staan.
    expect(ids(filterPlaatsen([bamboe], { nuOpen: true }, KYOTO, NU))).toEqual(['bamboe']);
  });
});

describe('zoeken en tijdvakken', () => {
  it('zoekt door naam, lokale naam en beschrijving heen', () => {
    expect(ids(filterPlaatsen(ALLE, { zoek: 'kiyomizu' }, KYOTO, NU))).toEqual(['tempel']);
    expect(ids(filterPlaatsen(ALLE, { zoek: '清水寺' }, KYOTO, NU))).toEqual(['tempel']);
  });

  it('trekt zich niets aan van accenten of hoofdletters', () => {
    const senso: Plaats = { ...tempel, id: 'senso', naam: 'Sensō-ji' };
    expect(ids(filterPlaatsen([senso], { zoek: 'SENSO' }, KYOTO, NU))).toEqual(['senso']);
  });

  it('eist dat elk woord voorkomt, zodat twee woorden verfijnen en niet verbreden', () => {
    expect(ids(filterPlaatsen(ALLE, { zoek: 'ramen station' }, KYOTO, NU))).toEqual(['ramen']);
    expect(filterPlaatsen(ALLE, { zoek: 'ramen gion' }, KYOTO, NU)).toEqual([]);
  });

  it('filtert op tijdvak, zodat je vanaf de tijdlijn terug kunt kijken', () => {
    expect(ids(filterPlaatsen(ALLE, { tijdvak: 'edo' }, KYOTO, NU))).toEqual(['museum', 'tempel']);
    expect(ids(filterPlaatsen(ALLE, { tijdvak: 'heian' }, KYOTO, NU))).toEqual(['museum']);
  });
});

describe('filters combineren', () => {
  it('werkt als en, niet als of', () => {
    const gevonden = filterPlaatsen(
      ALLE,
      { typen: ['tempel', 'museum'], regenbestendig: true },
      KYOTO,
      NU,
    );
    expect(ids(gevonden)).toEqual(['museum']);
  });
});

describe('looptijdMinuten', () => {
  it('rekent op vier kilometer per uur', () => {
    // Ongeveer 400 meter hoort op ongeveer zes minuten uit te komen.
    expect(looptijdMinuten({ lat: 35.0, lon: 135.77 }, { lat: 35.0036, lon: 135.77 })).toBe(6);
  });

  it('rondt nooit naar nul af, want nul minuten lopen bestaat niet', () => {
    expect(looptijdMinuten(KYOTO_STATION, KYOTO_STATION)).toBe(1);
  });
});

describe('keuzesUit', () => {
  it('biedt alleen aan wat in deze stad voorkomt', () => {
    const keuzes = keuzesUit(ALLE);
    expect(keuzes.typen).toEqual(['museum', 'park', 'tempel']);
    expect(keuzes.keukens).toEqual(['kaiseki', 'ramen', 'streetfood']);
    expect(keuzes.keukens).not.toContain('pho');
  });

  it('houdt de dagdelen in de volgorde van de dag en niet op alfabet', () => {
    expect(keuzesUit(ALLE).dagdelen).toEqual(['ochtend', 'middag', 'avond']);
  });

  it('meldt welke losse schakelaars zin hebben', () => {
    const keuzes = keuzesUit(ALLE);
    expect(keuzes.heeftRegenbestendig).toBe(true);
    expect(keuzes.heeftOntbijt).toBe(true);
    expect(keuzes.heeftLateNight).toBe(true);
    expect(keuzes.heeftReservering).toBe(true);
    expect(keuzes.heeftGratis).toBe(true);
    expect(keuzesUit([kaiseki]).heeftGratis).toBe(false);
  });

  it('verzamelt de tijdvakken die er werkelijk zijn', () => {
    expect(keuzesUit(ALLE).tijdvakken.sort()).toEqual(['edo', 'heian']);
  });
});
