import { describe, expect, it } from 'vitest';
import type { Plaats, Stad } from '@/domein/schema';
import { overzicht, type Foto } from '@/domein/fotos/reis';
import { maakReisverslag } from './verslag';

const stad = (
  id: string,
  naam: string,
  lat: number,
  lon: number,
  tijdzone: string,
  volgorde: number,
): Stad => ({
  id,
  naam,
  land: tijdzone === 'Asia/Tokyo' ? 'japan' : 'vietnam',
  tijdzone,
  valuta: tijdzone === 'Asia/Tokyo' ? 'JPY' : 'VND',
  centrum: { lat, lon },
  straalKm: 25,
  kaartgebied: {
    zuidwest: { lat: lat - 0.2, lon: lon - 0.2 },
    noordoost: { lat: lat + 0.2, lon: lon + 0.2 },
  },
  tijdlijn: 'japan',
  tijdvakken: [],
  korteBeschrijving: '',
  volgorde,
});

const STEDEN = [
  stad('hanoi', 'Hanoi', 21.0285, 105.8542, 'Asia/Ho_Chi_Minh', 1),
  stad('tokio', 'Tokio', 35.6812, 139.7671, 'Asia/Tokyo', 2),
];

const PLAATSEN: Plaats[] = [
  {
    id: 'senso-ji',
    naam: 'Sensō-ji',
    stad: 'tokio',
    categorie: 'attractie',
    coordinaten: { lat: 35.7148, lon: 139.7967 },
    attractie: { type: 'tempel' },
  },
];

const FOTOS: Foto[] = [
  {
    id: 'a',
    naam: 'a.jpg',
    genomenOp: '2026-04-01T03:00:00Z',
    coordinaten: { lat: 21.0287, lon: 105.8524 },
  },
  {
    id: 'b',
    naam: 'b.jpg',
    genomenOp: '2026-04-02T02:00:00Z',
    coordinaten: { lat: 35.7148, lon: 139.7967 },
  },
  {
    id: 'c',
    naam: 'c.jpg',
    genomenOp: '2026-04-02T02:05:00Z',
    coordinaten: { lat: 35.7149, lon: 139.7968 },
  },
];

describe('maakReisverslag', () => {
  const html = maakReisverslag(FOTOS, STEDEN, PLAATSEN, overzicht(FOTOS, STEDEN));

  it('levert een op zichzelf staand HTML-bestand', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('</html>');
  });

  it('noemt de dagen en de steden van de reis', () => {
    expect(html).toContain('2026-04-01');
    expect(html).toContain('2026-04-02');
    expect(html).toContain('Hanoi');
    expect(html).toContain('Tokio');
  });

  it('noemt de plek waar gefotografeerd is, en maar één keer per dag', () => {
    const treffers = html.split('Sensō-ji').length - 1;
    expect(treffers).toBe(1);
  });

  it("bevat geen foto's, zodat je het kunt delen zonder je fotorol", () => {
    expect(html).not.toContain('data:image');
    expect(html).not.toContain('<img');
  });

  it('verwijst nergens naar buiten, zodat het over tien jaar nog opent', () => {
    expect(html).not.toMatch(/src="https?:/);
    expect(html).not.toMatch(/<link[^>]+href="https?:/);
  });

  it('ontsnapt tekens die anders de opmaak zouden breken', () => {
    const stout: Plaats[] = [{ ...PLAATSEN[0], naam: 'Zaak <script>alert("x")</script>' }];
    const uitkomst = maakReisverslag(FOTOS, STEDEN, stout, overzicht(FOTOS, STEDEN));
    expect(uitkomst).not.toContain('<script>alert');
    expect(uitkomst).toContain('&lt;script&gt;');
  });

  it("valt niet om op een reis zonder foto's", () => {
    const leeg = maakReisverslag([], STEDEN, PLAATSEN, overzicht([], STEDEN));
    expect(leeg).toContain('Japan en Hanoi');
    expect(leeg).toContain('onbekend');
  });
});
