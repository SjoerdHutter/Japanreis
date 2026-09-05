/**
 * Alles wat zowel de app als de buildconfiguratie over de kaart moet weten.
 *
 * De naam van de tegelcache staat hier omdat twee partijen hem gebruiken: de
 * service worker die tegels bewaart die je onderweg tegenkomt, en de knop "stad
 * offline opslaan" die ze vooraf ophaalt. Zouden die twee elk hun eigen cache
 * hebben, dan zou de app offline de helft van de tegels niet vinden terwijl ze
 * wel op het toestel staan.
 */

export const TEGEL_CACHE = 'kaarttegels';

/** De tegelserver. Eén plek, zodat een andere aanbieder één regel werk is. */
export const TEGEL_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Verplichte bronvermelding bij OpenStreetMap tegels. */
export const TEGEL_BRONVERMELDING =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/**
 * Zoomniveaus die de offline download meeneemt. Onder de 12 zie je alleen de
 * omtrek van de stad, boven de 16 gaat het aantal tegels door het dak: elk
 * niveau erbij is vier keer zoveel werk.
 */
export const OFFLINE_ZOOM_MIN = 12;
export const OFFLINE_ZOOM_MAX = 16;

/**
 * Bovengrens aan wat één stad mag downloaden. OpenStreetMap draait op giften en
 * hun gebruiksvoorwaarden staan geen massale downloads toe. Een stadscentrum
 * blijft hier ruim onder; wie een provincie intekent loopt tegen deze grens aan
 * en krijgt dat te zien in plaats van dat de app stilletjes de kaart leegtrekt.
 */
export const OFFLINE_MAX_TEGELS = 4000;
