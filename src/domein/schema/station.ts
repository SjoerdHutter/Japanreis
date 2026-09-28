import { z } from 'zod';
import { coordinaatSchema } from './basis';

/**
 * Een stationsgids: hoe je door een groot station komt.
 *
 * Een Japans station is geen gebouw maar een wijk, met tientallen uitgangen,
 * meerdere maatschappijen die elk hun eigen poortjes hebben, en een
 * Shinkansen die er als een station in het station bovenop zit. Wie de
 * verkeerde uitgang neemt loopt een kwartier om, met een koffer. Daarom staat
 * hier per station wat je vooraf wil weten: welke uitgang waarvoor, waar de
 * Shinkansen is, en hoe je overstapt.
 *
 * Wat hier met opzet niet in staat zijn perronnummers en vertrektijden. Die
 * wisselen, en de borden op het station en een app als Jorudan weten het
 * altijd beter dan een bestand dat met de reis mee is gekomen.
 */

const idSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/, 'alleen kleine letters, cijfers en streepjes');

export const uitgangSchema = z.object({
  naam: z.string().min(1),
  /** Zoals hij op de borden staat, om te herkennen. */
  naamLokaal: z.string().optional(),
  /**
   * Waar de uitgang ongeveer is. Geschat: een uitgang is een trap of een
   * roltrap, en een punt op de kaart zit er al gauw vijftig meter naast.
   */
  coordinaten: coordinaatSchema.optional(),
  /** Waar je hier uitkomt en waarom je hem zou nemen. */
  waarvoor: z.string().min(1),
});
export type Uitgang = z.infer<typeof uitgangSchema>;

export const overstapSchema = z.object({
  naar: z.string().min(1),
  hoe: z.string().min(1),
});
export type Overstap = z.infer<typeof overstapSchema>;

export const stationSchema = z.object({
  id: idSchema,
  naam: z.string().min(1),
  naamLokaal: z.string().optional(),
  /** De stad uit steden.yaml waar het station bij hoort. */
  stad: z.string().min(1),
  soort: z.enum(['trein', 'bus']).default('trein'),
  coordinaten: coordinaatSchema,
  /** Twee of drie zinnen: wat voor station dit is, en het belangrijkste om te weten. */
  samenvatting: z.string().min(1),
  uitgangen: z.array(uitgangSchema).min(1),
  /** Waar de Shinkansen zit en hoe je erbij komt, als hij hier stopt. */
  shinkansen: z.string().optional(),
  overstappen: z.array(overstapSchema).optional(),
  /** Kluisjes en bagagebewaring. */
  bagage: z.string().optional(),
  tips: z.array(z.string().min(1)).optional(),
});
export type Station = z.infer<typeof stationSchema>;

export const stationsBestandSchema = z.array(stationSchema);
