import { describe, expect, it } from 'vitest';
import {
  herkenInstagramSoort,
  leesInstagram,
  leesInstagramCsv,
  leesInstagramExport,
  leesInstagramPlak,
} from './instagram';

describe('leesInstagramExport', () => {
  const bestand = JSON.stringify({
    saved_saved_media: [
      {
        title: 'japanfoodie',
        string_map_data: {
          'Saved on': { href: 'https://www.instagram.com/p/ABC123/', timestamp: 1774000000 },
        },
      },
      {
        title: 'hanoistreets',
        string_map_data: {
          Opgeslagen: { href: 'https://www.instagram.com/reel/XYZ789/', timestamp: 1774100000 },
        },
      },
    ],
  });

  it('leest de posts met hun bron en link', () => {
    const tips = leesInstagramExport(bestand);
    expect(tips).toHaveLength(2);
    expect(tips[0].bron).toBe('japanfoodie');
    expect(tips[0].url).toBe('https://www.instagram.com/p/ABC123/');
  });

  it('vindt het veld ook als Instagram de sleutel vertaald heeft', () => {
    // De sleutel heet niet overal "Saved on"; het veld met een href is leidend.
    expect(leesInstagramExport(bestand)[1].bron).toBe('hanoistreets');
  });

  it('verzint geen tip die niet in het bestand staat', () => {
    // De officiële export bevat geen bijschrift en geen locatie. Dat hoort leeg
    // te blijven in plaats van ingevuld te worden met een gok.
    const [eerste] = leesInstagramExport(bestand);
    expect(eerste.tip).toBeUndefined();
    expect(eerste.coordinaten).toBeUndefined();
    expect(eerste.locatie).toContain('japanfoodie');
  });

  it('zet het tijdstip om naar een datum', () => {
    expect(leesInstagramExport(bestand)[0].opgeslagenOp).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('klaagt over een bestand dat de lijst niet heeft', () => {
    expect(() => leesInstagramExport('{"iets":1}')).toThrow(/saved_saved_media/);
  });

  it('slaat een post over waar niets bruikbaars in staat', () => {
    const leeg = JSON.stringify({ saved_saved_media: [{ string_map_data: {} }] });
    expect(leesInstagramExport(leeg)).toEqual([]);
  });
});

describe('leesInstagramCsv', () => {
  it('leest een eigen collectie met locatie, tip, bron en link', () => {
    const csv =
      'Locatie,Tip,Bron,URL\n' +
      '"Bun cha Huong Lien","Ga voor 11 uur, daarna is het vol",hanoistreets,https://www.instagram.com/p/ABC/\n';
    const [tip] = leesInstagramCsv(csv);
    expect(tip.locatie).toBe('Bun cha Huong Lien');
    expect(tip.tip).toBe('Ga voor 11 uur, daarna is het vol');
    expect(tip.bron).toBe('hanoistreets');
    expect(tip.url).toBe('https://www.instagram.com/p/ABC/');
  });

  it('pakt losse kolommen met coördinaten mee', () => {
    const csv = 'Plek,Latitude,Longitude\nHoan Kiem,21.0287,105.8524\n';
    expect(leesInstagramCsv(csv)[0].coordinaten).toEqual({ lat: 21.0287, lon: 105.8524 });
  });

  it('weigert een bestand zonder locatiekolom in plaats van er onzin van te maken', () => {
    expect(() => leesInstagramCsv('een,twee\n1,2')).toThrow(/locatie/);
  });
});

describe('leesInstagramPlak', () => {
  it('scheidt op de verticale streep, want in een tip staat bijna altijd een komma', () => {
    const [tip] = leesInstagramPlak(
      'Fushimi Inari | Ga bij zonsopgang, dan is de berg leeg | kyotowalks',
    );
    expect(tip.locatie).toBe('Fushimi Inari');
    expect(tip.tip).toBe('Ga bij zonsopgang, dan is de berg leeg');
    expect(tip.bron).toBe('kyotowalks');
  });

  it('herkent een link waar hij ook staat op de regel', () => {
    const [tip] = leesInstagramPlak('Gion | mooi bij schemer | https://www.instagram.com/p/A/');
    expect(tip.url).toBe('https://www.instagram.com/p/A/');
    expect(tip.tip).toBe('mooi bij schemer');
  });

  it('neemt genoegen met alleen een plek', () => {
    expect(leesInstagramPlak('- Nishiki markt\n• Gion').map((t) => t.locatie)).toEqual([
      'Nishiki markt',
      'Gion',
    ]);
  });
});

describe('herkennen', () => {
  it('kiest de vorm op de inhoud en niet op de bestandsnaam', () => {
    expect(herkenInstagramSoort('{"saved_saved_media":[]}')).toBe('export');
    expect(herkenInstagramSoort('Locatie,Tip,Bron\nx,,')).toBe('csv');
    expect(herkenInstagramSoort('Gion | mooi')).toBe('tekst');
  });

  it('leest het bestand in de vorm die erin zit', () => {
    expect(leesInstagram('Gion | mooi bij schemer')).toHaveLength(1);
    expect(leesInstagram('{"saved_saved_media":[]}')).toEqual([]);
  });
});
