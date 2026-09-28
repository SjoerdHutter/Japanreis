import type { Segment, Spoorpunt } from '@/domein/sporen/spoor';

/**
 * Een GPX-bestand lezen met de XML-lezer van de browser.
 *
 * GPX is XML met een paar vaste namen: `trk` met `trkseg` en `trkpt` voor een
 * opgenomen route, `rte` met `rtept` voor een geplande. Welk voorvoegsel of
 * welke versie het bestand gebruikt maakt niet uit; er wordt alleen op de
 * lokale naam gezocht. Uitbreidingen van Garmin of Strava (hartslag, cadans)
 * worden overgeslagen.
 */

export interface GelezenSpoor {
  naam?: string;
  segmenten: Segment[];
}

export class GpxFout extends Error {}

const kinderen = (element: Element, naam: string): Element[] =>
  [...element.children].filter((k) => k.localName === naam);

const tekstVan = (element: Element, naam: string): string | undefined =>
  kinderen(element, naam)[0]?.textContent?.trim() || undefined;

const leesPunt = (element: Element): Spoorpunt | null => {
  const latTekst = element.getAttribute('lat');
  const lonTekst = element.getAttribute('lon');
  if (latTekst === null || lonTekst === null) return null;
  const lat = Number(latTekst);
  const lon = Number(lonTekst);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)
    return null;
  const punt: Spoorpunt = { lat, lon };
  const eleTekst = tekstVan(element, 'ele');
  if (eleTekst !== undefined && Number.isFinite(Number(eleTekst))) punt.ele = Number(eleTekst);
  const tijd = Date.parse(tekstVan(element, 'time') ?? '');
  if (Number.isFinite(tijd)) punt.tijd = tijd;
  return punt;
};

const alle = (bron: Document | Element, naam: string): Element[] => [
  ...bron.getElementsByTagNameNS('*', naam),
];

export const leesGpx = (tekst: string): GelezenSpoor[] => {
  const document = new DOMParser().parseFromString(tekst, 'application/xml');
  if (document.getElementsByTagName('parsererror').length > 0) {
    throw new GpxFout(
      'Dit bestand is geen leesbare GPX. Is het misschien iets anders dan een .gpx?',
    );
  }
  if (document.documentElement.localName !== 'gpx') {
    throw new GpxFout('Dit is XML, maar geen GPX.');
  }

  const sporen: GelezenSpoor[] = alle(document, 'trk').map((trk) => ({
    naam: tekstVan(trk, 'name'),
    segmenten: kinderen(trk, 'trkseg').map((seg) =>
      kinderen(seg, 'trkpt')
        .map(leesPunt)
        .filter((p): p is Spoorpunt => p !== null),
    ),
  }));

  const routes: GelezenSpoor[] = alle(document, 'rte').map((rte) => ({
    naam: tekstVan(rte, 'name'),
    segmenten: [
      kinderen(rte, 'rtept')
        .map(leesPunt)
        .filter((p): p is Spoorpunt => p !== null),
    ],
  }));

  const bruikbaar = [...sporen, ...routes].filter(
    (s) => s.segmenten.reduce((n, seg) => n + seg.length, 0) >= 2,
  );
  if (bruikbaar.length === 0) {
    throw new GpxFout(
      alle(document, 'wpt').length > 0
        ? 'Dit bestand heeft alleen losse punten en geen route.'
        : 'Er staat geen route in dit bestand.',
    );
  }
  return bruikbaar;
};
