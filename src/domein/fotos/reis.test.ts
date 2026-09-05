import { describe, expect, it } from 'vitest';
import type { Plaats, Stad } from '@/domein/schema';
import {
  groepeerPerDag,
  opTijd,
  overzicht,
  plaatsVoorFoto,
  reislijn,
  stadVoorPunt,
  steldPlekVoor,
  type Foto,
} from './reis';

const stad = (id: string, lat: number, lon: number, tijdzone: string, volgorde: number): Stad => ({
  id,
  naam: id,
  land: tijdzone === 'Asia/Tokyo' ? 'japan' : 'vietnam',
  tijdzone,
  valuta: tijdzone === 'Asia/Tokyo' ? 'JPY' : 'VND',
  centrum: { lat, lon },
  straalKm: 25,
  kaartgebied: {
    zuidwest: { lat: lat - 0.2, lon: lon - 0.2 },
    noordoost: { lat: lat + 0.2, lon: lon + 0.2 },
  },
  tijdlijn: tijdzone === 'Asia/Tokyo' ? 'japan' : 'hanoi',
  tijdvakken: [],
  korteBeschrijving: '',
  volgorde,
});

const HANOI = stad('hanoi', 21.0285, 105.8542, 'Asia/Ho_Chi_Minh', 1);
const TOKIO = stad('tokio', 35.6812, 139.7671, 'Asia/Tokyo', 2);
const KYOTO = stad('kyoto', 35.0116, 135.7681, 'Asia/Tokyo', 3);
const STEDEN = [HANOI, TOKIO, KYOTO];

const foto = (
  id: string,
  genomenOp?: string,
  coordinaten?: { lat: number; lon: number },
): Foto => ({
  id,
  naam: `${id}.jpg`,
  genomenOp,
  coordinaten,
});

/** Een foto zoals hij uit een camera komt: een wandklok en een echt moment. */
const cameraFoto = (
  id: string,
  wandklok: string,
  moment: string,
  coordinaten?: { lat: number; lon: number },
): Foto => ({ id, naam: `${id}.jpg`, wandklok, genomenOp: moment, coordinaten });

describe('opTijd', () => {
  it('ordent oudste eerst', () => {
    const fotos = [
      foto('b', '2026-04-11T09:00:00Z'),
      foto('a', '2026-04-10T09:00:00Z'),
      foto('c', '2026-04-12T09:00:00Z'),
    ];
    expect(opTijd(fotos).map((f) => f.id)).toEqual(['a', 'b', 'c']);
  });

  it("laat foto's zonder tijdstip buiten de lijn", () => {
    expect(opTijd([foto('geen'), foto('wel', '2026-04-10T09:00:00Z')]).map((f) => f.id)).toEqual([
      'wel',
    ]);
  });
});

describe('stadVoorPunt', () => {
  it('vindt de stad waar een foto genomen is', () => {
    expect(stadVoorPunt({ lat: 35.0116, lon: 135.7681 }, STEDEN)?.id).toBe('kyoto');
    expect(stadVoorPunt({ lat: 21.03, lon: 105.85 }, STEDEN)?.id).toBe('hanoi');
  });

  it('geeft niets terug midden op de oceaan', () => {
    expect(stadVoorPunt({ lat: 30, lon: 125 }, STEDEN)).toBeUndefined();
  });
});

describe('de doorlopende lijn over Hanoi heen, Japan en Hanoi terug', () => {
  // De reis uit de specificatie: overstap in Hanoi, dan Japan, dan terug via
  // Hanoi. Dit is de definitie van klaar voor de fotokaart.
  const reis = [
    foto('heen-hanoi', '2026-04-01T03:00:00Z', { lat: 21.0287, lon: 105.8524 }),
    foto('tokio-1', '2026-04-02T02:00:00Z', { lat: 35.7148, lon: 139.7967 }),
    foto('kyoto-1', '2026-04-05T02:00:00Z', { lat: 34.9671, lon: 135.7727 }),
    foto('terug-hanoi', '2026-04-10T03:00:00Z', { lat: 21.0338, lon: 105.8475 }),
  ];

  it('maakt er één lijn van en geen losse eilanden', () => {
    const lijn = reislijn(reis);
    expect(lijn).toHaveLength(4);
    // De lijn begint en eindigt in Hanoi, met Japan ertussen.
    expect(lijn[0].lat).toBeCloseTo(21.0287, 3);
    expect(lijn[3].lat).toBeCloseTo(21.0338, 3);
    expect(lijn[1].lat).toBeCloseTo(35.7148, 3);
  });

  it('houdt de lijn in de volgorde van de tijd, niet van het bestand', () => {
    const doorElkaar = [reis[2], reis[0], reis[3], reis[1]];
    expect(reislijn(doorElkaar).map((p) => Math.round(p.lat))).toEqual([21, 36, 35, 21]);
  });

  it("slaat foto's zonder plek over zonder de lijn te breken", () => {
    const metGat = [
      ...reis.slice(0, 2),
      foto('geen-gps', '2026-04-03T02:00:00Z'),
      ...reis.slice(2),
    ];
    expect(reislijn(metGat)).toHaveLength(4);
  });

  it("trekt opeenvolgende foto's van precies dezelfde plek samen", () => {
    const zelfdePlek = [
      foto('a', '2026-04-02T02:00:00Z', { lat: 35.7148, lon: 139.7967 }),
      foto('b', '2026-04-02T02:01:00Z', { lat: 35.7148, lon: 139.7967 }),
      foto('c', '2026-04-02T02:02:00Z', { lat: 35.7148, lon: 139.7967 }),
    ];
    expect(reislijn(zelfdePlek)).toHaveLength(1);
  });
});

describe('de dag van een foto komt uit de wandklok van de camera', () => {
  // Dit is de bug die het draaien van de app aan het licht bracht. EXIF legt de
  // tijd vast zonder zone: een avondfoto in Tokio staat als 18:30. Die als UTC
  // lezen maakt er 03:30 de volgende ochtend van, en dan verschijnt er een dag
  // in de tijdbalk waarop je geen enkele foto hebt gemaakt.
  const avondInTokio = cameraFoto('shibuya', '2026-04-02T18:30:00', '2026-04-02T09:30:00Z', {
    lat: 35.6595,
    lon: 139.7005,
  });

  it('houdt een avondfoto op de dag waarop je hem maakte', () => {
    expect(groepeerPerDag([avondInTokio], STEDEN)[0].datum).toBe('2026-04-02');
  });

  it('maakt geen dag aan waarop niets gefotografeerd is', () => {
    const ochtend = cameraFoto('senso', '2026-04-02T11:00:00', '2026-04-02T02:00:00Z', {
      lat: 35.7148,
      lon: 139.7967,
    });
    const dagen = groepeerPerDag([ochtend, avondInTokio], STEDEN);
    expect(dagen.map((d) => d.datum)).toEqual(['2026-04-02']);
  });

  it('doet hetzelfde voor Hanoi, dat een andere zone heeft dan Japan', () => {
    const avondInHanoi = cameraFoto('hanoi', '2026-04-01T22:00:00', '2026-04-01T15:00:00Z', {
      lat: 21.0287,
      lon: 105.8524,
    });
    expect(groepeerPerDag([avondInHanoi], STEDEN)[0].datum).toBe('2026-04-01');
  });

  it('ordent nog steeds op het echte moment, ook over een zonegrens heen', () => {
    // Vertrek uit Hanoi om 23:00 lokaal, aankomst in Tokio om 06:00 lokaal de
    // volgende ochtend. Op de wandklok lijkt de tweede eerder op de dag, maar
    // in werkelijkheid ligt hij later.
    const vertrek = cameraFoto('vertrek', '2026-04-01T23:00:00', '2026-04-01T16:00:00Z', {
      lat: 21.0287,
      lon: 105.8524,
    });
    const aankomst = cameraFoto('aankomst', '2026-04-02T06:00:00', '2026-04-01T21:00:00Z', {
      lat: 35.7148,
      lon: 139.7967,
    });
    expect(opTijd([aankomst, vertrek]).map((f) => f.id)).toEqual(['vertrek', 'aankomst']);
    expect(groepeerPerDag([aankomst, vertrek], STEDEN).map((d) => d.datum)).toEqual([
      '2026-04-01',
      '2026-04-02',
    ]);
  });
});

describe('groepeerPerDag', () => {
  it('groepeert op de dag in de tijdzone waar je toen was', () => {
    // 15:30 UTC is in Japan al 00:30 de volgende dag; deze foto hoort dus bij
    // de elfde en niet bij de tiende.
    const fotos = [
      foto('avond', '2026-04-10T14:30:00Z', { lat: 35.0116, lon: 135.7681 }),
      foto('nacht', '2026-04-10T15:30:00Z', { lat: 35.0116, lon: 135.7681 }),
    ];
    const dagen = groepeerPerDag(fotos, STEDEN);
    expect(dagen.map((d) => d.datum)).toEqual(['2026-04-10', '2026-04-11']);
  });

  it('rekent in Hanoi met de Vietnamese zone en niet met de Japanse', () => {
    // 17:30 UTC is in Vietnam 00:30 de volgende dag, in Japan al 02:30.
    const fotos = [foto('hanoi', '2026-04-10T16:30:00Z', { lat: 21.0287, lon: 105.8524 })];
    expect(groepeerPerDag(fotos, STEDEN)[0].datum).toBe('2026-04-10');
  });

  it('houdt een foto zonder plek in de zone van de foto ervoor', () => {
    // Je zit in Kyoto, maakt een foto binnen zonder GPS: die hoort bij de
    // Japanse dag, niet bij de dag van je telefoon thuis.
    const fotos = [
      foto('kyoto', '2026-04-10T14:00:00Z', { lat: 35.0116, lon: 135.7681 }),
      foto('binnen', '2026-04-10T14:30:00Z'),
    ];
    const dagen = groepeerPerDag(fotos, STEDEN);
    expect(dagen).toHaveLength(1);
    expect(dagen[0].fotos.map((f) => f.id)).toEqual(['kyoto', 'binnen']);
  });

  it('noteert per dag in welke stad je zat', () => {
    const fotos = [foto('a', '2026-04-05T02:00:00Z', { lat: 34.9671, lon: 135.7727 })];
    expect(groepeerPerDag(fotos, STEDEN)[0].stadId).toBe('kyoto');
  });

  it('geeft de dagen in volgorde terug', () => {
    const fotos = [
      foto('later', '2026-04-12T02:00:00Z', { lat: 35.0116, lon: 135.7681 }),
      foto('eerder', '2026-04-10T02:00:00Z', { lat: 35.0116, lon: 135.7681 }),
    ];
    expect(groepeerPerDag(fotos, STEDEN).map((d) => d.datum)).toEqual(['2026-04-10', '2026-04-12']);
  });
});

describe('steldPlekVoor', () => {
  it("zet een foto tussen twee foto's van vlak ervoor en vlak erna", () => {
    const fotos = [
      foto('voor', '2026-04-05T02:00:00Z', { lat: 34.967, lon: 135.772 }),
      foto('zonder', '2026-04-05T02:10:00Z'),
      foto('na', '2026-04-05T02:20:00Z', { lat: 34.968, lon: 135.773 }),
    ];
    const voorstel = steldPlekVoor(fotos[1], fotos)!;
    expect(voorstel.coordinaten.lat).toBeCloseTo(34.9675, 4);
    expect(voorstel.reden).toContain('Tussen twee');
  });

  it('pakt de dichtstbijzijnde in de tijd als er maar aan één kant iets is', () => {
    const fotos = [
      foto('voor', '2026-04-05T02:00:00Z', { lat: 34.967, lon: 135.772 }),
      foto('zonder', '2026-04-05T02:20:00Z'),
    ];
    const voorstel = steldPlekVoor(fotos[1], fotos)!;
    expect(voorstel.coordinaten).toEqual({ lat: 34.967, lon: 135.772 });
    expect(voorstel.minutenVerschil).toBe(20);
    expect(voorstel.reden).toContain('20 minuten na');
  });

  it('verzint niets midden in een vlucht van zes uur', () => {
    const fotos = [
      foto('vertrek', '2026-04-01T03:00:00Z', { lat: 21.0287, lon: 105.8524 }),
      foto('in-de-lucht', '2026-04-01T06:00:00Z'),
      foto('aankomst', '2026-04-01T09:00:00Z', { lat: 35.7148, lon: 139.7967 }),
    ];
    expect(steldPlekVoor(fotos[1], fotos)).toBeNull();
  });

  it('trekt geen midden als de twee ankers ver uit elkaar liggen', () => {
    // Binnen het tijdvenster, maar Tokio en Kyoto zijn geen middelpunt waard.
    const fotos = [
      foto('tokio', '2026-04-05T02:00:00Z', { lat: 35.7148, lon: 139.7967 }),
      foto('zonder', '2026-04-05T02:30:00Z'),
      foto('kyoto', '2026-04-05T03:00:00Z', { lat: 34.9671, lon: 135.7727 }),
    ];
    const voorstel = steldPlekVoor(fotos[1], fotos)!;
    // Geen middelpunt in de zee tussen beide, maar gewoon de dichtstbijzijnde.
    expect(voorstel.reden).not.toContain('Tussen twee');
    expect(voorstel.coordinaten.lat).toBeCloseTo(35.7148, 3);
  });

  it('doet niets voor een foto die al een plek heeft', () => {
    const metPlek = foto('a', '2026-04-05T02:00:00Z', { lat: 35, lon: 135 });
    expect(steldPlekVoor(metPlek, [metPlek])).toBeNull();
  });

  it('vergelijkt op de wandklok, want de zone van een foto zonder plek is onbekend', () => {
    // Dit is de fout die het draaien van de app aan het licht bracht. De foto
    // met GPS krijgt zijn moment in de zone van Kyoto, de foto zonder GPS in de
    // zone van het toestel waarop je importeert. Op die twee schalen liggen
    // 08:00 en 08:10 negen uur uit elkaar, en dan kwam er geen voorstel.
    const metPlek = cameraFoto('fushimi', '2026-04-05T08:00:00', '2026-04-04T23:00:00Z', {
      lat: 34.9671,
      lon: 135.7727,
    });
    const zonder = cameraFoto('binnen', '2026-04-05T08:10:00', '2026-04-05T08:10:00Z');
    const voorstel = steldPlekVoor(zonder, [metPlek, zonder])!;
    expect(voorstel).not.toBeNull();
    expect(voorstel.minutenVerschil).toBe(10);
    expect(voorstel.coordinaten).toEqual({ lat: 34.9671, lon: 135.7727 });
  });

  it('valt terug op het moment als er geen wandklok is', () => {
    const fotos = [
      foto('voor', '2026-04-05T02:00:00Z', { lat: 34.967, lon: 135.772 }),
      foto('zonder', '2026-04-05T02:20:00Z'),
    ];
    expect(steldPlekVoor(fotos[1], fotos)?.minutenVerschil).toBe(20);
  });

  it('doet niets zonder enig ankerpunt', () => {
    const fotos = [foto('a', '2026-04-05T02:00:00Z'), foto('b', '2026-04-05T02:10:00Z')];
    expect(steldPlekVoor(fotos[0], fotos)).toBeNull();
  });
});

describe('plaatsVoorFoto', () => {
  const plaats = (id: string, lat: number, lon: number): Plaats => ({
    id,
    naam: id,
    stad: 'kyoto',
    categorie: 'attractie',
    coordinaten: { lat, lon },
    attractie: { type: 'tempel' },
  });
  const PLAATSEN = [plaats('fushimi', 34.9671, 135.7727), plaats('kinkaku', 35.0394, 135.7292)];

  it('koppelt een foto aan de plaats waar hij genomen is', () => {
    const bijFushimi = foto('a', '2026-04-05T02:00:00Z', { lat: 34.9672, lon: 135.7728 });
    expect(plaatsVoorFoto(bijFushimi, PLAATSEN)?.id).toBe('fushimi');
  });

  it('koppelt niet aan iets dat te ver weg staat', () => {
    // Vijfhonderd meter verderop is in een stadscentrum een andere plek.
    const verderop = foto('b', '2026-04-05T02:00:00Z', { lat: 34.9716, lon: 135.7727 });
    expect(plaatsVoorFoto(verderop, PLAATSEN)).toBeUndefined();
  });

  it('doet niets voor een foto zonder plek', () => {
    expect(plaatsVoorFoto(foto('c', '2026-04-05T02:00:00Z'), PLAATSEN)).toBeUndefined();
  });
});

describe('overzicht', () => {
  const reis = [
    foto('heen', '2026-04-01T03:00:00Z', { lat: 21.0287, lon: 105.8524 }),
    foto('tokio', '2026-04-02T02:00:00Z', { lat: 35.7148, lon: 139.7967 }),
    foto('zonder-plek', '2026-04-03T02:00:00Z'),
    foto('terug', '2026-04-10T03:00:00Z', { lat: 21.0338, lon: 105.8475 }),
  ];

  it("telt de foto's en de dagen", () => {
    const uitkomst = overzicht(reis, STEDEN);
    expect(uitkomst.aantalFotos).toBe(4);
    expect(uitkomst.aantalMetPlek).toBe(3);
    expect(uitkomst.eersteFoto).toBe('2026-04-01T03:00:00Z');
    expect(uitkomst.laatsteFoto).toBe('2026-04-10T03:00:00Z');
  });

  it('telt de heenreis en de terugreis allebei mee in de afstand', () => {
    // Hanoi naar Tokio is ruwweg 3700 kilometer, heen en terug dus ruim 7000.
    expect(overzicht(reis, STEDEN).hemelsbredeAfstandKm).toBeGreaterThan(7000);
  });

  it('noemt de steden in de volgorde van de reis en niet op alfabet', () => {
    expect(overzicht(reis, STEDEN).stedenBezocht).toEqual(['hanoi', 'tokio']);
  });

  it('geeft een leeg overzicht zonder om te vallen', () => {
    const leeg = overzicht([], STEDEN);
    expect(leeg.aantalFotos).toBe(0);
    expect(leeg.hemelsbredeAfstandKm).toBe(0);
    expect(leeg.eersteFoto).toBeUndefined();
  });
});
