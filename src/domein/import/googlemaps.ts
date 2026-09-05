import type { Coordinaat } from '@/domein/schema';

/**
 * Google Maps lijsten inlezen.
 *
 * Google biedt geen manier om een lijst rechtstreeks op te vragen, ook geen
 * gedeelde lijst van iemand anders. Wat er wel is, is de export via Google
 * Takeout, en die komt in twee vormen. De GeoJSON van een lijst is de fijne:
 * daar zitten coördinaten in. De CSV is de lastige: die heeft alleen een titel,
 * een notitie en een link, en de coördinaten moeten uit die link komen.
 *
 * Daarnaast kun je een lijst met namen plakken. Dat is geen mooie route, maar
 * het is wel de route die altijd werkt, ook als de export niet lukt. Punten
 * zonder coördinaten blijven gewoon bestaan en kun je met de hand op de kaart
 * zetten; ze worden nooit stilletjes weggegooid.
 */

/** Een punt zoals het uit een bestand komt, voordat er iets gematcht is. */
export interface RuwPunt {
  naam: string;
  coordinaten?: Coordinaat;
  adres?: string;
  notitie?: string;
  url?: string;
  lijst?: string;
}

const geldig = (lat: number, lon: number): boolean =>
  Number.isFinite(lat) &&
  Number.isFinite(lon) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lon) <= 180 &&
  // 0,0 is de nulmeridiaan in de Atlantische Oceaan en betekent in de praktijk
  // altijd "leeg veld", nooit een echte plek uit een reislijst.
  !(lat === 0 && lon === 0);

/**
 * Coördinaten uit een Google Maps link vissen.
 *
 * Google schrijft ze op vier manieren op, afhankelijk van hoe de link ontstaan
 * is. De volgorde hieronder is die van betrouwbaarheid: `!3d!4d` en `q=` wijzen
 * de plek zelf aan, terwijl `@` het midden van het kaartbeeld is en er dus
 * naast kan zitten. Een link met alleen een plaats-id levert niets op, en dat
 * is eerlijker dan gokken.
 */
export const coordinatenUitUrl = (url: string): Coordinaat | null => {
  const patronen = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /[?&](?:q|query|daddr)=(-?\d+\.\d+)%2C(-?\d+\.\d+)/i,
    /[?&](?:q|query|daddr)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/i,
    /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/i,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];
  for (const patroon of patronen) {
    const treffer = patroon.exec(url);
    if (!treffer) continue;
    const lat = Number(treffer[1]);
    const lon = Number(treffer[2]);
    if (geldig(lat, lon)) return { lat, lon };
  }
  return null;
};

/**
 * De GeoJSON die Takeout van een lijst maakt.
 *
 * Vorm: een FeatureCollection waarin elke feature een Point is met
 * `[lengtegraad, breedtegraad]` en de gegevens onder `properties.location`.
 * Let op de volgorde: GeoJSON zet de lengtegraad eerst, andersom dan hoe
 * iedereen coördinaten uitspreekt. Dat verwisselen zet Kyoto in de Stille
 * Oceaan, dus het staat hier expliciet.
 */
export const leesGoogleGeoJson = (tekst: string, lijst?: string): RuwPunt[] => {
  const data = JSON.parse(tekst) as {
    features?: {
      geometry?: { type?: string; coordinates?: number[] };
      properties?: {
        location?: { name?: string; address?: string; country_code?: string };
        google_maps_url?: string;
        Title?: string;
        comment?: string;
      };
    }[];
  };
  if (!Array.isArray(data.features)) throw new Error('Dit is geen GeoJSON met een features-lijst.');

  const punten: RuwPunt[] = [];
  for (const feature of data.features) {
    const eigenschappen = feature.properties ?? {};
    const plek = eigenschappen.location ?? {};
    const url = eigenschappen.google_maps_url;
    const naam = plek.name ?? eigenschappen.Title ?? plek.address;
    if (!naam) continue;

    let coordinaten: Coordinaat | undefined;
    const paar = feature.geometry?.coordinates;
    if (Array.isArray(paar) && paar.length >= 2 && geldig(paar[1], paar[0])) {
      coordinaten = { lat: paar[1], lon: paar[0] };
    } else if (url) {
      coordinaten = coordinatenUitUrl(url) ?? undefined;
    }

    punten.push({
      naam: naam.trim(),
      coordinaten,
      adres: plek.address,
      notitie: eigenschappen.comment,
      url,
      lijst,
    });
  }
  return punten;
};

/**
 * Een CSV uitpakken, inclusief velden met een komma of een regeleinde erin.
 *
 * Met de hand en niet met een bibliotheek, want het is twintig regels en het
 * scheelt een afhankelijkheid die met de app mee moet reizen. Twee
 * aanhalingstekens achter elkaar binnen een veld betekent één aanhalingsteken.
 */
export const leesCsvRijen = (tekst: string): string[][] => {
  const rijen: string[][] = [];
  let rij: string[] = [];
  let veld = '';
  let inAanhaling = false;

  // Een byte order mark aan het begin hoort bij het eerste veld te verdwijnen,
  // anders heet de eerste kolom niet "Title" maar iets onzichtbaars plus Title.
  const schoon = tekst.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

  for (let i = 0; i < schoon.length; i++) {
    const teken = schoon[i];
    if (inAanhaling) {
      if (teken === '"') {
        if (schoon[i + 1] === '"') {
          veld += '"';
          i++;
        } else inAanhaling = false;
      } else veld += teken;
      continue;
    }
    if (teken === '"') inAanhaling = true;
    else if (teken === ',') {
      rij.push(veld);
      veld = '';
    } else if (teken === '\n') {
      rij.push(veld);
      rijen.push(rij);
      rij = [];
      veld = '';
    } else veld += teken;
  }
  if (veld !== '' || rij.length > 0) {
    rij.push(veld);
    rijen.push(rij);
  }
  return rijen.filter((r) => r.some((v) => v.trim() !== ''));
};

/**
 * De CSV die Takeout van opgeslagen plaatsen en van lijsten maakt.
 *
 * Kolommen zijn meestal Title, Note en URL. De coördinaten zitten niet in het
 * bestand maar hooguit in de link, dus een deel van de punten komt hier zonder
 * plek uit. Dat is geen fout van de importer maar van het bestandsformaat, en
 * daarom blijven die punten staan met een naam en zonder pin.
 */
export const leesGoogleCsv = (tekst: string, lijst?: string): RuwPunt[] => {
  const rijen = leesCsvRijen(tekst);
  if (rijen.length === 0) return [];

  const koppen = rijen[0].map((k) => k.trim().toLowerCase());
  const kolom = (...namen: string[]): number =>
    koppen.findIndex((k) => namen.some((n) => k === n || k.includes(n)));

  const iNaam = kolom('title', 'naam', 'name');
  const iNotitie = kolom('note', 'comment', 'notitie');
  const iUrl = kolom('url', 'link');
  const iLat = kolom('latitude', 'lat');
  const iLon = kolom('longitude', 'lon', 'lng');

  // Zonder titelkolom is dit geen Takeout-bestand. Dan de eerste kolom als naam
  // nemen zou van een willekeurig bestand een lijst met onzin maken.
  if (iNaam === -1) throw new Error('Geen kolom "Title" gevonden; is dit een Takeout CSV?');

  const punten: RuwPunt[] = [];
  for (const rij of rijen.slice(1)) {
    const naam = (rij[iNaam] ?? '').trim();
    if (!naam) continue;
    const url = iUrl >= 0 ? (rij[iUrl] ?? '').trim() : undefined;

    let coordinaten: Coordinaat | undefined;
    if (iLat >= 0 && iLon >= 0) {
      const lat = Number(rij[iLat]);
      const lon = Number(rij[iLon]);
      if (geldig(lat, lon)) coordinaten = { lat, lon };
    }
    if (!coordinaten && url) coordinaten = coordinatenUitUrl(url) ?? undefined;

    punten.push({
      naam,
      coordinaten,
      notitie: iNotitie >= 0 ? (rij[iNotitie] ?? '').trim() || undefined : undefined,
      url: url || undefined,
      lijst,
    });
  }
  return punten;
};

/**
 * Een geplakte lijst met namen, één per regel.
 *
 * De uitwijkroute als de export niet lukt. Een regel mag ook coördinaten
 * bevatten, gescheiden door een puntkomma of een tab, zodat je een lijst die je
 * ergens vandaan hebt in één keer kwijt kunt:
 *
 *     Fushimi Inari; 34.9671; 135.7727
 *     Nishiki markt
 */
export const leesPlakLijst = (tekst: string, lijst?: string): RuwPunt[] => {
  const punten: RuwPunt[] = [];
  for (const regel of tekst.split('\n')) {
    const schoon = regel.trim().replace(/^[-*•]\s*/, '');
    if (!schoon) continue;

    const delen = schoon.split(/\s*[;\t]\s*/);
    const naam = delen[0].trim();
    if (!naam) continue;

    let coordinaten: Coordinaat | undefined;
    if (delen.length >= 3) {
      const lat = Number(delen[1].replace(',', '.'));
      const lon = Number(delen[2].replace(',', '.'));
      if (geldig(lat, lon)) coordinaten = { lat, lon };
    }
    // Staat er een link op de regel, dan mag die de coördinaten leveren.
    if (!coordinaten) {
      const link = /https?:\/\/\S+/.exec(schoon);
      if (link) coordinaten = coordinatenUitUrl(link[0]) ?? undefined;
    }

    punten.push({ naam: naam.replace(/https?:\/\/\S+/, '').trim() || naam, coordinaten, lijst });
  }
  return punten;
};

export type Bestandssoort = 'geojson' | 'csv' | 'tekst';

/** Raadt op de inhoud af wat voor bestand dit is, niet op de bestandsnaam. */
export const herkenSoort = (tekst: string): Bestandssoort => {
  const begin = tekst.replace(/^\uFEFF/, '').trimStart();
  if (begin.startsWith('{') || begin.startsWith('[')) return 'geojson';
  const eersteRegel = begin.split('\n')[0].toLowerCase();
  if (eersteRegel.includes(',') && /title|name|url/.test(eersteRegel)) return 'csv';
  return 'tekst';
};

/** Leest een bestand in de vorm die erin zit. */
export const leesBestand = (tekst: string, lijst?: string): RuwPunt[] => {
  switch (herkenSoort(tekst)) {
    case 'geojson':
      return leesGoogleGeoJson(tekst, lijst);
    case 'csv':
      return leesGoogleCsv(tekst, lijst);
    case 'tekst':
      return leesPlakLijst(tekst, lijst);
  }
};
