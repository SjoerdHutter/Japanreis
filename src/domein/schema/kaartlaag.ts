import { z } from 'zod';

/**
 * Praktische kaartlagen per stad: geldautomaten, kluisjes en toiletten, uit
 * OpenStreetMap. Gemaakt door scripts/kaartlagen.mjs en meegeleverd in
 * data/kaartlagen/, zodat ze zonder bereik werken.
 *
 * Een punt is een lijstje om het bestand klein te houden: breedte, lengte, en
 * dan naam, uitbater en openingstijden als die er zijn. Een leeg veld is een
 * lege tekst, zodat de volgorde klopt.
 */
export const laagpuntSchema = z.tuple([z.number(), z.number()], z.string());
export type Laagpunt = z.infer<typeof laagpuntSchema>;

export const kaartlagenBestandSchema = z.object({
  stad: z.string().min(1),
  /** De bronvermelding die OpenStreetMap vraagt. */
  bron: z.string().min(1),
  opgehaaldOp: z.string().min(1),
  geld: z.array(laagpuntSchema),
  kluisjes: z.array(laagpuntSchema),
  toiletten: z.array(laagpuntSchema),
});
export type Kaartlagen = z.infer<typeof kaartlagenBestandSchema>;

export const KAARTLAAG_IDS = ['geld', 'kluisjes', 'toiletten'] as const;
export type KaartlaagId = (typeof KAARTLAAG_IDS)[number];
