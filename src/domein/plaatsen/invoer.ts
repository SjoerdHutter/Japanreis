import type { Coordinaat, Sluiting } from '@/domein/schema';

/**
 * Wat je in de app zelf invult voor een plek, terug naar de vorm van de data.
 */

/**
 * Coördinaten uit wat je plakt: "21.0287, 105.8524", met een spatie ertussen,
 * of een link uit Google Maps waar ze in staan ("@21.0287,105.8524" of
 * "?q=21.0287,105.8524"). Null als er niets bruikbaars in staat.
 */
export const leesCoordinaten = (tekst: string): Coordinaat | null => {
  const m = /(-?\d{1,2}\.\d+)\s*[,\s]\s*(-?\d{1,3}\.\d+)/.exec(tekst);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
};

const SLUITING = /^(\d{4}-\d{2}-\d{2})\s+(?:tot|t\/m)\s+(\d{4}-\d{2}-\d{2})\s*:?\s*(.+)$/;

/**
 * Sluitingen uit tekst, één per regel: "2026-09-04 tot 2026-11-02: onderhoud".
 * Geeft de sluitingen, of de eerste regel die niet te lezen is.
 */
export const leesSluitingen = (tekst: string): { sluitingen: Sluiting[] } | { fout: string } => {
  const sluitingen: Sluiting[] = [];
  for (const regel of tekst
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean)) {
    const m = SLUITING.exec(regel);
    if (!m || m[1] > m[2]) return { fout: regel };
    sluitingen.push({ van: m[1], tot: m[2], reden: m[3].trim() });
  }
  return { sluitingen };
};

/** De omgekeerde weg, om te bewerken. */
export const sluitingenAlsTekst = (sluitingen: Sluiting[] | undefined): string =>
  (sluitingen ?? []).map((s) => `${s.van} tot ${s.tot}: ${s.reden}`).join('\n');
