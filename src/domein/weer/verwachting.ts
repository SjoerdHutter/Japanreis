import { z } from 'zod';
import type { Reisschema, Stad } from '@/domein/schema';
import { datumIn } from '@/domein/tijd/zones';
import { plusDagen } from '@/domein/tijd/datums';

/**
 * De weersverwachting per stad en per dag, van Open-Meteo.
 *
 * Open-Meteo werkt zonder sleutel en rekent de dagen in de tijdzone die je
 * meegeeft. Dat laatste doet ertoe: een dag in Kyoto loopt van middernacht
 * Japanse tijd, niet van middernacht thuis, en een bui om zes uur 's ochtends
 * hoort bij de dag waarop jij hem natte schoenen bezorgt.
 *
 * Verder dan zestien dagen vooruit geeft Open-Meteo niets, en dat is terecht:
 * een verwachting voor over drie weken is een gok die er als een feit uitziet.
 */

/** Hoeveel dagen vooruit er een verwachting is, vandaag meegerekend. */
export const HORIZON_DAGEN = 16;

/** Hoe lang een opgehaalde verwachting vers genoeg is. */
export const VERS_UREN = 3;

const getallen = z.array(z.number().nullable());

export const openMeteoSchema = z.object({
  timezone: z.string(),
  daily: z.object({
    time: z.array(z.iso.date()),
    temperature_2m_min: getallen,
    temperature_2m_max: getallen,
    precipitation_probability_max: getallen,
    precipitation_sum: getallen,
    wind_gusts_10m_max: getallen,
    weather_code: getallen,
  }),
});

export interface Dagweer {
  datum: string;
  min: number | null;
  max: number | null;
  /** Kans op neerslag in procenten, het hoogste uur van de dag. */
  regenkans: number | null;
  regenMm: number | null;
  /** Zwaarste windstoot in km/h. */
  windstoten: number | null;
  code: number | null;
}

export interface WeerVanStad {
  stadId: string;
  /** Wanneer dit is opgehaald, als ISO-moment. */
  opgehaaldOp: string;
  dagen: Dagweer[];
}

export const DAGELIJKSE_VELDEN = [
  'temperature_2m_min',
  'temperature_2m_max',
  'precipitation_probability_max',
  'precipitation_sum',
  'wind_gusts_10m_max',
  'weather_code',
] as const;

export const verwachtingUrl = (stad: Stad, van: string, tot: string): string => {
  const parameters = new URLSearchParams({
    latitude: String(stad.centrum.lat),
    longitude: String(stad.centrum.lon),
    daily: DAGELIJKSE_VELDEN.join(','),
    timezone: stad.tijdzone,
    start_date: van,
    end_date: tot,
  });
  return `https://api.open-meteo.com/v1/forecast?${parameters.toString()}`;
};

/** Leest het antwoord van Open-Meteo. Gooit bij iets onverwachts, zodat de oude verwachting blijft staan. */
export const leesVerwachting = (json: unknown): Dagweer[] => {
  const { daily } = openMeteoSchema.parse(json);
  return daily.time.map((datum, i) => ({
    datum,
    min: daily.temperature_2m_min[i] ?? null,
    max: daily.temperature_2m_max[i] ?? null,
    regenkans: daily.precipitation_probability_max[i] ?? null,
    regenMm: daily.precipitation_sum[i] ?? null,
    windstoten: daily.wind_gusts_10m_max[i] ?? null,
    code: daily.weather_code[i] ?? null,
  }));
};

/** Nieuwe dagen over de oude heen; wat al voorbij is blijft staan. */
export const voegDagenSamen = (oud: Dagweer[], nieuw: Dagweer[]): Dagweer[] => {
  const perDatum = new Map(oud.map((d) => [d.datum, d]));
  for (const dag of nieuw) perDatum.set(dag.datum, dag);
  return [...perDatum.values()].sort((a, b) => a.datum.localeCompare(b.datum));
};

/**
 * Welke steden er voor welke dagen opgehaald moeten worden: elke stad uit het
 * reisschema, voor de dagen dat je er bent en die binnen de horizon vallen.
 * "Vandaag" is vandaag in die stad, want in Japan is het al morgen terwijl het
 * thuis nog avond is.
 */
export const opTeHalen = (
  reisschema: Reisschema,
  steden: Stad[],
  nu: Date,
): { stad: Stad; van: string; tot: string }[] => {
  const perStad = new Map<string, { stad: Stad; van: string; tot: string }>();
  for (const segment of reisschema.segmenten) {
    const stad = steden.find((s) => s.id === segment.stad);
    if (!stad || !segment.van || !segment.tot) continue;
    const vandaag = datumIn(stad.tijdzone, nu);
    const grens = plusDagen(vandaag, HORIZON_DAGEN - 1);
    const van = segment.van > vandaag ? segment.van : vandaag;
    const tot = segment.tot < grens ? segment.tot : grens;
    if (van > tot) continue;
    const bestaand = perStad.get(stad.id);
    perStad.set(stad.id, {
      stad,
      van: bestaand && bestaand.van < van ? bestaand.van : van,
      tot: bestaand && bestaand.tot > tot ? bestaand.tot : tot,
    });
  }
  return [...perStad.values()];
};

export const isVers = (opgehaaldOp: string | undefined, nu: Date): boolean =>
  opgehaaldOp !== undefined && nu.getTime() - Date.parse(opgehaaldOp) < VERS_UREN * 3_600_000;

/** Of er voor deze datum al een verwachting kan bestaan. */
export const binnenHorizon = (datum: string, stad: Stad, nu: Date): boolean =>
  datum <= plusDagen(datumIn(stad.tijdzone, nu), HORIZON_DAGEN - 1);

/** Een regendag: minstens zestig procent kans, of minstens vijf millimeter. */
export const isRegendag = (dag: Dagweer | undefined): boolean =>
  dag !== undefined && ((dag.regenkans ?? 0) >= 60 || (dag.regenMm ?? 0) >= 5);

/** Wind om rekening mee te houden: vanaf 60 km/h hard, vanaf 90 km/h storm. */
export const windNiveau = (dag: Dagweer | undefined): 'hard' | 'storm' | null => {
  const stoten = dag?.windstoten ?? 0;
  if (stoten >= 90) return 'storm';
  if (stoten >= 60) return 'hard';
  return null;
};

export type Weersoort =
  'zon' | 'half' | 'bewolkt' | 'mist' | 'motregen' | 'regen' | 'sneeuw' | 'onweer';

/** De WMO-weercode van Open-Meteo, teruggebracht tot wat je aan een icoon ziet. */
export const weersoort = (code: number | null): Weersoort => {
  if (code === null || code <= 0) return 'zon';
  if (code <= 2) return 'half';
  if (code === 3) return 'bewolkt';
  if (code === 45 || code === 48) return 'mist';
  if (code >= 51 && code <= 57) return 'motregen';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'regen';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'sneeuw';
  if (code >= 95) return 'onweer';
  return 'bewolkt';
};

export const WEERSOORT_TEKST: Record<Weersoort, string> = {
  zon: 'zonnig',
  half: 'half bewolkt',
  bewolkt: 'bewolkt',
  mist: 'mist',
  motregen: 'motregen',
  regen: 'regen',
  sneeuw: 'sneeuw',
  onweer: 'onweer',
};
