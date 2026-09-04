import { z } from 'zod';
import { coordinaatSchema, valutaSchema } from './basis';

/**
 * Een stad. Japan heeft er meerdere, Vietnam heeft er in deze reis één, en ze
 * zijn in de app precies even veel waard: Hanoi staat gewoon tussen de Japanse
 * steden en is net zo volledig te openen.
 */

export const landSchema = z.enum(['japan', 'vietnam']);
export type Land = z.infer<typeof landSchema>;

/**
 * Het rechthoekje waarbinnen de offline kaart wordt opgehaald. Niet de hele
 * gemeente maar het gebied waar je werkelijk komt: dat scheelt een factor tien
 * in het aantal tegels.
 */
export const kaartgebiedSchema = z.object({
  zuidwest: coordinaatSchema,
  noordoost: coordinaatSchema,
});
export type Kaartgebied = z.infer<typeof kaartgebiedSchema>;

export const stadSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'alleen kleine letters, cijfers en streepjes'),
  naam: z.string().min(1),
  naamLokaal: z.string().optional(),
  land: landSchema,
  /** IANA naam, bijvoorbeeld Asia/Tokyo. Japan is UTC+9, Vietnam UTC+7. */
  tijdzone: z.string().min(1),
  valuta: valutaSchema,
  centrum: coordinaatSchema,
  /**
   * Hoe ver van het centrum je nog "in deze stad" bent, in kilometers. Dit
   * bepaalt of de GPS-locatie op deze stad matcht. Ruim genomen, want een
   * ryokan in de heuvels hoort er ook bij.
   */
  straalKm: z.number().positive(),
  kaartgebied: kaartgebiedSchema,
  /** Welke tijdlijn hoort bij deze stad: die van Japan of die van Hanoi. */
  tijdlijn: z.string().min(1),
  /** De tijdvakken uit die tijdlijn die in deze stad te zien zijn. */
  tijdvakken: z.array(z.string()).default([]),
  korteBeschrijving: z.string().min(1),
  geschiedenis: z.string().optional(),
  /** Volgorde in het hoofdmenu; los van het reisschema, dat kan schuiven. */
  volgorde: z.number().int(),
});
export type Stad = z.infer<typeof stadSchema>;

export const stedenBestandSchema = z.array(stadSchema);

/**
 * De cachestatus van een stad hoort niet in de content maar bij het toestel: de
 * ene telefoon heeft Kyoto opgeslagen en de andere niet. Hij staat daarom in
 * IndexedDB en niet in het YAML-bestand.
 */
export interface Cachestatus {
  stadId: string;
  /** Aantal kaarttegels dat voor deze stad is opgeslagen. */
  tegels: number;
  /** Wanneer de stad voor het laatst offline is klaargezet. */
  opgeslagenOp: string | null;
}
