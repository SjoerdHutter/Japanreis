/**
 * Een seintje als er iets in de opslag verandert.
 *
 * Mijn gegevens staat op meer plekken dan één scherm: het hoofdmenu zegt wat
 * er nog ontbreekt, het noodscherm toont je verzekering, de reisdagen tonen je
 * verblijf. Vul je iets in op het ene scherm, dan hoort het andere dat te zien
 * zonder dat je de app opnieuw opent. Een gewone EventTarget is daarvoor genoeg.
 */

export type Onderwerp =
  'gegevens' | 'bijlagen' | 'reserveringen' | 'controles' | 'overschrijvingen' | 'sporen';

const doel = new EventTarget();

export const meldWijziging = (...onderwerpen: Onderwerp[]): void => {
  for (const onderwerp of onderwerpen) doel.dispatchEvent(new Event(onderwerp));
};

export const opWijziging = (onderwerpen: Onderwerp[], doe: () => void): (() => void) => {
  for (const onderwerp of onderwerpen) doel.addEventListener(onderwerp, doe);
  return () => {
    for (const onderwerp of onderwerpen) doel.removeEventListener(onderwerp, doe);
  };
};
