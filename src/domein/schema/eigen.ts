import { z } from 'zod';
import { coordinaatSchema } from './basis';

/**
 * De persoonlijke laag: punten die jij hebt toegevoegd.
 *
 * Bewust een apart model naast `Plaats`, en niet een vlaggetje erop. Een punt
 * uit een Google Maps lijst weet vaak niet meer dan een naam en een pin, en
 * daar horen geen openingstijden en drukte-indicaties bij die niemand heeft
 * nagekeken. Zou dit door de redactionele content heen lopen, dan is straks
 * niet meer te zien wat de app beweert en wat jij ergens hebt opgeslagen.
 *
 * Op de kaart krijgt deze laag daarom een eigen kleur, en in de lijst een eigen
 * label. Een punt dat aan een bestaande plaats gekoppeld kan worden verwijst
 * ernaar met `koppelingPlaatsId`, maar blijft zelf gewoon bestaan.
 */

export const eigenBronSchema = z.enum(['google-maps', 'instagram', 'handmatig']);
export type EigenBron = z.infer<typeof eigenBronSchema>;

export const eigenPuntSchema = z.object({
  id: z.string().min(1),
  naam: z.string().min(1),
  /** De naam van de lijst waar het punt uit kwam, zoals die in Maps stond. */
  lijst: z.string().optional(),
  /**
   * Ontbreekt als de export alleen een naam gaf. Zulke punten blijven staan en
   * kun je met de hand op de kaart zetten; ze verdwijnen niet.
   */
  coordinaten: coordinaatSchema.optional(),
  adres: z.string().optional(),
  notitie: z.string().optional(),
  url: z.string().optional(),
  /** In welke stad dit punt valt, als dat te bepalen was. */
  stadId: z.string().optional(),
  /** Naar welke plaats uit de app dit punt verwijst, als er een match was. */
  koppelingPlaatsId: z.string().optional(),
  bron: eigenBronSchema,
  /**
   * Voor tips uit Instagram: niet door de app nagekeken. Reels noemen vaak
   * zaken die inmiddels gesloten of betaald zijn.
   */
  ongeverifieerd: z.boolean().optional(),
  toegevoegdOp: z.string().min(1),
});
export type EigenPunt = z.infer<typeof eigenPuntSchema>;
