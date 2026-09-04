import type { Valuta } from '@/domein/schema';

/**
 * De wisselkoers, op één plek.
 *
 * De app toont bij elk bedrag in yen of dong het euro-equivalent. Dat mag nooit
 * afhangen van of er net bereik is, dus er zijn drie lagen: een verse koers van
 * het net, anders de laatst opgehaalde koers uit IndexedDB, en anders een koers
 * die in de app is ingebakken. De gebruiker ziet altijd welke laag het is en
 * van wanneer hij dateert, want een koers van een half jaar oud is bruikbaar
 * zolang je weet dat hij oud is.
 */

/** Hoeveel eenheden lokale valuta je krijgt voor één euro. */
export type KoersTabel = Record<Exclude<Valuta, 'EUR'>, number>;

export type KoersBron = 'live' | 'opgeslagen' | 'ingebakken';

export interface Koersen {
  perEuro: KoersTabel;
  /** Datum waarop deze koers is vastgesteld, als YYYY-MM-DD. */
  datum: string;
  bron: KoersBron;
}

/**
 * De laatste redding: een koers die met de app meereist.
 *
 * Deze staat er voor de eerste start zonder bereik. Hij is met opzet grof: het
 * gaat erom dat je in een winkel weet of iets vijf of vijftig euro is, niet om
 * de derde decimaal. Werk hem bij als hij er te ver naast gaat zitten.
 */
export const INGEBAKKEN_KOERS: Koersen = {
  perEuro: { JPY: 172, VND: 28500 },
  datum: '2026-01-01',
  bron: 'ingebakken',
};

/**
 * Twee bronnen, allebei zonder sleutel en met CORS. De tweede staat er omdat
 * één bron die een dag uit de lucht is anders meteen betekent dat je met een
 * verouderde koers rondloopt.
 */
const BRONNEN = [
  {
    url: 'https://open.er-api.com/v6/latest/EUR',
    lees: (data: unknown): Koersen | null => {
      const d = data as { rates?: Record<string, number>; time_last_update_unix?: number };
      const jpy = d.rates?.JPY;
      const vnd = d.rates?.VND;
      if (typeof jpy !== 'number' || typeof vnd !== 'number') return null;
      const moment = d.time_last_update_unix
        ? new Date(d.time_last_update_unix * 1000)
        : new Date();
      return { perEuro: { JPY: jpy, VND: vnd }, datum: alsDatum(moment), bron: 'live' };
    },
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json',
    lees: (data: unknown): Koersen | null => {
      const d = data as { date?: string; eur?: Record<string, number> };
      const jpy = d.eur?.jpy;
      const vnd = d.eur?.vnd;
      if (typeof jpy !== 'number' || typeof vnd !== 'number') return null;
      return {
        perEuro: { JPY: jpy, VND: vnd },
        datum: d.date ?? alsDatum(new Date()),
        bron: 'live',
      };
    },
  },
];

const alsDatum = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Haalt een verse koers op. Geeft null terug als geen enkele bron lukt; de
 * beller valt dan terug op wat er opgeslagen staat. Er wordt hier met opzet
 * niets gelogd of gegooid: geen bereik is de normale toestand in een trein.
 */
export const haalKoersOp = async (signaal?: AbortSignal): Promise<Koersen | null> => {
  for (const bron of BRONNEN) {
    try {
      const antwoord = await fetch(bron.url, { signal: signaal });
      if (!antwoord.ok) continue;
      const koersen = bron.lees(await antwoord.json());
      if (koersen && koersen.perEuro.JPY > 0 && koersen.perEuro.VND > 0) return koersen;
    } catch {
      /* volgende bron proberen */
    }
  }
  return null;
};

/** Hoe oud is deze koers, in hele dagen? Voor de melding in de instellingen. */
export const ouderdomInDagen = (koersen: Koersen, nu: Date = new Date()): number => {
  const toen = Date.parse(`${koersen.datum}T00:00:00Z`);
  if (Number.isNaN(toen)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((nu.getTime() - toen) / 86_400_000));
};
