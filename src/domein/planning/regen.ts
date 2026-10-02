import type { Plaats, Stad } from '@/domein/schema';
import { filterPlaatsen, regenbestendigVan } from '@/domein/filters/plaatsen';

/**
 * Wat er op een regendag in het voorstel blijft.
 *
 * Hetzelfde filter als de knop "bij regen" op het stadsscherm: attracties die
 * regenbestendig zijn. Een attractie waarvan de content niet zegt dat hij bij
 * regen kan, gaat eruit; liever een museum te veel voorgesteld dan een
 * bamboebos in de stromende regen. Eten en een spa blijven staan, want dat is
 * meestal binnen, tenzij de content zegt dat het buiten is: een krukje op de
 * stoep of een dakterras.
 */
export const splitsBijRegen = (
  plaatsen: Plaats[],
  stad: Stad,
): { binnen: Plaats[]; buiten: Plaats[] } => {
  const attracties = plaatsen.filter((p) => p.categorie === 'attractie');
  const regenbestendig = new Set(
    filterPlaatsen(attracties, { regenbestendig: true }, stad).map((p) => p.id),
  );
  const binnen: Plaats[] = [];
  const buiten: Plaats[] = [];
  for (const plaats of plaatsen) {
    const nat =
      plaats.categorie === 'attractie'
        ? !regenbestendig.has(plaats.id)
        : regenbestendigVan(plaats) === false;
    if (nat) buiten.push(plaats);
    else binnen.push(plaats);
  }
  return { binnen, buiten };
};
