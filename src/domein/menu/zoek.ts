import type { Allergeen, MenuCategorie, MenuItem } from '@/domein/schema';

/**
 * Zoeken op de menukaart.
 *
 * Wat je intikt komt van een kaart die je voor je ziet, en die schrijft het
 * op zijn eigen manier: ラーメン of らーめん, rāmen of ramen, shōyu of shouyu,
 * tempura of tenpura. Beide kanten gaan daarom door dezelfde vertaling voordat
 * ze vergeleken worden: katakana wordt hiragana, het verlengteken valt weg,
 * macrons en dubbele klinkers worden enkel, en een m voor b of p wordt een n.
 */

/** Katakana naar hiragana: dezelfde klank, een vast verschil in de tekentabel. */
const naarHiragana = (tekst: string): string =>
  tekst.replace(/[ァ-ヶ]/g, (teken) => String.fromCharCode(teken.charCodeAt(0) - 0x60));

const zonderAccenten = (tekst: string): string => tekst.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Japans schrift, zoals het op de kaart staat. */
export const normaliseerJapans = (tekst: string): string =>
  naarHiragana(tekst.normalize('NFKC'))
    .replace(/[ー〜~・\s]/g, '')
    .toLowerCase();

/** Romaji: zonder macrons, spaties of streepjes, met de gangbare varianten samengevouwen. */
export const normaliseerRomaji = (tekst: string): string =>
  zonderAccenten(tekst.normalize('NFKC').toLowerCase())
    .replace(/[^a-z]/g, '')
    .replace(/m(?=[bpm])/g, 'n')
    .replace(/ou/g, 'o')
    .replace(/([aeiou])\1+/g, '$1');

/**
 * Nederlands: hoofdletters en accenten eruit, de woorden blijven woorden. Een
 * dubbele klinker wordt enkel, zodat "garnaal" ook "garnalen" vindt.
 */
export const normaliseerNederlands = (tekst: string): string =>
  zonderAccenten(tekst.normalize('NFKC').toLowerCase())
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/([aeiou])\1+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

/** Staat er Japans schrift in? Dan zoeken we alleen in kanji en kana. */
export const isJapans = (tekst: string): boolean => /[぀-ヿ㐀-鿿ｦ-ﾟ]/.test(tekst);

/**
 * Hoe goed een gerecht bij de zoekvraag past. Lager is beter, `null` is geen
 * treffer. Een exacte naam gaat voor een naam die ermee begint, die gaat voor
 * een naam waar het in zit, en de Nederlandse omschrijving komt als laatste.
 */
export const score = (item: MenuItem, vraag: string): number | null => {
  if (isJapans(vraag)) {
    const v = normaliseerJapans(vraag);
    if (!v) return null;
    const namen = [item.kanji, item.kana].filter((n): n is string => !!n).map(normaliseerJapans);
    if (namen.some((n) => n === v)) return 0;
    if (namen.some((n) => n.startsWith(v))) return 1;
    if (namen.some((n) => n.includes(v))) return 2;
    return null;
  }

  const romaji = normaliseerRomaji(item.romaji);
  const v = normaliseerRomaji(vraag);
  if (v) {
    if (romaji === v) return 0;
    if (romaji.startsWith(v)) return 1;
    if (v.length >= 3 && romaji.includes(v)) return 2;
  }

  // In de omschrijving moet elk woord van de vraag het begin van een woord zijn,
  // anders vindt "ei" elk gerecht dat "bereid" wordt.
  const woorden = normaliseerNederlands(vraag).split(' ').filter(Boolean);
  if (woorden.length === 0) return null;
  const tekst = normaliseerNederlands(item.nederlands).split(' ');
  if (woorden.every((w) => tekst.some((t) => t.startsWith(w)))) return 3;
  return null;
};

/** De treffers, beste eerst en verder in de volgorde van het bestand. */
export const zoekOpMenu = (
  items: readonly MenuItem[],
  vraag: string,
  categorie?: MenuCategorie,
): MenuItem[] => {
  const binnen = categorie ? items.filter((i) => i.categorie === categorie) : [...items];
  if (!vraag.trim()) return binnen;
  return binnen
    .map((item, volgorde) => ({ item, volgorde, score: score(item, vraag) }))
    .filter((t): t is { item: MenuItem; volgorde: number; score: number } => t.score !== null)
    .sort((a, b) => a.score - b.score || a.volgorde - b.volgorde)
    .map((t) => t.item);
};

/** Welke van jouw allergenen er gewoonlijk in dit gerecht zitten. */
export const allergenenVoorJou = (item: MenuItem, jouw: readonly Allergeen[]): Allergeen[] =>
  item.allergenen.filter((a) => jouw.includes(a));
