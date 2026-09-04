import { z } from 'zod';

/**
 * De bouwstenen die overal terugkomen: een punt op de aarde, een bedrag en een
 * bron. Ze staan apart omdat zowel een attractie als een restaurant als een
 * stempel ze gebruikt, en omdat een bedrag nooit zonder valuta mag rondzwerven.
 */

export const coordinaatSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type Coordinaat = z.infer<typeof coordinaatSchema>;

/**
 * De valuta's die in de app voorkomen. EUR staat erbij omdat een enkele post
 * (een vlucht, een verzekering) gewoon in euro's staat; die krijgt dan geen
 * omrekening tussen haakjes, want dat zou onzin zijn.
 */
export const valutaSchema = z.enum(['JPY', 'VND', 'EUR']);
export type Valuta = z.infer<typeof valutaSchema>;

/**
 * Een bedrag in lokale valuta. `tot` maakt er een reeks van, zoals de ¥300 tot
 * ¥500 die een goshuin kost. De omrekening naar euro's gebeurt nooit hier maar
 * altijd in de valutahelper, zodat er precies één plek is waar de koers en de
 * afronding vandaan komen.
 */
export const bedragSchema = z.object({
  bedrag: z.number().nonnegative(),
  tot: z.number().nonnegative().optional(),
  valuta: valutaSchema,
  toelichting: z.string().optional(),
});
export type Bedrag = z.infer<typeof bedragSchema>;

/** Gratis is geen bedrag van nul: het hoort anders op het scherm te staan. */
export const prijsSchema = z.union([z.literal('gratis'), bedragSchema]);
export type Prijs = z.infer<typeof prijsSchema>;

export const weekdagSchema = z.enum([
  'maandag',
  'dinsdag',
  'woensdag',
  'donderdag',
  'vrijdag',
  'zaterdag',
  'zondag',
]);
export type Weekdag = z.infer<typeof weekdagSchema>;

/** De volgorde die `Date.getDay()` aanhoudt, zodat omrekenen één opzoeking is. */
export const WEEKDAGEN: readonly Weekdag[] = [
  'zondag',
  'maandag',
  'dinsdag',
  'woensdag',
  'donderdag',
  'vrijdag',
  'zaterdag',
];

/**
 * Openingstijden.
 *
 * `standaard` geldt voor elke dag die niet in `perDag` staat. Een dag met de
 * waarde "gesloten" is een vaste sluitingsdag, en daar hangt de waarschuwing
 * aan die musea op maandag ondervangt. Tijden staan als "09:00-17:00", meerdere
 * blokken gescheiden door een komma voor zaken die tussen de middag dicht gaan.
 */
export const openingstijdenSchema = z.object({
  standaard: z.string().optional(),
  perDag: z.partialRecord(weekdagSchema, z.string()).optional(),
  laatsteToegang: z.string().optional(),
  opmerking: z.string().optional(),
});
export type Openingstijden = z.infer<typeof openingstijdenSchema>;

export const bronSchema = z.object({
  naam: z.string().min(1),
  url: z.url().optional(),
  /**
   * Wanneer dit voor het laatst is nagekeken. Reisinformatie veroudert stil:
   * een tempel die om 16:00 dicht ging doet dat volgend jaar om 15:30 en je
   * merkt het pas voor de deur.
   */
  gecontroleerdOp: z.iso.date().optional(),
});
export type Bron = z.infer<typeof bronSchema>;
