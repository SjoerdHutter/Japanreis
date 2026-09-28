/**
 * Rekenen met kale datums, als YYYY-MM-DD.
 *
 * Een datum zonder tijd is hier altijd een kalenderdag en nooit een moment, dus
 * er wordt gerekend in UTC om te voorkomen dat een zomertijdgrens een dag
 * opslokt of verdubbelt.
 */

const DAG_MS = 86_400_000;

export const plusDagen = (datum: string, dagen: number): string =>
  new Date(Date.parse(`${datum}T00:00:00Z`) + dagen * DAG_MS).toISOString().slice(0, 10);

/** Het aantal dagen van `van` tot `tot`; negatief als `tot` eerder ligt. */
export const dagenTussen = (van: string, tot: string): number =>
  Math.round((Date.parse(`${tot}T00:00:00Z`) - Date.parse(`${van}T00:00:00Z`)) / DAG_MS);

/** Alle datums van `van` tot en met `tot`. Leeg als `tot` voor `van` ligt. */
export const datumsVanTot = (van: string, tot: string): string[] => {
  const aantal = dagenTussen(van, tot);
  return Array.from({ length: Math.max(0, aantal + 1) }, (_, i) => plusDagen(van, i));
};

const MAANDEN_KORT = [
  'jan',
  'feb',
  'mrt',
  'apr',
  'mei',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'dec',
];

/** 2026-10-08 wordt "8 okt". Geen streepjes in een zin. */
export const alsKorteDatum = (datum: string): string => {
  const [, maand, dag] = datum.split('-').map(Number);
  return `${dag} ${MAANDEN_KORT[maand - 1]}`;
};

/** "8 okt", "8 en 9 okt", "8 t/m 12 okt" of "30 sep t/m 2 okt". */
export const alsPeriode = (van: string, tot: string): string => {
  if (van === tot) return alsKorteDatum(van);
  const tussen = dagenTussen(van, tot) === 1 ? 'en' : 't/m';
  const [, maandVan, dagVan] = van.split('-').map(Number);
  const [, maandTot] = tot.split('-').map(Number);
  return maandVan === maandTot
    ? `${dagVan} ${tussen} ${alsKorteDatum(tot)}`
    : `${alsKorteDatum(van)} ${tussen} ${alsKorteDatum(tot)}`;
};
