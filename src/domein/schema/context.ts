import { z } from 'zod';
import { landSchema } from './stad';

/**
 * De context-content uit hoofdstuk 13: etiquette, zinnen, seizoen en weer.
 *
 * Dit is het deel van de app dat het minst verandert en het meest gelezen wordt
 * op het moment zelf: voor een badhuis, aan een tafel, in een trein. Daarom
 * staat het als gewone content in YAML en niet in code.
 */

export const etiquetteSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/),
  situatie: z.string().min(1),
  land: z.array(landSchema).min(1),
  regels: z.array(z.string().min(1)).min(1),
  /** Het misverstand dat het vaakst misgaat. */
  letOp: z.string().optional(),
});
export type Etiquette = z.infer<typeof etiquetteSchema>;
export const etiquetteBestandSchema = z.array(etiquetteSchema);

export const zinSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/),
  categorie: z.enum(['basis', 'eten', 'allergie', 'onderweg', 'nood']),
  land: landSchema,
  nederlands: z.string().min(1),
  /** Het schrift, om te tonen aan wie geen Engels spreekt. */
  lokaal: z.string().min(1),
  /** De uitspraak in Nederlandse spelling, niet in officiële romaji. */
  uitspraak: z.string().min(1),
  wanneer: z.string().optional(),
});
export type Zin = z.infer<typeof zinSchema>;
export const zinnenBestandSchema = z.array(zinSchema);

/** Een datum zonder jaar, als MM-DD. Seizoenen herhalen zich immers. */
const dagInHetJaarSchema = z.string().regex(/^\d{2}-\d{2}$/, 'schrijf als MM-DD');

const bloeiSchema = z.object({
  begintTypisch: dagInHetJaarSchema,
  hoogtepuntTypisch: dagInHetJaarSchema,
  duurDagen: z.number().int().positive().optional(),
});

export const regioSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/),
  naam: z.string().min(1),
  steden: z.array(z.string().min(1)).min(1),
  kersenbloesem: bloeiSchema.optional(),
  herfstblad: bloeiSchema.optional(),
  opmerking: z.string().optional(),
});
export type Regio = z.infer<typeof regioSchema>;

export const weerwaarschuwingSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/),
  naam: z.string().min(1),
  land: landSchema,
  vanaf: dagInHetJaarSchema,
  tot: dagInHetJaarSchema,
  wat: z.string().min(1),
});
export type Weerwaarschuwing = z.infer<typeof weerwaarschuwingSchema>;

export const seizoenBestandSchema = z.object({
  regios: z.array(regioSchema).min(1),
  waarschuwingen: z.array(weerwaarschuwingSchema),
});
export type SeizoenContent = z.infer<typeof seizoenBestandSchema>;
