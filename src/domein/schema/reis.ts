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

/**
 * Waar je slaapt, zonder de boekingslink.
 *
 * De link naar een bevestiging bij Booking, Agoda of Airbnb draagt een
 * `auth_key` of een reserverings-id waarmee iedereen die hem heeft de boeking
 * kan inzien en wijzigen. Dat is een sleutel, geen adres, en die hoort niet in
 * een openbare repository. Wat hier staat is wat je onderweg wil weten zonder
 * dat het iets prijsgeeft; de link zelf zet je in het reserveringenscherm, dat
 * alleen op je eigen toestel bewaart.
 */
export const verblijfSchema = z.object({
  via: z.enum(['booking', 'agoda', 'airbnb', 'anders', 'nog-te-boeken']),
  /**
   * Aantal nachten dat je hier slaapt, overgenomen uit het reisoverzicht.
   *
   * Met opzet een veld en geen som over `van` en `tot`. Zo'n som klopt de ene
   * keer wel en de andere keer niet: in Kyoto slaap je ook de laatste dag, in
   * Tokio vertrek je die ochtend om half tien. Het verschil zit in de boeking en
   * niet in de kalender, dus het hoort hier te staan in plaats van geraden te
   * worden. Een verkeerd getal betekent op de laatste ochtend ontbijten in een
   * kamer die niet meer van jou is.
   */
  nachten: z.number().int().nonnegative(),
  betaald: z.enum(['ja', 'nee', 'deels']).optional(),
  ontbijt: z.boolean().optional(),
  opmerking: z.string().optional(),
});
export type Verblijf = z.infer<typeof verblijfSchema>;

export const reissegmentSchema = z
  .object({
    stad: z.string().min(1),
    /** Eerste dag in deze stad, als YYYY-MM-DD. */
    van: z.iso.date().optional(),
    /** Laatste dag in deze stad, als YYYY-MM-DD. Gelijk aan `van` bij één dag. */
    tot: z.iso.date().optional(),
    opmerking: z.string().optional(),
    verblijf: verblijfSchema.optional(),
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
