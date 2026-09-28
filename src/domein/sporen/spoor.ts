import type { Coordinaat, Stad } from '@/domein/schema';
import { afstandKm } from '@/domein/geo/afstand';
import { datumIn } from '@/domein/tijd/zones';

/**
 * Een gelopen of gefietste route uit een GPX-bestand.
 *
 * Een horloge of een app als Strava schrijft elke seconde een punt, en een
 * dag door Kyoto is dan twintigduizend punten. Die gaan er bij het inlezen
 * één keer doorheen voor de cijfers: afstand, klimmen, tijd in beweging. Wat
 * er daarna bewaard wordt is een vereenvoudigde lijn die op een paar meter na
 * hetzelfde loopt, klein genoeg voor de kaart, de backup en het reisverslag.
 */

export interface Spoorpunt {
  lat: number;
  lon: number;
  /** Hoogte in meters, als het toestel die schreef. */
  ele?: number;
  /** Het moment in milliseconden sinds 1970. */
  tijd?: number;
}

/** Een doorlopend stuk; tussen twee stukken stond de opname stil. */
export type Segment = Spoorpunt[];

/** Een punt zoals het bewaard wordt: [breedte, lengte]. */
export type Lijnpunt = [number, number];

export interface Spoorstatistiek {
  afstandM: number;
  stijgingM?: number;
  dalingM?: number;
  /** Van het eerste tot het laatste punt met een tijd. */
  duurS?: number;
  /** Alleen de tijd waarin je echt bewoog. */
  bewegingS?: number;
  begin?: string;
  eind?: string;
  punten: number;
}

const meterTussen = (a: Spoorpunt, b: Spoorpunt): number => afstandKm(a, b) * 1000;

/** De afstand langs de lijn, per stuk opgeteld; de sprong tussen twee stukken telt niet. */
export const afstandM = (segmenten: Segment[]): number =>
  segmenten.reduce((totaal, segment) => {
    let som = 0;
    for (let i = 1; i < segment.length; i++) som += meterTussen(segment[i - 1], segment[i]);
    return totaal + som;
  }, 0);

/**
 * Klimmen en dalen, met een drempel tegen ruis.
 *
 * GPS-hoogte schommelt een paar meter heen en weer terwijl je op een vlakke
 * kade loopt. Elk schommeltje optellen geeft honderden meters klimmen op een
 * vlakke dag. Pas als de hoogte `drempel` meter van het laatste ijkpunt
 * afwijkt telt het verschil mee, en wordt dat het nieuwe ijkpunt.
 */
export const hoogteverschil = (
  segmenten: Segment[],
  drempel = 3,
): { stijgingM: number; dalingM: number } | undefined => {
  let stijging = 0;
  let daling = 0;
  let gezien = false;
  for (const segment of segmenten) {
    let ijk: number | undefined;
    for (const punt of segment) {
      if (punt.ele === undefined) continue;
      gezien = true;
      if (ijk === undefined) {
        ijk = punt.ele;
        continue;
      }
      const verschil = punt.ele - ijk;
      if (verschil >= drempel) {
        stijging += verschil;
        ijk = punt.ele;
      } else if (verschil <= -drempel) {
        daling -= verschil;
        ijk = punt.ele;
      }
    }
  }
  return gezien ? { stijgingM: Math.round(stijging), dalingM: Math.round(daling) } : undefined;
};

/**
 * De tijd waarin je bewoog. Stukjes langzamer dan `minSnelheid` (stilstaan
 * voor een stoplicht, een tempel van binnen) tellen niet, net als een gat
 * langer dan `maxGat` seconden: dan stond de opname uit of was er geen signaal.
 */
export const bewegingstijdS = (
  segmenten: Segment[],
  { minSnelheid = 0.3, maxGat = 300 }: { minSnelheid?: number; maxGat?: number } = {},
): number | undefined => {
  let som = 0;
  let gezien = false;
  for (const segment of segmenten) {
    for (let i = 1; i < segment.length; i++) {
      const a = segment[i - 1];
      const b = segment[i];
      if (a.tijd === undefined || b.tijd === undefined) continue;
      gezien = true;
      const dt = (b.tijd - a.tijd) / 1000;
      if (dt <= 0 || dt > maxGat) continue;
      if (meterTussen(a, b) / dt >= minSnelheid) som += dt;
    }
  }
  return gezien ? Math.round(som) : undefined;
};

/**
 * Douglas-Peucker: laat punten weg die minder dan `toleranceM` meter van de
 * lijn tussen hun buren liggen. Zonder recursie, zodat twintigduizend punten
 * de stapel niet laten overlopen.
 */
export const vereenvoudig = (punten: readonly Coordinaat[], toleranceM = 5): Lijnpunt[] => {
  if (punten.length <= 2) return punten.map((p) => [p.lat, p.lon]);

  // Plat vlak in meters rond het eerste punt. Op de schaal van een dagwandeling
  // is het verschil met de bol verwaarloosbaar.
  const lat0 = (punten[0].lat * Math.PI) / 180;
  const mPerGraadLat = 111_320;
  const mPerGraadLon = 111_320 * Math.cos(lat0);
  const x = punten.map((p) => (p.lon - punten[0].lon) * mPerGraadLon);
  const y = punten.map((p) => (p.lat - punten[0].lat) * mPerGraadLat);

  const houden = new Uint8Array(punten.length);
  houden[0] = 1;
  houden[punten.length - 1] = 1;
  const stapel: [number, number][] = [[0, punten.length - 1]];

  while (stapel.length > 0) {
    const [van, tot] = stapel.pop()!;
    const dx = x[tot] - x[van];
    const dy = y[tot] - y[van];
    const lengte2 = dx * dx + dy * dy;
    let verste = -1;
    let grootste = 0;
    for (let i = van + 1; i < tot; i++) {
      let afstand: number;
      if (lengte2 === 0) {
        afstand = Math.hypot(x[i] - x[van], y[i] - y[van]);
      } else {
        const t = Math.max(0, Math.min(1, ((x[i] - x[van]) * dx + (y[i] - y[van]) * dy) / lengte2));
        afstand = Math.hypot(x[i] - (x[van] + t * dx), y[i] - (y[van] + t * dy));
      }
      if (afstand > grootste) {
        grootste = afstand;
        verste = i;
      }
    }
    if (verste !== -1 && grootste > toleranceM) {
      houden[verste] = 1;
      stapel.push([van, verste], [verste, tot]);
    }
  }

  const rond = (g: number) => Math.round(g * 1e5) / 1e5;
  return punten.filter((_, i) => houden[i]).map((p) => [rond(p.lat), rond(p.lon)]);
};

/**
 * Op welke reisdag dit spoor hoort: de datum van het eerste punt met een tijd,
 * in de tijdzone van de stad waar het begint. Een ochtendwandeling om zes uur
 * in Tokio is in Nederland nog de avond ervoor, en hoort toch bij de dag in
 * Tokio.
 */
export const dagVanSpoor = (segmenten: Segment[], steden: readonly Stad[]): string | undefined => {
  const eerste = segmenten.flat().find((p) => p.tijd !== undefined);
  if (!eerste || steden.length === 0) return undefined;
  const dichtstbij = [...steden].sort(
    (a, b) => afstandKm(eerste, a.centrum) - afstandKm(eerste, b.centrum),
  )[0];
  return datumIn(dichtstbij.tijdzone, new Date(eerste.tijd!));
};

/** Alles wat er bij het inlezen uit een spoor gehaald wordt. */
export const verwerkSpoor = (
  segmenten: Segment[],
  steden: readonly Stad[],
): { lijnen: Lijnpunt[][]; statistiek: Spoorstatistiek; datum?: string } => {
  const bruikbaar = segmenten.filter((s) => s.length > 0);
  const tijden = bruikbaar
    .flat()
    .map((p) => p.tijd)
    .filter((t): t is number => t !== undefined);
  const begin = tijden.length > 0 ? Math.min(...tijden) : undefined;
  const eind = tijden.length > 0 ? Math.max(...tijden) : undefined;
  const hoogte = hoogteverschil(bruikbaar);

  return {
    lijnen: bruikbaar.map((s) => vereenvoudig(s)),
    datum: dagVanSpoor(bruikbaar, steden),
    statistiek: {
      afstandM: Math.round(afstandM(bruikbaar)),
      ...(hoogte ?? {}),
      ...(begin !== undefined && eind !== undefined
        ? {
            duurS: Math.round((eind - begin) / 1000),
            begin: new Date(begin).toISOString(),
            eind: new Date(eind).toISOString(),
          }
        : {}),
      bewegingS: bewegingstijdS(bruikbaar),
      punten: bruikbaar.reduce((n, s) => n + s.length, 0),
    },
  };
};

/** 12,3 km of 850 m. */
export const alsAfstand = (meter: number): string =>
  meter < 1000
    ? `${Math.round(meter)} m`
    : `${(meter / 1000).toLocaleString('nl-NL', { maximumFractionDigits: 1 })} km`;

/** 3 u 20 min, of 45 min. */
export const alsDuur = (seconden: number): string => {
  const minuten = Math.round(seconden / 60);
  const uren = Math.floor(minuten / 60);
  const rest = minuten % 60;
  if (uren === 0) return `${rest} min`;
  return rest === 0 ? `${uren} u` : `${uren} u ${rest} min`;
};

/** De cijfers van een spoor in één regel. */
export const alsSamenvatting = (s: Spoorstatistiek): string =>
  [
    alsAfstand(s.afstandM),
    s.stijgingM !== undefined && s.stijgingM > 0 && `${s.stijgingM} m klimmen`,
    s.bewegingS !== undefined && s.bewegingS > 0 && `${alsDuur(s.bewegingS)} in beweging`,
  ]
    .filter(Boolean)
    .join(', ');

/**
 * De omtrek van een of meer sporen als klein SVG-plaatje, voor het reisverslag.
 * Geen kaart eronder: alleen de vorm van de dag, zoals je hem liep.
 */
export const alsSvg = (
  sporen: readonly { lijnen: Lijnpunt[][]; kleur: string }[],
  maat = 160,
): string => {
  const alle = sporen.flatMap((s) => s.lijnen.flat());
  if (alle.length < 2) return '';
  const lats = alle.map((p) => p[0]);
  const lons = alle.map((p) => p[1]);
  const midLat = ((Math.min(...lats) + Math.max(...lats)) / 2) * (Math.PI / 180);
  const schaalLon = Math.cos(midLat);
  const minX = Math.min(...lons) * schaalLon;
  const maxX = Math.max(...lons) * schaalLon;
  const minY = Math.min(...lats);
  const maxY = Math.max(...lats);
  const rand = 6;
  const bereik = Math.max(maxX - minX, maxY - minY) || 1e-6;
  const schaal = (maat - 2 * rand) / bereik;
  const breedte = Math.round((maxX - minX) * schaal + 2 * rand);
  const hoogte = Math.round((maxY - minY) * schaal + 2 * rand);
  const naarPunt = ([lat, lon]: Lijnpunt) =>
    `${((lon * schaalLon - minX) * schaal + rand).toFixed(1)},${((maxY - lat) * schaal + rand).toFixed(1)}`;

  const lijnen = sporen
    .flatMap((s) =>
      s.lijnen
        .filter((l) => l.length >= 2)
        .map(
          (l) =>
            `<polyline points="${l.map(naarPunt).join(' ')}" fill="none" stroke="${s.kleur}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`,
        ),
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${breedte} ${hoogte}" width="${breedte}" height="${hoogte}" role="img" aria-label="De route van deze dag">${lijnen}</svg>`;
};

/** De kleuren waar je uit kiest. Geen groenblauw: dat is de lijn van de foto's. */
export const SPOORKLEUREN = ['#dc2626', '#2563eb', '#9333ea', '#ea580c', '#16a34a', '#db2777'];
