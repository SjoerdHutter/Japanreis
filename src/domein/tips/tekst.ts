import type { Tip } from '@/domein/schema';
import { formatteerBedrag } from '@/domein/valuta/formatteer';
import type { Koersen } from '@/domein/valuta/koers';

/**
 * Een tip opdelen in stukken tekst en ingevulde bedragen.
 *
 * De tekst van een tip bevat plaatshouders als `{0}` en `{1}`. Hier worden die
 * vervangen door het bedrag met de euro ernaast, via dezelfde helper als de rest
 * van de app. Het resultaat is een lijst stukken en niet één string, zodat het
 * scherm een bedrag desgewenst anders kan opmaken dan de zin eromheen.
 *
 * Een plaatshouder zonder bijbehorend bedrag blijft staan zoals hij is. Dat kan
 * niet gebeuren, want het schema wijst zo'n tip af, maar deze functie draait ook
 * op data uit een oude cache en die kan wel achterlopen. Dan liever `{3}` in
 * beeld dan een lege plek waar een prijs hoort te staan.
 */

export interface Stuk {
  soort: 'tekst' | 'bedrag';
  inhoud: string;
}

export const stukkenVan = (tip: Tip, koersen: Koersen): Stuk[] => {
  const bedragen = tip.bedragen ?? [];
  const stukken: Stuk[] = [];
  let vanaf = 0;

  for (const treffer of tip.tekst.matchAll(/\{(\d+)\}/g)) {
    const start = treffer.index;
    if (start > vanaf) {
      stukken.push({ soort: 'tekst', inhoud: tip.tekst.slice(vanaf, start) });
    }

    const bedrag = bedragen[Number(treffer[1])];
    stukken.push(
      bedrag === undefined
        ? { soort: 'tekst', inhoud: treffer[0] }
        : { soort: 'bedrag', inhoud: formatteerBedrag(bedrag, koersen) },
    );
    vanaf = start + treffer[0].length;
  }

  if (vanaf < tip.tekst.length) {
    stukken.push({ soort: 'tekst', inhoud: tip.tekst.slice(vanaf) });
  }
  return stukken;
};

/** Dezelfde tip als platte tekst, voor zoeken en voor delen. */
export const tekstVan = (tip: Tip, koersen: Koersen): string =>
  stukkenVan(tip, koersen)
    .map((s) => s.inhoud)
    .join('');
