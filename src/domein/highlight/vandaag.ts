import type { Reisschema, Stad } from '@/domein/schema';
import { THUIS_TIJDZONE, datumIn } from '@/domein/tijd/zones';
import { stadVolgensSchema } from './bepaal';

/**
 * Welke datum het vandaag is, op de plek waar je bent.
 *
 * Nodig voor alles wat je noteert zonder dat er een stad bij hoort, zoals een
 * uitgave. Die kreeg eerst de datum in UTC, en UTC loopt in Japan negen uur
 * achter: een ontbijt om acht uur in Kyoto kwam dan op de dag ervoor te staan.
 * Thuis ging het ook mis, tussen middernacht en twee uur 's nachts.
 *
 * De plek komt uit het reisschema, met thuis als terugval voor en na de reis.
 * Niet uit de highlight: die valt zonder GPS terug op de laatst bekeken stad,
 * en dan krijgt een uitgave thuis de datum van Japan. Het schema weet waar je
 * op een dag bent, ook zonder locatie en zonder bereik.
 *
 * Onderweg telt de bestemming al. Om half twaalf 's avonds op Schiphol is het
 * in Hanoi al de volgende ochtend, en dat is de dag waar je naartoe vliegt.
 */
export const vandaagOpReis = (
  steden: Stad[],
  reisschema: Reisschema,
  nu: Date = new Date(),
  thuis: string = THUIS_TIJDZONE,
): string => {
  const stad = stadVolgensSchema(steden, reisschema, nu)?.stad;
  return datumIn(stad?.tijdzone ?? thuis, nu);
};
