/**
 * Openingstijden in de notatie van OpenStreetMap (opening_hours), voor zover
 * de app die nodig heeft.
 *
 * De Hanoi plekken komen met tijden als "Tu-Su 08:30-17:30" of "Mo-Su
 * 08:00-12:00,13:30-17:00; Mo[1] off". Dat formaat kan wat het eenvoudige
 * formaat van de app niet kan: seizoenen, de eerste maandag van de maand en een
 * periode waarin iets dicht is. De volledige bibliotheek opening_hours.js doet
 * dat ook, maar is met zijn feestdagen per land vele malen groter dan dit
 * bestand, voor een handvol regels die we echt gebruiken.
 *
 * Wat hier niet staat, wordt geweigerd met een foutmelding. Dat is de kern: een
 * tijd die de app niet begrijpt mag nooit stil "altijd open" worden. De controle
 * in CI valt erover, zodat je het merkt voordat je voor een dichte deur staat.
 *
 * Ondersteund, gescheiden door puntkomma's:
 * - 24/7
 * - dagen: Mo, Mo-Fr, Tu-Th,Sa,Su, Fr-Su (ook over het weekeinde heen)
 * - de zoveelste dag van de maand: Mo[1], Mo[1,3], Su[-1]
 * - maanden: Apr-Oct, Nov-Mar, Dec
 * - een periode: 2026 Sep 04-2026 Nov 02
 * - tijden: 08:00-17:00, meerdere met komma's, tot 24:00, en over middernacht
 *   heen zoals 17:00-02:00
 * - off of closed voor dicht
 *
 * Net als in OpenStreetMap geldt: een latere regel die een dag raakt, vervangt
 * wat eerdere regels over die dag zeiden, en een dag die geen enkele regel
 * raakt is dicht.
 */

/** Een blok in minuten na middernacht. Is `tot` kleiner dan `van`, dan loopt het door na middernacht. */
export interface Blok {
  van: number;
  tot: number;
}

export interface OsmRegel {
  /** Maanden, 1 is januari. Leeg is het hele jaar. */
  maanden?: number[];
  /** Dagen van de week, 0 is maandag. Leeg is elke dag. */
  dagen?: number[];
  /** De hoeveelste van die dag in de maand: 1 is de eerste, -1 de laatste. */
  nde?: number[];
  /** Een periode als ISO datums, beide grenzen inbegrepen. */
  periode?: { van: string; tot: string };
  /** Leeg betekent dicht. */
  blokken: Blok[];
}

export type OsmUitkomst = { soort: 'open'; blokken: Blok[] } | { soort: 'gesloten' };

const DAGEN = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MAANDEN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export class OsmFout extends Error {}

const fout = (deel: string, waarom: string): never => {
  throw new OsmFout(`Openingstijd "${deel}" niet te lezen: ${waarom}.`);
};

/** Een reeks die over het eind heen mag lopen, zoals Fr-Su of Nov-Mar. */
const reeks = (van: number, tot: number, lengte: number): number[] => {
  const uit: number[] = [];
  for (let i = van; ; i = (i + 1) % lengte) {
    uit.push(i);
    if (i === tot) break;
  }
  return uit;
};

const leesKlok = (tekst: string, deel: string, isEinde: boolean): number => {
  const m = /^(\d{2}):(\d{2})$/.exec(tekst);
  if (!m) return fout(deel, `"${tekst}" is geen tijd als 08:00`);
  const uur = Number(m[1]);
  const minuut = Number(m[2]);
  if (minuut > 59 || uur > 24 || (uur === 24 && (minuut > 0 || !isEinde))) {
    return fout(deel, `"${tekst}" bestaat niet`);
  }
  return uur * 60 + minuut;
};

const leesBlokken = (tekst: string, deel: string): Blok[] =>
  tekst.split(',').map((stuk) => {
    const [van, tot, teveel] = stuk.split('-');
    if (van === undefined || tot === undefined || teveel !== undefined) {
      return fout(deel, `"${stuk}" is geen tijdvak als 08:00-17:00`);
    }
    const blok = { van: leesKlok(van, deel, false), tot: leesKlok(tot, deel, true) };
    if (blok.van === blok.tot) return fout(deel, `"${stuk}" begint en eindigt op hetzelfde moment`);
    return blok;
  });

const leesDagen = (token: string, deel: string): { dagen: number[]; nde?: number[] } => {
  const dagen: number[] = [];
  let nde: number[] | undefined;
  // Splits op komma's die niet tussen blokhaken staan: Mo[1,3],We.
  const stukken = token.match(/[A-Z][a-z](?:\[[^\]]*\])?(?:-[A-Z][a-z])?/g) ?? [];
  if (stukken.join(',') !== token) return fout(deel, `"${token}" zijn geen dagen als Mo-Fr`);
  for (const stuk of stukken) {
    const m = /^([A-Z][a-z])(?:\[([^\]]*)\])?(?:-([A-Z][a-z]))?$/.exec(stuk)!;
    const van = DAGEN.indexOf(m[1]);
    const tot = m[3] === undefined ? van : DAGEN.indexOf(m[3]);
    if (van < 0 || tot < 0) return fout(deel, `"${stuk}" is geen dag`);
    if (m[2] !== undefined) {
      if (m[3] !== undefined) return fout(deel, 'een zoveelste dag kan niet in een reeks');
      nde = m[2].split(',').map((n) => {
        const getal = Number(n);
        if (!Number.isInteger(getal) || getal === 0 || getal < -1 || getal > 5) {
          return fout(deel, `"[${m[2]}]" is geen zoveelste dag`);
        }
        return getal;
      });
    }
    dagen.push(...reeks(van, tot, 7));
  }
  return { dagen, nde };
};

const leesMaanden = (token: string, deel: string): number[] =>
  token.split(',').flatMap((stuk) => {
    const [van, tot, teveel] = stuk.split('-');
    const i = MAANDEN.indexOf(van);
    const j = tot === undefined ? i : MAANDEN.indexOf(tot);
    if (i < 0 || j < 0 || teveel !== undefined) return fout(deel, `"${stuk}" zijn geen maanden`);
    return reeks(i, j, 12).map((m) => m + 1);
  });

const PERIODE = /^(\d{4}) ([A-Z][a-z]{2}) (\d{2})-(\d{4}) ([A-Z][a-z]{2}) (\d{2})$/;

const isoDatum = (jaar: string, maand: string, dag: string, deel: string): string => {
  const m = MAANDEN.indexOf(maand);
  if (m < 0) return fout(deel, `"${maand}" is geen maand`);
  return `${jaar}-${String(m + 1).padStart(2, '0')}-${dag}`;
};

const leesRegel = (deel: string): OsmRegel => {
  if (deel === '24/7') return { blokken: [{ van: 0, tot: 24 * 60 }] };

  let selectie: string;
  let blokken: Blok[];
  const dicht = /^(.*?)\s*\b(off|closed)$/.exec(deel);
  if (dicht) {
    selectie = dicht[1];
    blokken = [];
    if (!selectie) return fout(deel, 'dicht zonder te zeggen wanneer');
  } else {
    const tijden = /^(.*?)\s*(\d{2}:\d{2}-\d{2}:\d{2}(?:,\d{2}:\d{2}-\d{2}:\d{2})*)$/.exec(deel);
    if (!tijden) return fout(deel, 'geen tijden of "off" gevonden');
    selectie = tijden[1];
    blokken = leesBlokken(tijden[2], deel);
  }

  const regel: OsmRegel = { blokken };
  const periode = PERIODE.exec(selectie);
  if (periode) {
    regel.periode = {
      van: isoDatum(periode[1], periode[2], periode[3], deel),
      tot: isoDatum(periode[4], periode[5], periode[6], deel),
    };
    if (regel.periode.van > regel.periode.tot) fout(deel, 'de periode eindigt voor hij begint');
    return regel;
  }

  for (const token of selectie.split(/\s+/).filter(Boolean)) {
    if (/^[A-Z][a-z]{2}\b/.test(token)) {
      if (regel.maanden) fout(deel, 'twee keer maanden');
      regel.maanden = leesMaanden(token, deel);
    } else if (/^[A-Z][a-z]\b/.test(token)) {
      if (regel.dagen) fout(deel, 'twee keer dagen');
      const { dagen, nde } = leesDagen(token, deel);
      regel.dagen = dagen;
      if (nde) regel.nde = nde;
    } else {
      fout(deel, `"${token}" wordt niet ondersteund`);
    }
  }
  return regel;
};

const geheugen = new Map<string, OsmRegel[]>();

/**
 * Leest een volledige openingstijd. Gooit een `OsmFout` met een leesbare
 * melding bij alles wat niet ondersteund wordt.
 */
export const leesOsm = (tekst: string): OsmRegel[] => {
  const bekend = geheugen.get(tekst);
  if (bekend) return bekend;
  const delen = tekst
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean);
  if (delen.length === 0) fout(tekst, 'leeg');
  const regels = delen.map(leesRegel);
  geheugen.set(tekst, regels);
  return regels;
};

/** Geeft de foutmelding, of null als de tekst te lezen is. */
export const osmFout = (tekst: string): string | null => {
  try {
    leesOsm(tekst);
    return null;
  } catch (e) {
    if (e instanceof OsmFout) return e.message;
    throw e;
  }
};

/** Weekdag, maand en dag van een ISO datum, zonder tijdzones. */
const kalender = (datum: string) => {
  const [jaar, maand, dag] = datum.split('-').map(Number);
  const moment = new Date(Date.UTC(jaar, maand - 1, dag, 12));
  const dagenInMaand = new Date(Date.UTC(jaar, maand, 0)).getUTCDate();
  return { weekdag: (moment.getUTCDay() + 6) % 7, maand, dag, dagenInMaand };
};

const raakt = (regel: OsmRegel, datum: string): boolean => {
  if (regel.periode && (datum < regel.periode.van || datum > regel.periode.tot)) return false;
  const k = kalender(datum);
  if (regel.maanden && !regel.maanden.includes(k.maand)) return false;
  if (regel.dagen && !regel.dagen.includes(k.weekdag)) return false;
  if (regel.nde) {
    const hoeveelste = Math.ceil(k.dag / 7);
    const laatste = k.dag + 7 > k.dagenInMaand;
    if (!regel.nde.some((n) => (n === -1 ? laatste : n === hoeveelste))) return false;
  }
  return true;
};

/** Open of dicht op een datum (YYYY-MM-DD), volgens de regels. */
export const osmOp = (regels: OsmRegel[], datum: string): OsmUitkomst => {
  let laatste: OsmRegel | undefined;
  for (const regel of regels) if (raakt(regel, datum)) laatste = regel;
  if (!laatste || laatste.blokken.length === 0) return { soort: 'gesloten' };
  return { soort: 'open', blokken: laatste.blokken };
};
