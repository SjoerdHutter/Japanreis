import type { Kaartgebied } from '@/domein/schema';
import {
  OFFLINE_MAX_TEGELS,
  OFFLINE_ZOOM_MAX,
  OFFLINE_ZOOM_MIN,
  TEGEL_CACHE,
  TEGEL_URL,
} from './constanten';

/**
 * Kaarttegels vooraf ophalen, zodat een stad ook zonder bereik een kaart heeft.
 *
 * Dit is het enige deel van de content dat niet met de app meereist: tegels zijn
 * te groot om in te bakken. Ze gaan in dezelfde Cache Storage als de tegels die
 * de service worker onderweg bewaart, zodat de kaart offline niet half gevuld
 * is met een gat waar je net niet gekeken had.
 *
 * OpenStreetMap draait op giften en staat massale downloads niet toe. Daarom
 * drie remmen: een klein gebied per stad, een bovengrens aan het aantal tegels,
 * en hooguit een handvol verzoeken tegelijk.
 */

const naarTegelX = (lon: number, zoom: number): number =>
  Math.floor(((lon + 180) / 360) * 2 ** zoom);

const naarTegelY = (lat: number, zoom: number): number => {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom);
};

export interface Tegel {
  z: number;
  x: number;
  y: number;
}

/** Alle tegels die binnen dit gebied vallen, over de gekozen zoomniveaus. */
export const tegelsVoorGebied = (
  gebied: Kaartgebied,
  zoomMin = OFFLINE_ZOOM_MIN,
  zoomMax = OFFLINE_ZOOM_MAX,
): Tegel[] => {
  const tegels: Tegel[] = [];
  for (let z = zoomMin; z <= zoomMax; z++) {
    const xVan = naarTegelX(gebied.zuidwest.lon, z);
    const xTot = naarTegelX(gebied.noordoost.lon, z);
    // De y-as loopt van noord naar zuid, dus het noordoosten geeft de laagste y.
    const yVan = naarTegelY(gebied.noordoost.lat, z);
    const yTot = naarTegelY(gebied.zuidwest.lat, z);
    for (let x = Math.min(xVan, xTot); x <= Math.max(xVan, xTot); x++) {
      for (let y = Math.min(yVan, yTot); y <= Math.max(yVan, yTot); y++) {
        tegels.push({ z, x, y });
      }
    }
  }
  return tegels;
};

export const tegelUrl = ({ z, x, y }: Tegel): string =>
  TEGEL_URL.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));

export interface Voortgang {
  klaar: number;
  totaal: number;
  /** Tegels die al in de cache stonden en dus niet opnieuw zijn opgehaald. */
  overgeslagen: number;
  mislukt: number;
}

export interface DownloadResultaat extends Voortgang {
  /** Gestopt omdat de gebruiker het afbrak. */
  afgebroken: boolean;
}

/** Hoeveel verzoeken tegelijk. Vier is vlot genoeg en blijft netjes. */
const TEGELIJK = 4;

/**
 * Haalt de tegels van een gebied op. Meldt tussentijds de voortgang, kan
 * afgebroken worden, en slaat over wat al in de cache staat, zodat een tweede
 * poging na een verbroken verbinding niet weer van voren af aan begint.
 */
export const slaGebiedOp = async (
  gebied: Kaartgebied,
  opties: {
    signaal?: AbortSignal;
    opVoortgang?: (voortgang: Voortgang) => void;
  } = {},
): Promise<DownloadResultaat> => {
  const tegels = tegelsVoorGebied(gebied);
  if (tegels.length > OFFLINE_MAX_TEGELS) {
    throw new Error(
      `Dit gebied vraagt ${tegels.length} tegels en dat is meer dan de grens van ${OFFLINE_MAX_TEGELS}. Maak het kaartgebied van deze stad kleiner.`,
    );
  }

  const cache = await caches.open(TEGEL_CACHE);
  const voortgang: Voortgang = { klaar: 0, totaal: tegels.length, overgeslagen: 0, mislukt: 0 };

  let volgende = 0;
  let afgebroken = false;

  const werker = async (): Promise<void> => {
    while (volgende < tegels.length) {
      if (opties.signaal?.aborted) {
        afgebroken = true;
        return;
      }
      const url = tegelUrl(tegels[volgende++]);
      try {
        if (await cache.match(url)) {
          voortgang.overgeslagen++;
        } else {
          const antwoord = await fetch(url, { signal: opties.signaal });
          if (antwoord.ok) await cache.put(url, antwoord.clone());
          else voortgang.mislukt++;
        }
      } catch {
        if (opties.signaal?.aborted) {
          afgebroken = true;
          return;
        }
        voortgang.mislukt++;
      }
      voortgang.klaar++;
      opties.opVoortgang?.({ ...voortgang });
    }
  };

  await Promise.all(Array.from({ length: TEGELIJK }, werker));
  return { ...voortgang, afgebroken };
};

/** Gooit de tegels van één gebied weg, om ruimte vrij te maken. */
export const wisGebied = async (gebied: Kaartgebied): Promise<number> => {
  const cache = await caches.open(TEGEL_CACHE);
  const urls = new Set(tegelsVoorGebied(gebied).map(tegelUrl));
  let gewist = 0;
  for (const verzoek of await cache.keys()) {
    if (urls.has(verzoek.url) && (await cache.delete(verzoek))) gewist++;
  }
  return gewist;
};

/** Hoeveel tegels van dit gebied staan er al op het toestel? */
export const tegelsAanwezig = async (gebied: Kaartgebied): Promise<number> => {
  try {
    const cache = await caches.open(TEGEL_CACHE);
    const tegels = tegelsVoorGebied(gebied);
    let aanwezig = 0;
    for (const tegel of tegels) {
      if (await cache.match(tegelUrl(tegel))) aanwezig++;
    }
    return aanwezig;
  } catch {
    return 0;
  }
};
