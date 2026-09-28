import type { Reisdag, Reisschema, Stad } from '@/domein/schema';
import { stadVolgensSchema } from '@/domein/highlight/bepaal';
import { vandaagOpReis } from '@/domein/highlight/vandaag';
import { THUIS_TIJDZONE, uurIn } from '@/domein/tijd/zones';
import { dagenVanDeReis } from './dagen';

/** Vanaf dit uur, in de zone van de stad waar je bent, vraagt de app om een notitie. */
export const AVOND_UUR = 20;

/**
 * Voor welke dag de app 's avonds om een notitie vraagt: vandaag, als het een
 * dag van de reis is en het daar na acht uur is. Anders null. Of de notitie al
 * geschreven is, weet de opslag; dat beslist de aanroeper.
 */
export const avondVoorNotitie = (
  nu: Date,
  steden: Stad[],
  reisschema: Reisschema,
  reisdagen: Reisdag[],
): string | null => {
  const vandaag = vandaagOpReis(steden, reisschema, nu);
  if (!dagenVanDeReis(reisschema, reisdagen).some((d) => d.datum === vandaag)) return null;
  const zone = stadVolgensSchema(steden, reisschema, nu)?.stad.tijdzone ?? THUIS_TIJDZONE;
  return uurIn(zone, nu) >= AVOND_UUR ? vandaag : null;
};
