import { z } from 'zod';
import { bedragSchema } from './basis';

/**
 * De praktische content: de appgids en de vervoerprijzen.
 *
 * Staat net als de rest in YAML, zodat je hem met de hand bijwerkt zodra een
 * prijs verandert. Dat gebeurt: de JR Pass werd in 2023 in één klap zeventig
 * procent duurder, en een rekentool met een oude prijs geeft een antwoord dat
 * erger is dan geen antwoord.
 */

export const appSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/),
  naam: z.string().min(1),
  categorie: z.enum(['vervoer', 'betalen', 'taal', 'eten', 'besparen', 'overig']),
  waarvoor: z.string().min(1),
  /** Werkt hij zonder bereik? "deels" is het eerlijke antwoord bij de meeste. */
  offline: z.enum(['ja', 'nee', 'deels']),
  voorafDownloaden: z.enum(['ja', 'nee', 'aanbevolen']),
  /** Het onderscheid dat telt bij de keuze wat je installeert. */
  bespaart: z.enum(['geld', 'tijd']),
  opmerking: z.string().optional(),
  land: z.array(z.enum(['japan', 'vietnam'])).min(1),
});
export type App = z.infer<typeof appSchema>;

export const appsBestandSchema = z.array(appSchema);

export const treinpasSchema = z.object({
  id: z.string().min(1),
  naam: z.string().min(1),
  dagen: z.number().int().positive(),
  prijs: bedragSchema,
});
export type Treinpas = z.infer<typeof treinpasSchema>;

export const trajectSchema = z.object({
  van: z.string().min(1),
  naar: z.string().min(1),
  /** Prijs van één enkele reis met een gereserveerde stoel. */
  enkeleReis: bedragSchema,
  minuten: z.number().int().positive(),
  opmerking: z.string().optional(),
});
export type Traject = z.infer<typeof trajectSchema>;

export const vervoerBestandSchema = z.object({
  passen: z.array(treinpasSchema).min(1),
  trajecten: z.array(trajectSchema).min(1),
});
export type VervoerContent = z.infer<typeof vervoerBestandSchema>;
