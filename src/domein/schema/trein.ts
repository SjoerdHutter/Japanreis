import { z } from 'zod';
import { coordinaatSchema } from './basis';

/**
 * De laatste trein van een knooppunt naar een station waar je 's avonds heen
 * moet. Een benadering, geen dienstregeling; zie data/laatste-treinen.yaml.
 */
export const laatsteTreinSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'alleen kleine letters, cijfers en streepjes'),
  stad: z.string().min(1),
  van: z.string().min(1),
  vanCoordinaten: coordinaatSchema,
  naar: z.string().min(1),
  naarStad: z.string().min(1),
  lijn: z.string().min(1),
  laatsteVertrek: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'schrijf als HH:MM'),
  opmerking: z.string().optional(),
  gecontroleerd: z.boolean(),
});
export type LaatsteTrein = z.infer<typeof laatsteTreinSchema>;

export const laatsteTreinenBestandSchema = z.array(laatsteTreinSchema);
