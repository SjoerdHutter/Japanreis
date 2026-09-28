import type { Kaartlagen, Laagpunt } from '@/domein/schema';
import { afstandKm } from '@/domein/geo/afstand';

/**
 * Van een Overpass-antwoord naar de drie lagen: geld, kluisjes en toiletten.
 *
 * Draait alleen in het script (scripts/kaartlagen.ts), nooit in de browser;
 * het staat hier zodat het te testen is.
 *
 * Over de geldautomaten in Japan. Een buitenlandse pas werkt vrijwel alleen bij
 * Seven Bank (in elke 7-Eleven) en Japan Post (in elk postkantoor). In
 * OpenStreetMap staat de automaat zelf lang niet altijd los ingetekend, de
 * winkel en het postkantoor wel. Daarom tellen die ook mee, tenzij er al een
 * automaat binnen dertig meter staat.
 */

export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** Hoe groot één bestand mag worden. */
export const MAX_BYTES = 300 * 1024;

const JAPANSE_BANK = /seven ?bank|セブン銀行|japan post|ゆうちょ|jp ?bank|日本郵便/i;
const ZEVEN_ELF = /7-?eleven|セブン-?イレブン/i;

const plek = (e: OsmElement): { lat: number; lon: number } | null => {
  const lat = e.lat ?? e.center?.lat;
  const lon = e.lon ?? e.center?.lon;
  return lat === undefined || lon === undefined ? null : { lat, lon };
};

const rond = (n: number) => Math.round(n * 1e5) / 1e5;

const tekst = (tags: Record<string, string>, ...sleutels: string[]): string => {
  for (const sleutel of sleutels) {
    const waarde = tags[sleutel]?.trim();
    if (waarde) return waarde;
  }
  return '';
};

/** Een punt als kort lijstje; lege velden achteraan vallen weg. */
export const alsPunt = (
  p: { lat: number; lon: number },
  naam: string,
  uitbater: string,
  uren: string,
): Laagpunt => {
  const velden = [naam, uitbater, uren];
  while (velden.length > 0 && velden[velden.length - 1] === '') velden.pop();
  return [rond(p.lat), rond(p.lon), ...velden];
};

const isAutomaat = (tags: Record<string, string>) =>
  tags.amenity === 'atm' || (tags.amenity === 'bank' && tags.atm === 'yes');

const GEEN_BAGAGE = new Set(['parcel', 'parcel_pickup', 'parcel_delivery', 'mail', 'bicycle']);

export const verwerk = (
  elementen: OsmElement[],
  land: 'japan' | 'vietnam',
): Pick<Kaartlagen, 'geld' | 'kluisjes' | 'toiletten'> => {
  const automaten: { p: { lat: number; lon: number }; tags: Record<string, string> }[] = [];
  const vervangers: { p: { lat: number; lon: number }; tags: Record<string, string> }[] = [];
  const kluisjes: Laagpunt[] = [];
  const toiletten: Laagpunt[] = [];

  for (const e of elementen) {
    const tags = e.tags ?? {};
    const p = plek(e);
    if (!p) continue;

    if (isAutomaat(tags)) {
      const wie = `${tags.operator ?? ''} ${tags.brand ?? ''} ${tags.name ?? ''} ${tags['operator:en'] ?? ''}`;
      if (land === 'vietnam' || JAPANSE_BANK.test(wie)) automaten.push({ p, tags });
    } else if (land === 'japan' && tags.shop === 'convenience') {
      const merk = `${tags.brand ?? ''} ${tags['brand:en'] ?? ''} ${tags.name ?? ''}`;
      if (ZEVEN_ELF.test(merk)) vervangers.push({ p, tags });
    } else if (land === 'japan' && tags.amenity === 'post_office') {
      vervangers.push({ p, tags });
    } else if (tags.amenity === 'locker') {
      if (!GEEN_BAGAGE.has(tags.locker ?? '') && !GEEN_BAGAGE.has(tags['locker:type'] ?? '')) {
        kluisjes.push(
          alsPunt(
            p,
            tekst(tags, 'name:en', 'name'),
            tekst(tags, 'operator:en', 'operator'),
            tekst(tags, 'opening_hours'),
          ),
        );
      }
    } else if (tags.amenity === 'toilets') {
      if (tags.access !== 'private' && tags.access !== 'no') {
        toiletten.push(
          alsPunt(
            p,
            tekst(tags, 'name:en', 'name'),
            tekst(tags, 'operator:en', 'operator'),
            tekst(tags, 'opening_hours'),
          ),
        );
      }
    }
  }

  const geld: Laagpunt[] = automaten.map(({ p, tags }) =>
    alsPunt(
      p,
      tekst(tags, 'name:en', 'name', 'brand:en', 'brand'),
      tekst(tags, 'operator:en', 'operator'),
      tekst(tags, 'opening_hours'),
    ),
  );
  for (const { p, tags } of vervangers) {
    const alBekend = automaten.some((a) => afstandKm(a.p, p) < 0.03);
    if (alBekend) continue;
    const postkantoor = tags.amenity === 'post_office';
    geld.push(
      alsPunt(
        p,
        postkantoor
          ? `Postkantoor ${tekst(tags, 'name:en', 'name')}`.trim()
          : tekst(tags, 'name:en', 'name', 'brand:en', 'brand') || '7-Eleven',
        postkantoor ? 'Japan Post (ゆうちょ銀行)' : 'Seven Bank (セブン銀行)',
        tekst(tags, 'opening_hours'),
      ),
    );
  }

  return { geld, kluisjes, toiletten };
};

/**
 * Houdt het bestand onder de grens door in stappen weg te laten wat het minst
 * uitmaakt: eerst de namen en uitbaters van toiletten en kluisjes, dan hun
 * openingstijden. Geeft null als het ook dan niet past.
 */
export const pasInGrens = (lagen: Kaartlagen, max = MAX_BYTES): Kaartlagen | null => {
  const grootte = (l: Kaartlagen) => new TextEncoder().encode(JSON.stringify(l)).length;
  if (grootte(lagen) <= max) return lagen;
  const zonderNaam = (lijst: Laagpunt[]): Laagpunt[] =>
    lijst.map(([lat, lon, , , uren]) => (uren ? [lat, lon, '', '', uren] : [lat, lon]));
  const stap1 = {
    ...lagen,
    kluisjes: zonderNaam(lagen.kluisjes),
    toiletten: zonderNaam(lagen.toiletten),
  };
  if (grootte(stap1) <= max) return stap1;
  const kaal = (lijst: Laagpunt[]): Laagpunt[] => lijst.map(([lat, lon]) => [lat, lon]);
  const stap2 = { ...stap1, kluisjes: kaal(stap1.kluisjes), toiletten: kaal(stap1.toiletten) };
  return grootte(stap2) <= max ? stap2 : null;
};

/** De Overpass-vraag voor een rechthoek: zuid, west, noord, oost. */
export const overpassVraag = (
  gebied: { zuid: number; west: number; noord: number; oost: number },
  land: 'japan' | 'vietnam',
): string => {
  const b = `(${gebied.zuid},${gebied.west},${gebied.noord},${gebied.oost})`;
  const japans =
    land === 'japan'
      ? `node["shop"="convenience"]${b};way["shop"="convenience"]${b};node["amenity"="post_office"]${b};way["amenity"="post_office"]${b};`
      : '';
  return `[out:json][timeout:180];(node["amenity"="atm"]${b};node["amenity"="bank"]["atm"="yes"]${b};way["amenity"="bank"]["atm"="yes"]${b};${japans}node["amenity"="locker"]${b};way["amenity"="locker"]${b};node["amenity"="toilets"]${b};way["amenity"="toilets"]${b};);out center tags;`;
};
