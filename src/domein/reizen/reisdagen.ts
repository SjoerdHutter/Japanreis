import type { Reisdag, Reisstap } from '@/domein/schema';

/**
 * De reisdagen: welke vandaag aan de beurt is, en hoe je er de route van
 * opent.
 *
 * Vandaag en morgen, omdat je een reisdag de avond ervoor wil zien. Dan pak je
 * in, zet je de wekker, en controleer je of de trein gereserveerd is; op de
 * ochtend zelf is dat te laat. Allebei als ze er allebei zijn: de avond na
 * Universal Studios gaat het om de trein naar Hiroshima van de volgende dag,
 * niet meer om die naar het park.
 */

const DAG_MS = 86_400_000;

const volgendeDag = (datum: string): string =>
  new Date(Date.parse(`${datum}T00:00:00Z`) + DAG_MS).toISOString().slice(0, 10);

export interface ReisdagRondom {
  reisdag: Reisdag;
  wanneer: 'vandaag' | 'morgen';
}

/** De reisdagen van vandaag en morgen, in die volgorde. Leeg als er geen zijn. */
export const reisdagenRondom = (reisdagen: Reisdag[], vandaag: string): ReisdagRondom[] => {
  const morgen = volgendeDag(vandaag);
  return [
    ...reisdagen
      .filter((r) => r.datum === vandaag)
      .map((reisdag) => ({ reisdag, wanneer: 'vandaag' as const })),
    ...reisdagen
      .filter((r) => r.datum === morgen)
      .map((reisdag) => ({ reisdag, wanneer: 'morgen' as const })),
  ];
};

/** De stappen die je werkelijk neemt, zonder de alternatieven. */
export const hoofdroute = (reisdag: Reisdag): Reisstap[] =>
  reisdag.stappen.filter((s) => !s.alternatief);

/** De andere manieren om hetzelfde te doen. */
export const alternatieven = (reisdag: Reisdag): Reisstap[] =>
  reisdag.stappen.filter((s) => s.alternatief);

/** De tijd in de trein of bus langs de hoofdroute, zonder de overstappen. */
export const reistijd = (reisdag: Reisdag): number =>
  hoofdroute(reisdag).reduce((totaal, stap) => totaal + stap.minuten, 0);

/** Of je voor de hoofdroute iets moet reserveren, verplicht of aanbevolen. */
export const reserveringNodig = (reisdag: Reisdag): 'verplicht' | 'aanbevolen' | null => {
  const route = hoofdroute(reisdag);
  if (route.some((s) => s.reserveren === 'verplicht')) return 'verplicht';
  if (route.some((s) => s.reserveren === 'aanbevolen')) return 'aanbevolen';
  return null;
};

/**
 * De route in Google Maps, met het openbaar vervoer.
 *
 * Alleen bruikbaar met bereik, maar dan ook meteen de actuele vertrektijden en
 * het perron, en die kan de app offline niet weten. Een gewone link en geen
 * app-specifieke: die opent de Google Maps app als hij er is, en anders de
 * website.
 */
export const routeLink = (stap: Pick<Reisstap, 'van' | 'naar'>): string => {
  const parameters = new URLSearchParams({
    api: '1',
    origin: stap.van,
    destination: stap.naar,
    travelmode: 'transit',
  });
  return `https://www.google.com/maps/dir/?${parameters.toString()}`;
};

/** Een plek in Google Maps, voor als je een station wil opzoeken. */
export const zoekLink = (naam: string): string =>
  `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: naam }).toString()}`;
