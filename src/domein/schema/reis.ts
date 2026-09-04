import { z } from 'zod';

/**
 * Het reisschema: welke stad op welke dag.
 *
 * Dit is één van de twee bronnen waarop de highlight logica draait, naast GPS.
 * Datums zijn met opzet optioneel: zolang ze niet ingevuld zijn draait de app
 * gewoon door en valt de highlight terug op GPS en op de laatst bekeken stad.
 * Een half ingevuld schema is dus geen fout maar een normale toestand.
 *
 * Een stad mag meerdere keren voorkomen. Dat is niet theoretisch: Hanoi staat
 * er twee keer in, één keer op de heenreis en één keer op de terugreis.
 */

export const reissegmentSchema = z
  .object({
    stad: z.string().min(1),
    /** Eerste dag in deze stad, als YYYY-MM-DD. */
    van: z.iso.date().optional(),
    /** Laatste dag in deze stad, als YYYY-MM-DD. Gelijk aan `van` bij één dag. */
    tot: z.iso.date().optional(),
    opmerking: z.string().optional(),
  })
  .refine((s) => (s.van === undefined) === (s.tot === undefined), {
    message: 'vul van en tot allebei in, of allebei niet',
  })
  .refine((s) => s.van === undefined || s.tot === undefined || s.van <= s.tot, {
    message: 'tot ligt voor van',
  });
export type Reissegment = z.infer<typeof reissegmentSchema>;

export const reisschemaSchema = z.object({
  naam: z.string().min(1),
  segmenten: z.array(reissegmentSchema),
});
export type Reisschema = z.infer<typeof reisschemaSchema>;
