import type { Reisdag, Reisschema } from '@/domein/schema';
import { datumsVanTot, plusDagen } from '@/domein/tijd/datums';

/**
 * De reis dag voor dag, van de eerste tot de laatste dag van het reisschema.
 *
 * Het reisschema zegt per stad van wanneer tot wanneer; de reisdagen zeggen hoe
 * je van de ene stad naar de andere komt. Voor het weer, je verblijf en je
 * dagnotitie is er een kaart per kalenderdag nodig, ook voor de dagen dat je
 * gewoon in Kyoto bent.
 */

export interface Nacht {
  datum: string;
  stadId: string;
}

/**
 * De nachten die je volgens het reisschema ergens slaapt. Het aantal nachten
 * komt uit het schema zelf en wordt niet uit van en tot afgeleid; zie de
 * toelichting bij `verblijfSchema`.
 */
export const nachtenVolgensSchema = (reisschema: Reisschema): Nacht[] =>
  reisschema.segmenten.flatMap((segment) => {
    if (!segment.van || !segment.verblijf || segment.verblijf.nachten <= 0) return [];
    return Array.from({ length: segment.verblijf.nachten }, (_, i) => ({
      datum: plusDagen(segment.van!, i),
      stadId: segment.stad,
    }));
  });

/** Eerste en laatste dag van de reis, uit het schema. Null zolang er geen datums zijn. */
export const reisperiode = (reisschema: Reisschema): { van: string; tot: string } | null => {
  const datums = reisschema.segmenten.flatMap((s) => (s.van && s.tot ? [s.van, s.tot] : []));
  if (datums.length === 0) return null;
  datums.sort();
  return { van: datums[0], tot: datums[datums.length - 1] };
};

export interface Reisdagkaart {
  datum: string;
  /** De steden waar je die dag bent, in de volgorde van het schema. */
  steden: string[];
  /** Waar je die nacht slaapt volgens het schema; leeg in het vliegtuig. */
  nachtStadId?: string;
  /** De treinen of bussen van die dag. */
  reisdagen: Reisdag[];
}

export const dagenVanDeReis = (reisschema: Reisschema, reisdagen: Reisdag[]): Reisdagkaart[] => {
  const periode = reisperiode(reisschema);
  if (!periode) return [];
  const nachten = new Map(nachtenVolgensSchema(reisschema).map((n) => [n.datum, n.stadId]));
  return datumsVanTot(periode.van, periode.tot).map((datum) => ({
    datum,
    steden: [
      ...new Set(
        reisschema.segmenten
          .filter((s) => s.van && s.tot && s.van <= datum && datum <= s.tot)
          .map((s) => s.stad),
      ),
    ],
    nachtStadId: nachten.get(datum),
    reisdagen: reisdagen.filter((r) => r.datum === datum),
  }));
};

/** Reisdagen waarvan de datum nog niet vastligt, zoals een dagtrip op het weer. */
export const reisdagenZonderDatum = (reisdagen: Reisdag[]): Reisdag[] =>
  reisdagen.filter((r) => !r.datum);
