import { z } from 'zod';

/**
 * De sumogids: regels, technieken en tips voor als je bij een show zelf de ring
 * in stapt.
 *
 * De tekst staat in data/sumo.yaml, de tekeningen in de app. Een sectie of punt
 * wijst met `tekening` naar een tekening uit de lijst hieronder; een id die
 * niet bestaat valt zo al bij de controle in CI op, en niet pas als iemand de
 * pagina opent en een gat ziet.
 */

export const sumoTekeningSchema = z.enum([
  'ring',
  'uit-de-ring',
  'grond-geraakt',
  'shikiri',
  'tachiai',
  'yorikiri',
  'oshidashi',
  'tsukidashi',
  'hatakikomi',
  'uwatenage',
  'okuridashi',
  'houding',
  'suri-ashi',
]);
export type SumoTekening = z.infer<typeof sumoTekeningSchema>;

/** De tekentjes bij de verboden grepen. */
export const sumoVerbodSchema = z.enum([
  'vuist',
  'haar',
  'ogen',
  'oren',
  'mawashi',
  'keel',
  'trappen',
  'vingers',
]);
export type SumoVerbod = z.infer<typeof sumoVerbodSchema>;

export const sumoPuntSchema = z.object({
  titel: z.string().min(1),
  /** De term in het Japans, voor wie hem op een bord of in de show hoort. */
  lokaal: z.string().optional(),
  tekst: z.string().min(1),
  tekening: sumoTekeningSchema.optional(),
  verbod: sumoVerbodSchema.optional(),
});
export type SumoPunt = z.infer<typeof sumoPuntSchema>;

export const sumoSectieSchema = z.object({
  id: z.string().regex(/^[a-z-]+$/),
  titel: z.string().min(1),
  /** Het woord op de knop bovenaan de pagina die naar deze sectie springt. */
  kort: z.string().min(1),
  tekst: z.array(z.string().min(1)).optional(),
  /** Tekeningen naast elkaar boven de punten, zoals de twee manieren van winnen. */
  tekeningen: z.array(sumoTekeningSchema).optional(),
  punten: z.array(sumoPuntSchema).optional(),
  /** Punten als genummerde stappen, voor het verloop van een partij. */
  stappen: z.boolean().optional(),
});
export type SumoSectie = z.infer<typeof sumoSectieSchema>;

export const sumoSchema = z.object({
  intro: z.string().min(1),
  secties: z.array(sumoSectieSchema).min(1),
  woorden: z.array(
    z.object({
      woord: z.string().min(1),
      lokaal: z.string().min(1),
      uitleg: z.string().min(1),
    }),
  ),
});
export type SumoGids = z.infer<typeof sumoSchema>;
