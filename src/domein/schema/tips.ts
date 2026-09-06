import { z } from 'zod';
import { bedragSchema } from './basis';
import { landSchema } from './stad';

/**
 * De reisadviezen uit de opgeslagen Instagram collectie, thematisch geordend.
 *
 * Waarom een eigen bestand en niet gewoon tekst in een scherm: dit is content
 * die veroudert. Een prijs van een luchthaventrein, een adres van een winkel,
 * een tempel die weer open is. Zolang het in YAML staat werk je het bij zonder
 * de app aan te raken, net als de rest van de content.
 *
 * Over de bedragen. In de tekst staan geen euro's uitgeschreven maar
 * plaatshouders, `{0}` voor het eerste bedrag, `{1}` voor het tweede. Het
 * scherm vult ze in met de centrale valutahelper. Dat is met opzet: zou de
 * omrekening in de tekst staan, dan hangt er een koers van de dag van schrijven
 * in vast en heb je twee waarheden in de app. Nu is er één plek waar de koers
 * en de afronding vandaan komen, en klopt de euro tussen haakjes ook over een
 * halfjaar nog.
 */

export const tipSchema = z.object({
  tekst: z.string().min(1),
  /**
   * De bedragen die bij de plaatshouders in `tekst` horen, op volgorde. Een
   * tekst met `{1}` erin en maar één bedrag is een fout, en dat wordt hieronder
   * ook echt afgevangen.
   */
  bedragen: z.array(bedragSchema).optional(),
  /** Verwijzing naar een stad, zodat de tip daar ook te zien is. */
  stad: z.string().optional(),
  /** Waar dit vandaan komt, meestal een Instagram account. */
  bron: z.string().optional(),
  /**
   * Twee posts kunnen elkaar tegenspreken. Dat is geen reden om er één weg te
   * laten: dan doet de app alsof er consensus is die er niet is.
   */
  tegenspraak: z.string().optional(),
});
export type Tip = z.infer<typeof tipSchema>;

const plaatshouders = (tekst: string): number[] =>
  [...tekst.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1]));

export const tipMetBedragenSchema = tipSchema.refine(
  (t) => {
    const nummers = plaatshouders(t.tekst);
    const aantal = t.bedragen?.length ?? 0;
    return nummers.every((n) => n < aantal);
  },
  { message: 'de tekst verwijst naar een bedrag dat er niet is' },
);

export const tipgroepSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/),
  titel: z.string().min(1),
  land: z.array(landSchema).min(1),
  /** Eén zin die zegt waar deze groep over gaat, voor boven de lijst. */
  inleiding: z.string().optional(),
  tips: z.array(tipMetBedragenSchema).min(1),
});
export type Tipgroep = z.infer<typeof tipgroepSchema>;

export const tipsBestandSchema = z.object({
  /** Waar deze adviezen vandaan komen en wanneer ze verzameld zijn. */
  herkomst: z.string().min(1),
  verzameldOp: z.iso.date(),
  groepen: z.array(tipgroepSchema).min(1),
});
export type TipsContent = z.infer<typeof tipsBestandSchema>;
