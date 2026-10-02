import { z } from 'zod';
// Met extensie, net als in plaats.ts: vite.config.ts laadt dit mee.
import { osmFout } from '../openingstijden/osm.ts';

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

/**
 * Eén regel uit een prijslijst: volwassenen, studenten, een audiogids.
 *
 * `prijs` hierboven is het ene bedrag dat in de labels en de filters staat;
 * deze lijst staat op de detailpagina, als een plek meer prijzen heeft. Een
 * regel heeft een vast bedrag of een reeks van tot. Zonder valuta geldt die van
 * de stad. `indicatief` zet er het label "indicatie" bij: een schatting, geen
 * prijs van een kaart.
 */
export const prijsRegelSchema = z
  .object({
    omschrijving: z.string().min(1),
    bedrag: z.number().nonnegative().optional(),
    van: z.number().nonnegative().optional(),
    tot: z.number().nonnegative().optional(),
    valuta: valutaSchema.optional(),
    /** Per wat: per persoon, per kom, per uur. */
    eenheid: z.string().optional(),
    indicatief: z.boolean().optional(),
  })
  .refine(
    (r) =>
      (r.bedrag !== undefined && r.van === undefined && r.tot === undefined) ||
      (r.bedrag === undefined && r.van !== undefined && r.tot !== undefined && r.van <= r.tot),
    { message: 'een prijsregel heeft een bedrag, of een van en tot' },
  );
export type PrijsRegel = z.infer<typeof prijsRegelSchema>;

/**
 * Een periode waarin een plek dicht is, zoals het jaarlijkse onderhoud van het
 * mausoleum. Gaat voor de openingstijden: wat hier valt is dicht, wat de tijden
 * ook zeggen.
 */
export const sluitingSchema = z
  .object({
    van: z.iso.date(),
    tot: z.iso.date(),
    reden: z.string().min(1),
  })
  .refine((s) => s.van <= s.tot, { message: 'een sluiting eindigt niet voor hij begint' });
export type Sluiting = z.infer<typeof sluitingSchema>;

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

/**
 * De week zoals je hem opschrijft en leest: van maandag tot zondag. Gebruik
 * deze overal waar dagen op het scherm komen of gesorteerd worden.
 */
export const WEEKDAGEN: readonly Weekdag[] = [
  'maandag',
  'dinsdag',
  'woensdag',
  'donderdag',
  'vrijdag',
  'zaterdag',
  'zondag',
];

/**
 * Dezelfde dagen, maar in de volgorde die `Date.getDay()` aanhoudt.
 *
 * Apart van de lijst hierboven omdat de twee volgordes verschillen: JavaScript
 * begint de week op zondag en wij op maandag. Eén lijst voor allebei gebruiken
 * levert dagen op die een plaats opschuiven, en dat merk je pas als je op de
 * verkeerde dag voor een dichte deur staat.
 */
export const WEEKDAGEN_VANAF_ZONDAG: readonly Weekdag[] = [
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
 *
 * `osm` is de notatie van OpenStreetMap, voor tijden die meer kunnen dan dat:
 * seizoenen, de eerste maandag van de maand, een periode dicht. Staat hij er,
 * dan gaat hij voor `standaard` en `perDag`. `tekst` is hoe je de tijden leest,
 * voor op het scherm. Is er alleen een tekst, dan weet de app het niet en zegt
 * hij dat ook: geen tijden is onbekend, nooit altijd open.
 */
export const openingstijdenSchema = z.object({
  standaard: z.string().optional(),
  perDag: z.partialRecord(weekdagSchema, z.string()).optional(),
  laatsteToegang: z.string().optional(),
  opmerking: z.string().optional(),
  osm: z
    .string()
    .optional()
    .superRefine((osm, ctx) => {
      const melding = osm === undefined ? null : osmFout(osm);
      if (melding) ctx.addIssue({ code: 'custom', message: melding });
    }),
  tekst: z.string().optional(),
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
