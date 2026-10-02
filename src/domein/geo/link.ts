import type { Plaats } from '@/domein/schema';

/**
 * Een link naar Google Maps voor een plek.
 *
 * Met een pin gaat de link naar die coördinaten; dat is het preciest. Zonder
 * pin zoekt Google Maps op de naam en het adres, het liefst in lokaal schrift,
 * want daarop vindt het een Vietnamese of Japanse zaak het best.
 */
export const mapsLink = (
  plaats: Pick<Plaats, 'coordinaten' | 'naam' | 'naamLokaal' | 'adres' | 'adresLokaal'>,
): string => {
  const query = plaats.coordinaten
    ? `${plaats.coordinaten.lat},${plaats.coordinaten.lon}`
    : [plaats.naamLokaal ?? plaats.naam, plaats.adresLokaal ?? plaats.adres]
        .filter(Boolean)
        .join(', ');
  return `https://www.google.com/maps/search/?api=1&${new URLSearchParams({ query })}`;
};
