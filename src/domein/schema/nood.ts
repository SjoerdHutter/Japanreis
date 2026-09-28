import { z } from 'zod';
import { ALLERGENEN, allergeenSchema } from './allergeen';
import { landSchema } from './stad';

/**
 * Het noodscherm: nummers, ambassades en wat je doet bij een aardbeving of een
 * tyfoon. En de allergenen in het Japans en Vietnamees, voor de kaarten die je
 * laat zien.
 *
 * Elk feit draagt `gecontroleerd`. Het zijn feiten waar je op moet kunnen
 * bouwen op het slechtste moment van de reis, en ze komen uit algemene kennis;
 * tot je ze zelf hebt nagekeken staat er een label bij.
 */

const idSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/, 'alleen kleine letters, cijfers en streepjes');

export const noodnummerSchema = z.object({
  id: idSchema,
  naam: z.string().min(1),
  /** Zoals je het intoetst: 110, of internationaal met een plus. */
  nummer: z.string().regex(/^\+?[\d ]+$/, 'alleen cijfers, spaties en een plus vooraan'),
  wanneer: z.string().optional(),
  gecontroleerd: z.boolean(),
});
export type Noodnummer = z.infer<typeof noodnummerSchema>;

export const ambassadeSchema = z.object({
  id: idSchema,
  naam: z.string().min(1),
  adres: z.string().min(1),
  adresLokaal: z.string().optional(),
  telefoon: z.string().regex(/^\+[\d ]+$/),
  url: z.url(),
  gecontroleerd: z.boolean(),
});
export type Ambassade = z.infer<typeof ambassadeSchema>;

export const rampSchema = z.object({
  id: idSchema,
  titel: z.string().min(1),
  land: z.array(landSchema).min(1),
  inleiding: z.string().optional(),
  stappen: z.array(z.string().min(1)).min(1),
  gecontroleerd: z.boolean(),
});
export type Ramp = z.infer<typeof rampSchema>;

export const noodLandSchema = z.object({
  land: landSchema,
  naam: z.string().min(1),
  nummers: z.array(noodnummerSchema).min(1),
  ambassade: ambassadeSchema,
  /** Zinnen uit zinnen.yaml om in grote letters te tonen. */
  toonkaarten: z.array(z.string()).default([]),
});
export type NoodLand = z.infer<typeof noodLandSchema>;

export const noodBestandSchema = z.object({
  landen: z.array(noodLandSchema).min(1),
  algemeen: z.array(noodnummerSchema),
  rampen: z.array(rampSchema),
});
export type NoodContent = z.infer<typeof noodBestandSchema>;

export const allergeenVertalingSchema = z.object({
  id: allergeenSchema,
  japans: z.string().min(1),
  vietnamees: z.string().min(1),
  gecontroleerd: z.boolean(),
});
export type AllergeenVertaling = z.infer<typeof allergeenVertalingSchema>;

export const allergenenBestandSchema = z
  .array(allergeenVertalingSchema)
  .refine((lijst) => ALLERGENEN.every((a) => lijst.some((v) => v.id === a)), {
    error: 'elk allergeen uit de vaste lijst heeft een vertaling nodig',
  });
