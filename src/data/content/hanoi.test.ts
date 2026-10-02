import { describe, expect, it } from 'vitest';
import { STEDEN, laadAllePlaatsen, laadPlaatsen } from '@/data/content';
import { leesOsm, osmOp } from '@/domein/openingstijden/osm';
import { nuOpen, openOp, tijdenOp } from '@/domein/openingstijden/status';
import { datumsVanTot } from '@/domein/tijd/datums';

/**
 * De uitgezochte plekken in Hanoi, getoetst op de data zelf en niet op een
 * nagemaakt voorbeeld. Gaat hier iets mis, dan klopt er iets niet in
 * data/plaatsen/hanoi.yaml of in hoe de app het leest.
 */

const HANOI = STEDEN.find((s) => s.id === 'hanoi')!;

const plek = async (id: string) => {
  const gevonden = (await laadPlaatsen('hanoi')).find((p) => p.id === id);
  if (!gevonden) throw new Error(`${id} staat niet in hanoi.yaml`);
  return gevonden;
};

/** Een klokmoment in Hanoi (UTC+7, zonder zomertijd) als moment in UTC. */
const inHanoi = (datum: string, klok: string) => new Date(`${datum}T${klok}:00+07:00`);

describe('openingstijden van de plekken in Hanoi, op de datum', () => {
  it('het mausoleum is op donderdag 15 oktober 2026 om 08:00 dicht voor onderhoud', async () => {
    const mausoleum = await plek('ho-chi-minh-mausoleum');
    expect(openOp(mausoleum, '2026-10-15', 8 * 60)).toBe(false);
    expect(nuOpen(mausoleum, HANOI, inHanoi('2026-10-15', '08:00'))).toBe(false);
    const dag = tijdenOp(mausoleum, '2026-10-15');
    expect(dag.soort === 'gesloten' && dag.sluiting?.reden).toContain('onderhoud');
  });

  it('het mausoleum is op dinsdag 3 november 2026 om 08:30 weer open', async () => {
    const mausoleum = await plek('ho-chi-minh-mausoleum');
    expect(openOp(mausoleum, '2026-11-03', 8 * 60 + 30)).toBe(true);
    expect(nuOpen(mausoleum, HANOI, inHanoi('2026-11-03', '08:30'))).toBe(true);
  });

  it('het Nationaal Museum is op maandag 5 oktober 2026 om 10:00 dicht: de eerste maandag', async () => {
    const museum = await plek('nationaal-museum-geschiedenis');
    expect(openOp(museum, '2026-10-05', 10 * 60)).toBe(false);
    expect(nuOpen(museum, HANOI, inHanoi('2026-10-05', '10:00'))).toBe(false);
  });

  it('het Nationaal Museum is op maandag 12 oktober 2026 om 10:00 open', async () => {
    const museum = await plek('nationaal-museum-geschiedenis');
    expect(openOp(museum, '2026-10-12', 10 * 60)).toBe(true);
    expect(nuOpen(museum, HANOI, inHanoi('2026-10-12', '10:00'))).toBe(true);
  });

  it('het Presidentieel paleis is op vrijdag om 14:00 dicht en op zaterdag om 14:00 open', async () => {
    const paleis = await plek('presidentieel-paleis');
    // Vrijdag 23 oktober 2026 is de Hanoi dag op de terugreis.
    expect(openOp(paleis, '2026-10-23', 14 * 60)).toBe(false);
    expect(nuOpen(paleis, HANOI, inHanoi('2026-10-23', '14:00'))).toBe(false);
    expect(openOp(paleis, '2026-10-24', 14 * 60)).toBe(true);
    expect(nuOpen(paleis, HANOI, inHanoi('2026-10-24', '14:00'))).toBe(true);
  });
});

describe('alle openingstijden in de data', () => {
  /** Een week in elke maand van 2026: genoeg om seizoenen en weekdagen te raken. */
  const DATUMS = Array.from({ length: 12 }, (_, i) => {
    const maand = String(i + 1).padStart(2, '0');
    return datumsVanTot(`2026-${maand}-08`, `2026-${maand}-14`);
  }).flat();

  it('worden allemaal gelezen, en geen enkele wordt stilletjes dag en nacht open', async () => {
    const alle = await laadAllePlaatsen();
    const metOsm = alle.filter((p) => p.openingstijden?.osm);
    expect(metOsm.length).toBeGreaterThan(20);

    for (const plaats of metOsm) {
      const osm = plaats.openingstijden!.osm!;
      const regels = leesOsm(osm);
      expect(regels.length, `${plaats.id}: ${osm}`).toBeGreaterThan(0);
      // Gelezen en niet als onbekend afgedaan.
      expect(tijdenOp(plaats, '2026-10-04').soort, plaats.id).not.toBe('onbekend');

      if (osm.trim() === '24/7') continue;
      const ergensDicht = DATUMS.some((datum) => {
        const dag = osmOp(regels, datum);
        return dag.soort === 'gesloten' || !dag.blokken.some((b) => b.van === 0 && b.tot === 1440);
      });
      expect(ergensDicht, `${plaats.id} leest "${osm}" als dag en nacht open`).toBe(true);
    }
  });
});

describe('koppelingen tussen plekken', () => {
  it('elke id in onderdeelVan en inDeBuurtVan bestaat in dezelfde stad', async () => {
    for (const stad of STEDEN) {
      const plaatsen = await laadPlaatsen(stad.id);
      const ids = new Set(plaatsen.map((p) => p.id));
      for (const plaats of plaatsen) {
        if (plaats.onderdeelVan) {
          expect(ids.has(plaats.onderdeelVan), `${plaats.id} → ${plaats.onderdeelVan}`).toBe(true);
        }
        for (const id of plaats.inDeBuurtVan ?? []) {
          expect(ids.has(id), `${plaats.id} → ${id}`).toBe(true);
        }
      }
    }
  });

  it('Hanoi heeft een volledige Top 20 met elk rangnummer één keer', async () => {
    const rangen = (await laadPlaatsen('hanoi'))
      .map((p) => p.rang)
      .filter((r): r is number => r !== undefined)
      .sort((a, b) => a - b);
    expect(rangen).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('alle uitgezochte plekken staan op controleren, met een datum', async () => {
    const uitgezocht = (await laadPlaatsen('hanoi')).filter((p) => p.gecheckt);
    expect(uitgezocht.length).toBeGreaterThanOrEqual(38);
    for (const plaats of uitgezocht) {
      expect(plaats.gecontroleerd, plaats.id).toBe(false);
    }
  });
});
