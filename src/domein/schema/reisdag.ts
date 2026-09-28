import { z } from 'zod';

/**
 * Een reisdag: de dag dat je van de ene stad naar de andere gaat.
 *
 * Het reisschema zegt waar je slaapt; dit zegt hoe je er komt. Welke trein,
 * vanaf welk station, hoe lang, of je moet reserveren, en wat je met je koffer
 * doet. Dat laatste is in Japan geen detail: in de Shinkansen tussen Tokio,
 * Osaka en Hiroshima moet je voor een grote koffer een plaats met bagageruimte
 * reserveren, en wie dat niet weet betaalt aan boord bij.
 */

const idSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/, 'alleen kleine letters, cijfers en streepjes');

export const vervoerSoortSchema = z.enum([
  'shinkansen',
  'limited-express',
  'trein',
  'metro',
  'bus',
  'boot',
]);
export type VervoerSoort = z.infer<typeof vervoerSoortSchema>;

export const reisstapSchema = z.object({
  vervoer: vervoerSoortSchema,
  /** Welke trein of bus, zoals je hem op het bord zoekt. */
  naam: z.string().min(1),
  /** Waar je instapt en uitstapt, zo geschreven dat Google Maps het vindt. */
  van: z.string().min(1),
  naar: z.string().min(1),
  /** De stationsgidsen die erbij horen, uit stations.yaml. */
  vanStation: z.string().optional(),
  naarStation: z.string().optional(),
  minuten: z.number().int().positive(),
  reserveren: z.enum(['verplicht', 'aanbevolen', 'niet-nodig']).optional(),
  /** Een andere manier om hetzelfde stuk te doen, geen volgende stap. */
  alternatief: z.boolean().optional(),
  opmerking: z.string().optional(),
});
export type Reisstap = z.infer<typeof reisstapSchema>;

export const reisdagSchema = z
  .object({
    id: idSchema,
    /** De dag, als YYYY-MM-DD. Leeg als die nog niet vastligt. */
    datum: z.iso.date().optional(),
    /** Als de dag nog niet vastligt: wanneer ongeveer. */
    wanneer: z.string().optional(),
    titel: z.string().min(1),
    /** Steden uit steden.yaml. `van` mag leeg zijn, bijvoorbeeld vanaf het vliegveld. */
    van: z.string().optional(),
    naar: z.string().min(1),
    stappen: z.array(reisstapSchema).min(1),
    bagage: z.string().optional(),
    opmerking: z.string().optional(),
  })
  .refine((d) => d.datum !== undefined || d.wanneer !== undefined, {
    message: 'vul een datum in, of bij een dag die nog niet vastligt: wanneer',
  });
export type Reisdag = z.infer<typeof reisdagSchema>;

export const reisdagenBestandSchema = z.array(reisdagSchema);
