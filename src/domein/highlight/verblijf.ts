import type { Reissegment, Reisschema, Verblijf } from '@/domein/schema';

/**
 * Wanneer ben je in deze stad, en waar slaap je dan.
 *
 * Het reisschema wist dit al, maar het stond nergens op het scherm. Terwijl dit
 * juist de vraag is die je onderweg stelt: hoeveel nachten heb ik hier nog, en
 * is dit hotel al betaald.
 *
 * Het aantal nachten wordt hier niet uitgerekend maar overgenomen uit het
 * reisschema. Zie de toelichting bij `verblijfSchema`: uit van en tot valt het
 * niet af te leiden, want de laatste dag is de ene keer wel en de andere keer
 * geen nacht.
 */

export interface StadInSchema {
  van: string;
  tot: string;
  opmerking?: string;
  verblijf?: Verblijf;
}

const heeftDatums = (s: Reissegment): s is Reissegment & { van: string; tot: string } =>
  s.van !== undefined && s.tot !== undefined;

export const verblijfIn = (reisschema: Reisschema, stadId: string): StadInSchema[] =>
  reisschema.segmenten
    .filter((s) => s.stad === stadId)
    .filter(heeftDatums)
    .map((s) => ({
      van: s.van,
      tot: s.tot,
      opmerking: s.opmerking,
      verblijf: s.verblijf,
    }));

export const VERBLIJF_NAAM: Record<Verblijf['via'], string> = {
  booking: 'Booking.com',
  agoda: 'Agoda',
  airbnb: 'Airbnb',
  anders: 'elders geboekt',
  'nog-te-boeken': 'nog te boeken',
};

const MAANDEN_KORT = [
  'jan',
  'feb',
  'mrt',
  'apr',
  'mei',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'dec',
];

const DAG_MS = 86_400_000;

const dagEnMaand = (datum: string): { dag: number; maand: string } => {
  const [, maand, dag] = datum.split('-').map(Number);
  return { dag, maand: MAANDEN_KORT[maand - 1] };
};

const opeenvolgend = (van: string, tot: string): boolean =>
  Date.parse(`${tot}T00:00:00Z`) - Date.parse(`${van}T00:00:00Z`) === DAG_MS;

/**
 * Wanneer je in een stad bent, kort genoeg om naast de naam te staan: "4 okt",
 * "5 en 6 okt", "8 t/m 12 okt" of "30 sep t/m 2 okt". Twee bezoeken staan met
 * een komma achter elkaar, zoals Hanoi op de heen- en de terugreis.
 *
 * Geen streepje tussen de dagen. In een lijst leest "8-12 okt" nog wel, maar
 * het is dezelfde afspraak als in de rest van de app: een datum in een zin
 * hoort geen streepjes te hebben.
 */
export const periodeVan = (verblijven: StadInSchema[]): string | null => {
  if (verblijven.length === 0) return null;
  return verblijven
    .map(({ van, tot }) => {
      const begin = dagEnMaand(van);
      const eind = dagEnMaand(tot);
      if (van === tot) return `${begin.dag} ${begin.maand}`;
      const tussen = opeenvolgend(van, tot) ? 'en' : 't/m';
      return begin.maand === eind.maand
        ? `${begin.dag} ${tussen} ${eind.dag} ${eind.maand}`
        : `${begin.dag} ${begin.maand} ${tussen} ${eind.dag} ${eind.maand}`;
    })
    .join(', ');
};

/** Of je hier al geweest bent: elk bezoek ligt voor vandaag. Zonder datums nooit. */
export const isVoorbij = (verblijven: StadInSchema[], vandaag: string): boolean =>
  verblijven.length > 0 && verblijven.every((v) => v.tot < vandaag);
