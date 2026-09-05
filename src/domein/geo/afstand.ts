import type { Coordinaat, Kaartgebied } from '@/domein/schema';

/** Straal van de aarde in kilometers. */
const AARDSTRAAL_KM = 6371;

const naarRadialen = (graden: number): number => (graden * Math.PI) / 180;

/**
 * Hemelsbrede afstand tussen twee punten in kilometers.
 *
 * De haversineformule. Op de schaal van een stad is dat ruim nauwkeurig genoeg,
 * en veel goedkoper dan een echte ellipsoïde berekening. Hij wordt gebruikt om
 * te bepalen in welke stad je je bevindt en om punten op looplafstand te
 * vinden, en beide vragen niet om centimeters.
 */
export const afstandKm = (a: Coordinaat, b: Coordinaat): number => {
  const dLat = naarRadialen(b.lat - a.lat);
  const dLon = naarRadialen(b.lon - a.lon);
  const lat1 = naarRadialen(a.lat);
  const lat2 = naarRadialen(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * AARDSTRAAL_KM * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** Ligt een punt binnen het rechthoekige kaartgebied van een stad? */
export const binnenGebied = (punt: Coordinaat, gebied: Kaartgebied): boolean =>
  punt.lat >= gebied.zuidwest.lat &&
  punt.lat <= gebied.noordoost.lat &&
  punt.lon >= gebied.zuidwest.lon &&
  punt.lon <= gebied.noordoost.lon;
