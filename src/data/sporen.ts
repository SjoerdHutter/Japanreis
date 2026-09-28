import { STEDEN } from '@/data/content';
import { SPOORKLEUREN, verwerkSpoor } from '@/domein/sporen/spoor';
import { spoorRecordSchema, type OpgeslagenSpoor } from '@/domein/schema';
import { GpxFout, leesGpx } from './gpx';
import { bewaarIn, leesAlles, verwijderUit } from './db/idb';
import { meldWijziging } from './db/wijzigingen';

/**
 * De gelopen routes op dit toestel. Net als de foto's gaan ze nergens heen,
 * behalve in een backup of reisverslag dat je zelf maakt.
 */

/** Boven deze grootte is het waarschijnlijk geen dagwandeling maar een hele reis aan punten. */
const MAX_BYTES = 30 * 1024 * 1024;

const nieuweId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `spoor-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Op dag en daarbinnen op begintijd; routes zonder dag achteraan. */
export const leesSporen = async (): Promise<OpgeslagenSpoor[]> =>
  (await leesAlles('sporen')).sort(
    (a, b) =>
      (a.datum ?? '9999').localeCompare(b.datum ?? '9999') ||
      (a.statistiek.begin ?? '').localeCompare(b.statistiek.begin ?? '') ||
      a.toegevoegdOp.localeCompare(b.toegevoegdOp),
  );

export interface ImportUitkomst {
  toegevoegd: OpgeslagenSpoor[];
  fouten: string[];
}

/** Leest GPX-bestanden in: elk spoor in een bestand wordt een eigen route. */
export const importeerGpx = async (bestanden: File[]): Promise<ImportUitkomst> => {
  const bestaand = await leesAlles('sporen');
  const toegevoegd: OpgeslagenSpoor[] = [];
  const fouten: string[] = [];

  for (const bestand of bestanden) {
    if (bestand.size > MAX_BYTES) {
      fouten.push(`${bestand.name}: groter dan 30 MB, dat leest een telefoon niet in één keer.`);
      continue;
    }
    try {
      const gelezen = leesGpx(await bestand.text());
      const basisnaam = bestand.name.replace(/\.gpx$/i, '');
      for (const [i, spoor] of gelezen.entries()) {
        const { lijnen, statistiek, datum } = verwerkSpoor(spoor.segmenten, STEDEN);
        const nu = new Date().toISOString();
        const naam =
          spoor.naam ?? (gelezen.length > 1 ? `${basisnaam} (${i + 1})` : basisnaam || 'Route');
        toegevoegd.push(
          spoorRecordSchema.parse({
            id: nieuweId(),
            naam: naam.slice(0, 120),
            kleur: SPOORKLEUREN[(bestaand.length + toegevoegd.length) % SPOORKLEUREN.length],
            ...(datum ? { datum } : {}),
            lijnen,
            statistiek,
            bestandsnaam: bestand.name,
            toegevoegdOp: nu,
            gewijzigdOp: nu,
          }),
        );
      }
    } catch (fout) {
      fouten.push(
        `${bestand.name}: ${fout instanceof GpxFout ? fout.message : 'kon dit bestand niet lezen.'}`,
      );
    }
  }

  if (toegevoegd.length > 0) {
    if (!(await bewaarIn('sporen', ...toegevoegd))) {
      return { toegevoegd: [], fouten: [...fouten, 'Opslaan mislukte. Is je toestel vol?'] };
    }
    meldWijziging('sporen');
  }
  return { toegevoegd, fouten };
};

export const werkSpoorBij = async (spoor: OpgeslagenSpoor): Promise<boolean> => {
  const gelukt = await bewaarIn('sporen', { ...spoor, gewijzigdOp: new Date().toISOString() });
  meldWijziging('sporen');
  return gelukt;
};

export const verwijderSpoor = async (id: string): Promise<void> => {
  await verwijderUit('sporen', id);
  meldWijziging('sporen');
};
