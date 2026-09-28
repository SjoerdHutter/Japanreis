import { z } from 'zod';
import { datumSchema, tijdSchema } from './gegevens';

/**
 * Wat de app zelf op het toestel bewaart, als schema.
 *
 * Lang waren dit alleen TypeScript-typen. Dat is genoeg zolang de app de enige
 * is die schrijft, maar niet meer zodra er iets van buiten binnenkomt: een JSON
 * sjabloon dat je op je laptop invult, of een backup die je terugzet. Die
 * worden hier gecontroleerd voordat ze de database in gaan.
 */

/**
 * Een reservering: restaurant, ryokan, of een ticket dat op een vast moment in
 * de verkoop gaat.
 *
 * Dat laatste is waarom dit meer is dan een lijstje. Het Ghibli Museum verkoopt
 * op de tiende van de maand ervoor en is binnen minuten weg; teamLab werkt met
 * tijdvakken. Wie dat moment mist, mist het bezoek.
 *
 * Heet hier `reserveringRecord` omdat `reservering` in het plaatsmodel al de
 * vraag is of je moet reserveren.
 */
export const reserveringRecordSchema = z.object({
  id: z.string().min(1),
  wat: z.string().trim().min(1, { error: 'Vul in wat je reserveert.' }).max(200),
  /** Datum van het bezoek zelf, als YYYY-MM-DD. */
  datum: datumSchema.optional(),
  /** Tijd van het bezoek als HH:MM, in de tijdzone van de stad. */
  tijd: tijdSchema.optional(),
  /** Wanneer de kaartverkoop opengaat, als YYYY-MM-DD. */
  verkoopVanaf: datumSchema.optional(),
  /** Hoe laat de verkoop opengaat, in de tijdzone van de stad. */
  verkoopTijd: tijdSchema.optional(),
  stadId: z.string().optional(),
  plaatsId: z.string().optional(),
  status: z.enum(['te-regelen', 'geboekt']),
  boekingsnummer: z.string().trim().max(60).optional(),
  notitie: z.string().max(4000).optional(),
  gewijzigdOp: z.string().optional(),
});
export type OpgeslagenReservering = z.infer<typeof reserveringRecordSchema>;
