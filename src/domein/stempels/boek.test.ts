import { describe, expect, it } from 'vitest';
import type { Plaats, Stad } from '@/domein/schema';
import { stempelId, teHalenUit, tellers, toonGoshuinTip } from './boek';

const stad = (id: string, volgorde: number): Stad => ({
  id,
  naam: id,
  land: 'japan',
  tijdzone: 'Asia/Tokyo',
  valuta: 'JPY',
  centrum: { lat: 35, lon: 135 },
  straalKm: 20,
  kaartgebied: { zuidwest: { lat: 34.8, lon: 134.8 }, noordoost: { lat: 35.2, lon: 135.2 } },
  tijdlijn: 'japan',
  tijdvakken: [],
  korteBeschrijving: '',
  volgorde,
});

const STEDEN = [stad('kyoto', 1), stad('nara', 2)];

const basis = (id: string, stadId: string): Plaats => ({
  id,
  naam: id,
  stad: stadId,
  categorie: 'attractie',
  coordinaten: { lat: 35, lon: 135 },
  attractie: { type: 'tempel' },
});

const PLAATSEN: Plaats[] = [
  // Een tempel met allebei: dat zijn twee aparte regels, want twee boekjes.
  {
    ...basis('fushimi', 'kyoto'),
    goshuin: { waar: 'Bij de hoofdhal', openingstijden: { standaard: '08:30-16:30' } },
    ekiStempel: { waar: 'Bij het station ernaast' },
  },
  { ...basis('kiyomizu', 'kyoto'), goshuin: { waar: 'Bij de uitgang' } },
  { ...basis('station-kyoto', 'kyoto'), ekiStempel: { waar: 'Bij de centrale poortjes' } },
  { ...basis('todai-ji', 'nara'), goshuin: { waar: 'In de Grote Boeddhahal' } },
  // Een plaats zonder stempels hoort nergens in het boek te staan.
  basis('bamboe', 'kyoto'),
];

describe('teHalenUit', () => {
  it('vindt beide soorten en houdt ze uit elkaar', () => {
    const teHalen = teHalenUit(PLAATSEN);
    expect(teHalen).toHaveLength(5);
    expect(teHalen.filter((s) => s.type === 'goshuin')).toHaveLength(3);
    expect(teHalen.filter((s) => s.type === 'eki')).toHaveLength(2);
  });

  it('geeft een tempel met allebei twee aparte regels', () => {
    const vanFushimi = teHalenUit(PLAATSEN).filter((s) => s.plaatsId === 'fushimi');
    expect(vanFushimi.map((s) => s.type).sort()).toEqual(['eki', 'goshuin']);
    expect(new Set(vanFushimi.map((s) => s.id)).size).toBe(2);
  });

  it('neemt mee waar de stempel precies staat, want dat is het hele punt', () => {
    const eki = teHalenUit(PLAATSEN).find((s) => s.id === stempelId('station-kyoto', 'eki'))!;
    expect(eki.waar).toBe('Bij de centrale poortjes');
  });

  it('neemt de openingstijden van het stempelkantoor apart mee', () => {
    const goshuin = teHalenUit(PLAATSEN).find((s) => s.id === stempelId('fushimi', 'goshuin'))!;
    expect(goshuin.openingstijden).toBe('08:30-16:30');
  });

  it('laat een plaats zonder stempels buiten het boek', () => {
    expect(teHalenUit(PLAATSEN).some((s) => s.plaatsId === 'bamboe')).toBe(false);
  });
});

describe('tellers', () => {
  const teHalen = teHalenUit(PLAATSEN);

  it('telt niets als je nog niets hebt', () => {
    const { totaal } = tellers(teHalen, new Set(), STEDEN);
    expect(totaal).toEqual({
      eki: { gehaald: 0, totaal: 2 },
      goshuin: { gehaald: 0, totaal: 3 },
      gehaald: 0,
      totaal: 5,
    });
  });

  it('telt per type apart', () => {
    const gehaald = new Set([stempelId('fushimi', 'goshuin'), stempelId('station-kyoto', 'eki')]);
    const { totaal } = tellers(teHalen, gehaald, STEDEN);
    expect(totaal.goshuin.gehaald).toBe(1);
    expect(totaal.eki.gehaald).toBe(1);
    expect(totaal.gehaald).toBe(2);
  });

  it('telt per stad apart', () => {
    const gehaald = new Set([stempelId('todai-ji', 'goshuin')]);
    const { perStad } = tellers(teHalen, gehaald, STEDEN);
    expect(perStad.get('nara')).toEqual({
      eki: { gehaald: 0, totaal: 0 },
      goshuin: { gehaald: 1, totaal: 1 },
      gehaald: 1,
      totaal: 1,
    });
    expect(perStad.get('kyoto')!.gehaald).toBe(0);
    expect(perStad.get('kyoto')!.totaal).toBe(4);
  });

  it('geeft elke stad een teller, ook een zonder stempels', () => {
    const leeg = [...STEDEN, stad('hakone', 3)];
    const { perStad } = tellers(teHalen, new Set(), leeg);
    expect(perStad.get('hakone')).toEqual({
      eki: { gehaald: 0, totaal: 0 },
      goshuin: { gehaald: 0, totaal: 0 },
      gehaald: 0,
      totaal: 0,
    });
  });

  it('negeert een gehaalde stempel die niet in de content staat', () => {
    // Onderweg kom je stempels tegen die er niet in staan. De teller telt de
    // totalen uit de content en gaat daar niet van in de war.
    const { totaal } = tellers(teHalen, new Set(['onbekend:eki']), STEDEN);
    expect(totaal.gehaald).toBe(0);
    expect(totaal.totaal).toBe(5);
  });
});

describe('toonGoshuinTip', () => {
  it('toont de tip zolang je nog geen goshuin hebt', () => {
    expect(toonGoshuinTip(new Set(), false)).toBe(true);
    expect(toonGoshuinTip(new Set(['station-kyoto:eki']), false)).toBe(true);
  });

  it('zwijgt zodra je er een hebt, want dan heb je het boekje al', () => {
    expect(toonGoshuinTip(new Set(['fushimi:goshuin']), false)).toBe(false);
  });

  it('zwijgt als je hem hebt weggeklikt', () => {
    expect(toonGoshuinTip(new Set(), true)).toBe(false);
  });
});
