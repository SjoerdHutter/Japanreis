import { describe, expect, it } from 'vitest';
import type { OpgeslagenSpoor, Plaats, Stad } from '@/domein/schema';
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
  const html = maakReisverslag({
    fotos: FOTOS,
    steden: STEDEN,
    plaatsen: PLAATSEN,
    cijfers: overzicht(FOTOS, STEDEN),
  });

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
    const uitkomst = maakReisverslag({
      fotos: FOTOS,
      steden: STEDEN,
      plaatsen: stout,
      cijfers: overzicht(FOTOS, STEDEN),
    });
    expect(uitkomst).not.toContain('<script>alert');
    expect(uitkomst).toContain('&lt;script&gt;');
  });

  it("valt niet om op een reis zonder foto's", () => {
    const leeg = maakReisverslag({
      fotos: [],
      steden: STEDEN,
      plaatsen: PLAATSEN,
      cijfers: overzicht([], STEDEN),
    });
    expect(leeg).toContain('Japan en Hanoi');
    expect(leeg).toContain('onbekend');
  });

  it('zet een gelopen route bij zijn dag, als svg met de cijfers', () => {
    const route: OpgeslagenSpoor = {
      id: 'r',
      naam: 'Langs de <rivier>',
      kleur: '#2563eb',
      datum: '2026-04-02',
      lijnen: [
        [
          [35.71, 139.79],
          [35.72, 139.8],
          [35.715, 139.81],
        ],
      ],
      statistiek: { afstandM: 4200, stijgingM: 35, bewegingS: 3900, punten: 3 },
      toegevoegdOp: '2026-04-02T10:00:00Z',
      gewijzigdOp: '2026-04-02T10:00:00Z',
    };
    const metRoute = maakReisverslag({
      fotos: FOTOS,
      steden: STEDEN,
      plaatsen: PLAATSEN,
      cijfers: overzicht(FOTOS, STEDEN),
      sporen: [route, { ...route, id: 's', naam: 'Zonder dag', datum: undefined }],
    });
    const dag = metRoute.slice(
      metRoute.indexOf('2026-04-02'),
      metRoute.indexOf('</li>', metRoute.indexOf('<svg')),
    );
    expect(dag).toContain('<svg');
    expect(dag).toContain('stroke="#2563eb"');
    expect(dag).toContain('Langs de &lt;rivier&gt;: 4,2 km, 35 m klimmen, 1 u 5 min in beweging');
    expect(metRoute).toContain('Routes zonder dag');
    expect(metRoute).toContain('2 gelopen routes, samen 8,4 km');
    expect(metRoute).not.toMatch(/<svg[^>]+href="https?:/);
  });

  it('heeft een dag met alleen een route', () => {
    const route: OpgeslagenSpoor = {
      id: 'r',
      naam: 'Ochtendloop',
      kleur: '#dc2626',
      datum: '2026-04-05',
      lijnen: [
        [
          [35.71, 139.79],
          [35.72, 139.8],
        ],
      ],
      statistiek: { afstandM: 1500, punten: 2 },
      toegevoegdOp: '2026-04-05T10:00:00Z',
      gewijzigdOp: '2026-04-05T10:00:00Z',
    };
    const html = maakReisverslag({
      fotos: [],
      steden: STEDEN,
      plaatsen: PLAATSEN,
      cijfers: overzicht([], STEDEN),
      sporen: [route],
    });
    expect(html).toContain('Zondag 5 april</time> <span>Tokio</span>');
    expect(html).not.toContain('0 foto');
  });

  describe('rond de reisdagen', () => {
    const REISDAGEN = [
      { datum: '2026-04-01', steden: ['hanoi'] },
      { datum: '2026-04-02', steden: ['hanoi', 'tokio'] },
      { datum: '2026-04-03', steden: ['tokio'] },
    ];
    const NOTITIES = [
      {
        datum: '2026-04-02',
        notitie: 'Vroeg op.\nPho bij de <markt>.\n\nNachtvlucht naar Tokio.',
        hoogtepunt: 'De eerste tempel',
        gewijzigdOp: '2026-04-02T20:00:00Z',
      },
    ];
    const invoer = {
      fotos: FOTOS,
      steden: STEDEN,
      plaatsen: PLAATSEN,
      cijfers: overzicht(FOTOS, STEDEN),
      notities: NOTITIES,
      reisdagen: REISDAGEN,
    };

    it('heeft elke reisdag, genummerd, ook zonder foto of notitie', () => {
      const html = maakReisverslag(invoer);
      expect(html).toContain('Dag 1');
      expect(html).toContain('Dag 3');
      expect(html).toContain('Vrijdag 3 april</time> <span>Tokio</span>');
      expect(html).toContain('Donderdag 2 april</time> <span>Hanoi en Tokio</span>');
      expect(html).toContain('1 april 2026 tot 3 april 2026');
    });

    it('zet de notitie en het hoogtepunt bij hun dag, veilig en in alinea’s', () => {
      const html = maakReisverslag(invoer);
      const dag = html.slice(
        html.indexOf('datetime="2026-04-02"'),
        html.indexOf('datetime="2026-04-03"'),
      );
      expect(dag).toContain('<p class="hoogtepunt">De eerste tempel</p>');
      expect(dag).toContain('<p class="notitie">Vroeg op.<br>Pho bij de &lt;markt&gt;.</p>');
      expect(dag).toContain('<p class="notitie">Nachtvlucht naar Tokio.</p>');
      expect(dag).toContain("2 foto's: Sensō-ji");
      expect(html).toContain('1 dag met een notitie');
    });

    it('noemt je verblijven alleen als je daarvoor kiest', () => {
      const zonder = maakReisverslag(invoer);
      expect(zonder).not.toContain('Geslapen in');
      const met = maakReisverslag({
        ...invoer,
        verblijven: new Map([['2026-04-01', 'Hotel <Oude Wijk>']]),
      });
      expect(met).toContain('Geslapen in Hotel &lt;Oude Wijk&gt;');
      expect(met).toContain('Met de namen van de verblijven.');
    });

    it('neemt een notitie buiten de reis ook mee', () => {
      const html = maakReisverslag({
        ...invoer,
        notities: [{ datum: '2026-03-30', notitie: 'Koffers gepakt.', gewijzigdOp: 'x' }],
      });
      expect(html).toContain('Koffers gepakt.');
      expect(html.indexOf('2026-03-30')).toBeLessThan(html.indexOf('2026-04-01'));
    });
  });
});
