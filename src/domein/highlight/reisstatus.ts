import type { Reisschema } from '@/domein/schema';

/**
 * Waar sta je ten opzichte van de reis: ervoor, erin, erna, of is er nog niets
 * ingevuld.
 *
 * Dit bestond niet toen het reisschema nog leeg was, en dat was precies het
 * probleem. Het hoofdmenu meldde bij de laatste terugval "nog geen datums in
 * het reisschema", en dat bleef staan toen de datums er wel in stonden maar de
 * reis nog moest beginnen. Een melding die iets beweert wat niet klopt is erger
 * dan geen melding, want je gaat het bestand controleren dat gewoon goed is.
 *
 * Rekent in hele dagen op de kalender en niet in etmalen: vertrek over 1 dag
 * betekent morgen, ongeacht of dat over 3 of over 30 uur is.
 */

export type Reisfase = 'geen-datums' | 'voor-vertrek' | 'onderweg' | 'afgelopen';

export interface Reisstatus {
  fase: Reisfase;
  /** Eerste dag van de reis, als YYYY-MM-DD. Leeg als er geen datums zijn. */
  vertrek?: string;
  /** Laatste dag van de reis, als YYYY-MM-DD. */
  terug?: string;
  /** Hele dagen tot het vertrek. Alleen gevuld bij `voor-vertrek`. */
  dagenTot?: number;
}

const alsDag = (datum: string): number => Date.parse(`${datum}T00:00:00Z`);

const DAG = 24 * 60 * 60 * 1000;

export const bepaalReisstatus = (reisschema: Reisschema, vandaag: string): Reisstatus => {
  const datums = reisschema.segmenten
    .filter((s) => s.van !== undefined && s.tot !== undefined)
    .flatMap((s) => [s.van as string, s.tot as string])
    .sort();

  if (datums.length === 0) return { fase: 'geen-datums' };

  const vertrek = datums[0];
  const terug = datums[datums.length - 1];

  if (vandaag < vertrek) {
    return {
      fase: 'voor-vertrek',
      vertrek,
      terug,
      dagenTot: Math.round((alsDag(vertrek) - alsDag(vandaag)) / DAG),
    };
  }
  if (vandaag > terug) return { fase: 'afgelopen', vertrek, terug };
  return { fase: 'onderweg', vertrek, terug };
};
