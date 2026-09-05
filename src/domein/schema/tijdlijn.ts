import { z } from 'zod';

/**
 * Geschiedenis op twee niveaus. Dit bestand doet het bovenste niveau: de
 * tijdvakken van een land. Het onderste niveau, de geschiedenis van een stad,
 * staat als tekst bij de stad zelf.
 *
 * Elke plaats verwijst met `tijdvakken` naar de ids hieronder. Zo is vanaf een
 * tempel de historische context in twee tikken bereikbaar, en andersom vanaf
 * een tijdvak de lijst met punten die eruit stammen.
 */

export const tijdvakSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/),
  naam: z.string().min(1),
  /** Jaartallen; negatief voor voor onze jaartelling. `tot` leeg is: tot nu. */
  van: z.number().int(),
  tot: z.number().int().optional(),
  samenvatting: z.string().min(1),
  /** Wat je er in het straatbeeld nog van terugziet. */
  herkenbaarAan: z.string().optional(),
});
export type Tijdvak = z.infer<typeof tijdvakSchema>;

export const tijdlijnSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/),
  naam: z.string().min(1),
  tijdvakken: z.array(tijdvakSchema).min(1),
});
export type Tijdlijn = z.infer<typeof tijdlijnSchema>;

export const tijdlijnenBestandSchema = z.array(tijdlijnSchema);
