import { describe, expect, it } from 'vitest';
import {
  coordinatenUitUrl,
  herkenSoort,
  leesBestand,
  leesCsvRijen,
  leesGoogleCsv,
  leesGoogleGeoJson,
  leesPlakLijst,
} from './googlemaps';

describe('coordinatenUitUrl', () => {
  it('leest het paar dat de plek zelf aanwijst', () => {
    expect(
      coordinatenUitUrl(
        'https://www.google.com/maps/place/Fushimi/data=!3m1!4b1!4m5!3m4!1s0x0:0x0!8m2!3d34.9671!4d135.7727',
      ),
    ).toEqual({ lat: 34.9671, lon: 135.7727 });
  });

  it('leest een zoekopdracht met coördinaten', () => {
    expect(
      coordinatenUitUrl('https://www.google.com/maps/search/?api=1&query=35.6812,139.7671'),
    ).toEqual({ lat: 35.6812, lon: 139.7671 });
  });

  it('leest een zoekopdracht waarin de komma gecodeerd is', () => {
    expect(
      coordinatenUitUrl('https://www.google.com/maps/search/?api=1&query=21.0285%2C105.8542'),
    ).toEqual({ lat: 21.0285, lon: 105.8542 });
  });

  it('valt terug op het midden van het kaartbeeld', () => {
    expect(coordinatenUitUrl('https://www.google.com/maps/@35.0116,135.7681,15z')).toEqual({
      lat: 35.0116,
      lon: 135.7681,
    });
  });

  it('geeft niets terug bij een link met alleen een plaats-id, in plaats van te gokken', () => {
    expect(coordinatenUitUrl('https://maps.app.goo.gl/5FQeSFsKYVt9a61P8')).toBeNull();
    expect(
      coordinatenUitUrl('https://www.google.com/maps/place/?q=place_id:ChIJ8cM8zdaAGGAR'),
    ).toBeNull();
  });

  it('weigert nul komma nul, want dat is een leeg veld en geen plek', () => {
    expect(coordinatenUitUrl('https://www.google.com/maps/search/?api=1&query=0.0,0.0')).toBeNull();
  });
});

describe('leesGoogleGeoJson', () => {
  const bestand = JSON.stringify({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [139.7967, 35.7148] },
        properties: {
          location: { name: 'Sensō-ji', address: '2-3-1 Asakusa, Tokio' },
          google_maps_url: 'https://maps.google.com/?cid=1',
          comment: 'vroeg gaan',
        },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [135.7727, 34.9671] },
        properties: { location: { name: 'Fushimi Inari' } },
      },
    ],
  });

  it('zet de lengtegraad en de breedtegraad in de goede volgorde', () => {
    const punten = leesGoogleGeoJson(bestand, 'Japan');
    // GeoJSON schrijft lengtegraad eerst; verwisselen zet Tokio in de oceaan.
    expect(punten[0].coordinaten).toEqual({ lat: 35.7148, lon: 139.7967 });
    expect(punten[1].coordinaten).toEqual({ lat: 34.9671, lon: 135.7727 });
  });

  it('neemt naam, adres, notitie en lijstnaam mee', () => {
    const [eerste] = leesGoogleGeoJson(bestand, 'Japan');
    expect(eerste.naam).toBe('Sensō-ji');
    expect(eerste.adres).toBe('2-3-1 Asakusa, Tokio');
    expect(eerste.notitie).toBe('vroeg gaan');
    expect(eerste.lijst).toBe('Japan');
  });

  it('klaagt over een bestand dat geen features heeft', () => {
    expect(() => leesGoogleGeoJson('{"iets":1}')).toThrow(/features/);
  });
});

describe('leesCsvRijen', () => {
  it('houdt een komma binnen aanhalingstekens bij elkaar', () => {
    expect(leesCsvRijen('Title,Note\n"Kyoto, Japan",mooi')).toEqual([
      ['Title', 'Note'],
      ['Kyoto, Japan', 'mooi'],
    ]);
  });

  it('leest een dubbel aanhalingsteken als één teken', () => {
    expect(leesCsvRijen('a\n"zeg ""hoi"""')).toEqual([['a'], ['zeg "hoi"']]);
  });

  it('laat een regeleinde binnen een veld staan', () => {
    expect(leesCsvRijen('Title,Note\nX,"twee\nregels"')).toEqual([
      ['Title', 'Note'],
      ['X', 'twee\nregels'],
    ]);
  });
});

describe('leesGoogleCsv', () => {
  it('haalt de coördinaten uit de link, want de CSV zelf heeft ze niet', () => {
    const csv =
      'Title,Note,URL\n' +
      'Nishiki markt,drukste rond 12,https://www.google.com/maps/search/?api=1&query=35.0050%2C135.7649\n';
    const [punt] = leesGoogleCsv(csv, 'Japan');
    expect(punt.naam).toBe('Nishiki markt');
    expect(punt.notitie).toBe('drukste rond 12');
    expect(punt.coordinaten).toEqual({ lat: 35.005, lon: 135.7649 });
  });

  it('houdt een punt zonder bruikbare link gewoon staan, zonder plek', () => {
    const csv = 'Title,Note,URL\nEen zaak,,https://maps.app.goo.gl/abc123\n';
    const [punt] = leesGoogleCsv(csv);
    expect(punt.naam).toBe('Een zaak');
    expect(punt.coordinaten).toBeUndefined();
  });

  it('weigert een bestand zonder titelkolom in plaats van er onzin van te maken', () => {
    expect(() => leesGoogleCsv('een,twee\n1,2')).toThrow(/Title/);
  });

  it('gebruikt losse kolommen met coördinaten als die er wel zijn', () => {
    const csv = 'Title,Latitude,Longitude\nHoan Kiem,21.0287,105.8524\n';
    expect(leesGoogleCsv(csv)[0].coordinaten).toEqual({ lat: 21.0287, lon: 105.8524 });
  });
});

describe('leesPlakLijst', () => {
  it('leest een kale lijst met namen', () => {
    const punten = leesPlakLijst('Fushimi Inari\n- Nishiki markt\n\n• Gion');
    expect(punten.map((p) => p.naam)).toEqual(['Fushimi Inari', 'Nishiki markt', 'Gion']);
    expect(punten[0].coordinaten).toBeUndefined();
  });

  it('pakt coördinaten op als je ze erachter zet', () => {
    expect(leesPlakLijst('Fushimi Inari; 34.9671; 135.7727')[0].coordinaten).toEqual({
      lat: 34.9671,
      lon: 135.7727,
    });
  });

  it('pakt een link op de regel op', () => {
    const [punt] = leesPlakLijst(
      'Todai-ji https://www.google.com/maps/search/?api=1&query=34.6890,135.8398',
    );
    expect(punt.naam).toBe('Todai-ji');
    expect(punt.coordinaten).toEqual({ lat: 34.689, lon: 135.8398 });
  });
});

describe('herkenSoort en leesBestand', () => {
  it('herkent de drie vormen aan de inhoud en niet aan de bestandsnaam', () => {
    expect(herkenSoort('{"type":"FeatureCollection"}')).toBe('geojson');
    expect(herkenSoort('Title,Note,URL\nX,,')).toBe('csv');
    expect(herkenSoort('Fushimi Inari\nGion')).toBe('tekst');
  });

  it('leest het bestand in de vorm die erin zit', () => {
    expect(leesBestand('Fushimi Inari\nGion')).toHaveLength(2);
    expect(leesBestand('Title,URL\nX,')).toHaveLength(1);
  });
});
