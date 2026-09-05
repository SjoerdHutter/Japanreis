import type { Coordinaat } from '@/domein/schema';
import { leesCsvRijen, coordinatenUitUrl } from './googlemaps';

/**
 * Een Instagram collectie inlezen.
 *
 * Belangrijk om vooraf te weten: de officiële export van Instagram
 * ("Download your information") bevat van opgeslagen berichten alleen een link
 * en een tijdstip. Geen bijschrift, geen locatie, geen tip. Dat is geen
 * tekortkoming van deze importer maar van het bestand; wie beweert die gegevens
 * er wel uit te halen, verzint ze.
 *
 * Daarom twee wegen:
 *
 * 1. De ruwe `saved_posts.json` uit de export. Die levert de links op, met de
 *    bron erbij, en verder niets. Zulke tips komen binnen als "nog invullen":
 *    je zet er later zelf de plek en de tip bij.
 * 2. Een eigen lijst waarin je de tips al hebt uitgeschreven, als CSV of als
 *    geplakte regels. Dat is de weg die de specificatie bedoelt met "een door
 *    de gebruiker aangeleverde collectie", en die levert meteen bruikbare
 *    punten op.
 *
 * Alles wat hier binnenkomt krijgt de markering ongeverifieerd. Reels noemen
 * geregeld zaken die inmiddels gesloten of betaald zijn, en dat verschil met de
 * redactionele content moet zichtbaar blijven.
 */

export interface InstagramTip {
  /** De plek waar de tip over gaat, zoals die in de collectie staat. */
  locatie: string;
  /** De tip zelf. Leeg als de export hem niet bevatte. */
  tip?: string;
  /** Van wie de tip komt: het account of de naam die je erbij zette. */
  bron?: string;
  /** Link terug naar de post. */
  url?: string;
  coordinaten?: Coordinaat;
  /** Wanneer je hem opsloeg, als ISO-datum. */
  opgeslagenOp?: string;
}

/** Haalt het account uit een berichtlink, als dat erin staat. */
const accountUitUrl = (url: string): string | undefined => {
  const treffer = /instagram\.com\/(?!p\/|reel\/|tv\/)([A-Za-z0-9._]+)/.exec(url);
  return treffer?.[1];
};

const alsDatum = (seconden: number): string | undefined => {
  if (!Number.isFinite(seconden) || seconden <= 0) return undefined;
  return new Date(seconden * 1000).toISOString().slice(0, 10);
};

/**
 * De `saved_posts.json` uit de officiële export.
 *
 * Vorm: `{ saved_saved_media: [{ title, string_map_data: { "Saved on": {
 * href, timestamp } } }] }`. De titel is het account dat de post plaatste, en
 * dat is het enige inhoudelijke dat erin zit.
 */
export const leesInstagramExport = (tekst: string): InstagramTip[] => {
  const data = JSON.parse(tekst) as {
    saved_saved_media?: {
      title?: string;
      string_map_data?: Record<string, { href?: string; timestamp?: number; value?: string }>;
    }[];
  };

  const posts = data.saved_saved_media;
  if (!Array.isArray(posts)) {
    throw new Error(
      'Dit lijkt niet op saved_posts.json uit de Instagram export; de lijst saved_saved_media ontbreekt.',
    );
  }

  const tips: InstagramTip[] = [];
  for (const post of posts) {
    const velden = post.string_map_data ?? {};
    // De sleutel heet meestal "Saved on", maar Instagram vertaalt hem mee met
    // de taal van het account. De enige met een href pakken is robuuster.
    const veld = Object.values(velden).find((v) => v.href) ?? Object.values(velden)[0];
    const url = veld?.href;
    const bron = post.title?.trim() || (url ? accountUitUrl(url) : undefined);

    // Zonder link en zonder bron is er niets om later mee terug te zoeken.
    if (!url && !bron) continue;

    tips.push({
      // De export kent geen plek, dus de bron is voorlopig de enige naam die
      // er is. Die vul je later aan bij het bewerken van het punt.
      locatie: bron ? `Tip van ${bron}` : 'Opgeslagen bericht',
      bron,
      url,
      coordinaten: url ? (coordinatenUitUrl(url) ?? undefined) : undefined,
      opgeslagenOp: veld?.timestamp ? alsDatum(veld.timestamp) : undefined,
    });
  }
  return tips;
};

/**
 * Een eigen collectie als CSV, met kolommen voor locatie, tip, bron en link.
 *
 * Kolomnamen mogen in het Nederlands of het Engels; er wordt op een deel van
 * de naam gematcht zodat "Locatie (plek)" ook werkt.
 */
export const leesInstagramCsv = (tekst: string): InstagramTip[] => {
  const rijen = leesCsvRijen(tekst);
  if (rijen.length === 0) return [];

  const koppen = rijen[0].map((k) => k.trim().toLowerCase());
  const kolom = (...namen: string[]): number =>
    koppen.findIndex((k) => namen.some((n) => k.includes(n)));

  const iLocatie = kolom('locatie', 'plek', 'location', 'place', 'naam', 'title');
  const iTip = kolom('tip', 'notitie', 'note', 'omschrijving', 'caption');
  const iBron = kolom('bron', 'account', 'source', 'van');
  const iUrl = kolom('url', 'link', 'post');
  const iLat = kolom('latitude', 'lat');
  const iLon = kolom('longitude', 'lon', 'lng');

  if (iLocatie === -1) {
    throw new Error('Geen kolom voor de locatie gevonden; noem er een "locatie" of "plek".');
  }

  const tips: InstagramTip[] = [];
  for (const rij of rijen.slice(1)) {
    const locatie = (rij[iLocatie] ?? '').trim();
    if (!locatie) continue;
    const url = iUrl >= 0 ? (rij[iUrl] ?? '').trim() : undefined;

    let coordinaten: Coordinaat | undefined;
    if (iLat >= 0 && iLon >= 0) {
      const lat = Number(rij[iLat]);
      const lon = Number(rij[iLon]);
      if (Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0)) {
        coordinaten = { lat, lon };
      }
    }

    tips.push({
      locatie,
      tip: iTip >= 0 ? (rij[iTip] ?? '').trim() || undefined : undefined,
      bron: iBron >= 0 ? (rij[iBron] ?? '').trim() || undefined : undefined,
      url: url || undefined,
      coordinaten,
    });
  }
  return tips;
};

/**
 * Geplakte regels, in de vorm `plek | tip | bron | link`.
 *
 * De verticale streep als scheiding en niet de komma, want in een tip staat
 * bijna altijd een komma en in een plaatsnaam vaak ook. Alleen de plek is
 * verplicht; de rest mag je weglaten.
 */
export const leesInstagramPlak = (tekst: string): InstagramTip[] => {
  const tips: InstagramTip[] = [];
  for (const regel of tekst.split('\n')) {
    const schoon = regel.trim().replace(/^[-*•]\s*/, '');
    if (!schoon) continue;

    const delen = schoon.split('|').map((d) => d.trim());
    const locatie = delen[0];
    if (!locatie) continue;

    const link = delen.find((d) => /^https?:\/\//.test(d));
    const rest = delen.slice(1).filter((d) => d !== link);

    tips.push({
      locatie,
      tip: rest[0] || undefined,
      bron: rest[1] || undefined,
      url: link,
      coordinaten: link ? (coordinatenUitUrl(link) ?? undefined) : undefined,
    });
  }
  return tips;
};

export type InstagramSoort = 'export' | 'csv' | 'tekst';

export const herkenInstagramSoort = (tekst: string): InstagramSoort => {
  const begin = tekst.replace(/^\uFEFF/, '').trimStart();
  if (begin.startsWith('{') || begin.startsWith('[')) return 'export';
  const eersteRegel = begin.split('\n')[0].toLowerCase();
  if (eersteRegel.includes(',') && /locatie|plek|location|place|tip|url/.test(eersteRegel)) {
    return 'csv';
  }
  return 'tekst';
};

export const leesInstagram = (tekst: string): InstagramTip[] => {
  switch (herkenInstagramSoort(tekst)) {
    case 'export':
      return leesInstagramExport(tekst);
    case 'csv':
      return leesInstagramCsv(tekst);
    case 'tekst':
      return leesInstagramPlak(tekst);
  }
};
