import type { Coordinaat, Kaartgebied } from '@/domein/schema';

/**
 * Het rechthoekje waar alle punten in passen.
 *
 * De fotokaart begint niet bij een stad maar bij de hele reis, dus het beeld
 * moet zich naar de foto's voegen in plaats van andersom. Met een rand eromheen,
 * anders plakken de buitenste foto's tegen de rand van het scherm.
 */
const RAND_GRADEN = 0.02;

export const omhullendGebied = (punten: Coordinaat[], terugval: Kaartgebied): Kaartgebied => {
  if (punten.length === 0) return terugval;

  let minLat = punten[0].lat;
  let maxLat = punten[0].lat;
  let minLon = punten[0].lon;
  let maxLon = punten[0].lon;

  for (const punt of punten) {
    if (punt.lat < minLat) minLat = punt.lat;
    if (punt.lat > maxLat) maxLat = punt.lat;
    if (punt.lon < minLon) minLon = punt.lon;
    if (punt.lon > maxLon) maxLon = punt.lon;
  }

  return {
    zuidwest: { lat: minLat - RAND_GRADEN, lon: minLon - RAND_GRADEN },
    noordoost: { lat: maxLat + RAND_GRADEN, lon: maxLon + RAND_GRADEN },
  };
};
