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
