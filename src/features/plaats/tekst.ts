import type { Blok, DagTijden } from '@/domein/openingstijden/status';
import { alsKlok } from '@/domein/planning/dagplanner';

/** Blokken als "08:00 tot 12:00 en 13:30 tot 17:00". */
export const blokkenTekst = (blokken: Blok[]): string =>
  blokken
    .map((b) => `${alsKlok(b.van)} tot ${b.tot === 1440 ? '24:00' : alsKlok(b.tot)}`)
    .join(' en ');

/** Een dag uit de openingstijden in één korte zin. */
export const dagTekst = (dag: DagTijden): string => {
  if (dag.soort === 'onbekend') return 'onbekend';
  if (dag.soort === 'gesloten') return dag.sluiting ? `dicht: ${dag.sluiting.reden}` : 'dicht';
  if (dag.blokken.length === 0) return 'open, tijden zonder klok';
  if (dag.blokken.length === 1 && dag.blokken[0].van === 0 && dag.blokken[0].tot === 1440) {
    return 'hele dag open';
  }
  return blokkenTekst(dag.blokken);
};

const WEEKDAG = new Intl.DateTimeFormat('nl-NL', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** 2026-10-06 wordt "di 6 okt". */
export const korteDag = (datum: string): string =>
  WEEKDAG.format(new Date(`${datum}T12:00:00Z`)).replace('.', '');
