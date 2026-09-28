import { z } from 'zod';

/**
 * De allergenen die de app kent.
 *
 * Eén lijst voor twee plekken: je eigen medische gegevens en de menukaart. Zou
 * elk scherm zijn eigen woorden kiezen, dan staat er bij jou "schaaldieren" en
 * bij een gerecht "schelpdieren", en dan waarschuwt de menukaart nergens voor.
 * Varkensvlees en alcohol zijn geen allergenen in de medische zin, maar wel
 * precies wat je aan een Japanse kaart niet ziet en wel wilt weten.
 */
export const ALLERGENEN = [
  'gluten',
  'schaaldieren',
  'vis',
  'ei',
  'melk',
  'soja',
  'pinda',
  'sesam',
  'noten',
  'varkensvlees',
  'alcohol',
] as const;

export const allergeenSchema = z.enum(ALLERGENEN);
export type Allergeen = z.infer<typeof allergeenSchema>;

/** Zoals het in een zin hoort: "gluten", "pinda's". */
export const ALLERGEEN_NAAM: Record<Allergeen, string> = {
  gluten: 'gluten',
  schaaldieren: 'schaaldieren en schelpdieren',
  vis: 'vis',
  ei: 'ei',
  melk: 'melk',
  soja: 'soja',
  pinda: "pinda's",
  sesam: 'sesam',
  noten: 'noten',
  varkensvlees: 'varkensvlees',
  alcohol: 'alcohol',
};
