import { z } from 'zod';
import { allergeenSchema } from './allergeen';

/**
 * De menukaart: gerechten en termen die je op een Japanse kaart tegenkomt.
 *
 * `kanji` is er alleen als een gerecht zo geschreven wordt; ramen staat op elke
 * kaart gewoon in katakana. De allergenen zijn een vuistregel, geen belofte:
 * elke zaak kookt anders. Daarom draagt elke regel `gecontroleerd`.
 */
export const MENU_CATEGORIEEN = [
  'ramen',
  'sushi',
  'izakaya',
  'donburi',
  'noedels',
  'konbini',
  'zoet',
  'drank',
  'kookterm',
] as const;

export const menuCategorieSchema = z.enum(MENU_CATEGORIEEN);
export type MenuCategorie = z.infer<typeof menuCategorieSchema>;

export const MENU_CATEGORIE_NAAM: Record<MenuCategorie, string> = {
  ramen: 'Ramen',
  sushi: 'Sushi en sashimi',
  izakaya: 'Izakaya',
  donburi: 'Donburi en rijst',
  noedels: 'Udon en soba',
  konbini: 'Konbini',
  zoet: 'Zoet',
  drank: 'Drinken',
  kookterm: 'Kooktermen',
};

export const menuItemSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'alleen kleine letters, cijfers en streepjes'),
  categorie: menuCategorieSchema,
  kanji: z.string().min(1).optional(),
  kana: z.string().min(1),
  romaji: z.string().min(1),
  nederlands: z.string().min(1),
  allergenen: z.array(allergeenSchema).default([]),
  gecontroleerd: z.boolean(),
});
export type MenuItem = z.infer<typeof menuItemSchema>;

export const menuBestandSchema = z.array(menuItemSchema);
