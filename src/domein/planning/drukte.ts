/**
 * Het rustigste moment van een drukke plek, als iets waar de planner mee kan
 * rekenen.
 *
 * In de content staat het als tekst die je zelf ook zo zou schrijven: "voor
 * 08:00", "na 17:00", "07:00 tot 09:00" of "bij opening". Dit leest dat, en
 * zegt of de plek vroeg of laat in de dag hoort. Kan dat niet binnen de
 * openingstijden (een tuin die om negen uur opengaat heeft geen rustig moment
 * voor acht), dan blijft de plek gewoon in de looproute.
 */

export interface Tijdslot {
  /** Vanaf wanneer het rustig is, in minuten na middernacht. */
  van?: number;
  /** Tot wanneer het rustig is. */
  tot?: number;
  /** Het rustigst bij opening. */
  opening?: boolean;
}

const klok = (uur: string, minuut: string) => Number(uur) * 60 + Number(minuut);

export const leesTijdslot = (tekst: string | undefined): Tijdslot | null => {
  if (!tekst) return null;
  const t = tekst.trim().toLowerCase();
  const tussen = /(\d{1,2}):(\d{2})\s*(?:tot|-|–)\s*(\d{1,2}):(\d{2})/.exec(t);
  if (tussen) return { van: klok(tussen[1], tussen[2]), tot: klok(tussen[3], tussen[4]) };
  const voor = /voor\s+(\d{1,2}):(\d{2})/.exec(t);
  if (voor) return { tot: klok(voor[1], voor[2]) };
  const na = /(?:na|vanaf)\s+(\d{1,2}):(\d{2})/.exec(t);
  if (na) return { van: klok(na[1], na[2]) };
  if (/bij open/.test(t)) return { opening: true };
  return null;
};

const alsKlok = (minuten: number) =>
  `${String(Math.floor(minuten / 60)).padStart(2, '0')}:${String(minuten % 60).padStart(2, '0')}`;

/** Hoe de app het tijdslot gelezen heeft, als controle bij het invullen. */
export const alsTijdslotTekst = (slot: Tijdslot): string => {
  if (slot.opening) return 'bij opening';
  if (slot.van !== undefined && slot.tot !== undefined)
    return `${alsKlok(slot.van)} tot ${alsKlok(slot.tot)}`;
  if (slot.tot !== undefined) return `voor ${alsKlok(slot.tot)}`;
  return `na ${alsKlok(slot.van ?? 0)}`;
};

export type Anker = 'vroeg' | 'laat';

/**
 * Hoort deze plek vroeg of laat in de dag? Null als het rustige moment niet
 * binnen de openingstijden valt, of als er geen rustig moment bekend is.
 */
export const ankerVan = (
  slot: Tijdslot | null,
  raam: { van: number; tot: number } | null,
): Anker | null => {
  if (!slot) return null;
  if (slot.opening) return 'vroeg';
  if (slot.tot !== undefined && slot.van === undefined) {
    return raam && raam.van >= slot.tot ? null : 'vroeg';
  }
  if (slot.van !== undefined && slot.tot === undefined) {
    return raam && raam.tot <= slot.van + 15 ? null : 'laat';
  }
  if (slot.van !== undefined && slot.tot !== undefined) {
    if (raam && (raam.tot <= slot.van || raam.van >= slot.tot)) return null;
    return slot.van < 12 * 60 ? 'vroeg' : 'laat';
  }
  return null;
};
