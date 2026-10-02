import type { Bedrag, Prijs, PrijsRegel, Valuta } from '@/domein/schema';
import type { Koersen } from './koers';

/**
 * Bedragen op het scherm zetten. Dit is de enige plek in de app waar dat mag.
 *
 * De afspraak uit de specificatie is hard: elk bedrag in yen of dong toont het
 * euro-equivalent ertussen haakjes, zoals ¥1.200 (EUR 7). Zou elk scherm dat
 * zelf doen, dan staat er binnen een maand op de ene plek € en op de andere
 * EUR, rekent de ene met een andere koers dan de andere, en rondt er eentje op
 * twee decimalen af. Daarom één helper, en nergens anders een deling door een
 * koers.
 */

const NL = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 });

const SYMBOOL: Record<Valuta, string> = { JPY: '¥', VND: '₫', EUR: 'EUR ' };

/** Een bedrag in de lokale valuta, zonder omrekening. */
export const formatteerLokaal = (bedrag: number, valuta: Valuta): string =>
  `${SYMBOOL[valuta]}${NL.format(Math.round(bedrag))}`;

/**
 * Rekent om naar euro's. Geeft null bij EUR zelf, want "EUR 7 (EUR 7)" is
 * onzin en dat moet de aanroeper niet hoeven uitzoeken.
 */
export const naarEuro = (bedrag: number, valuta: Valuta, koersen: Koersen): number | null => {
  if (valuta === 'EUR') return null;
  const perEuro = koersen.perEuro[valuta];
  if (!perEuro || perEuro <= 0) return null;
  return bedrag / perEuro;
};

const NL_CENTEN = new Intl.NumberFormat('nl-NL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Euro's als hele euro's. Op reis wil je weten of iets zeven of zeventig euro
 * is; centen zijn ruis, zeker bij een koers die vandaag anders is dan morgen.
 * Onder de halve euro zou "EUR 0" komen te staan, en dat leest als gratis
 * terwijl het dat niet is.
 *
 * Met `centen` komen er twee decimalen bij. Dat is voor dong: in Hanoi kost
 * bijna alles minder dan tien euro, en dan zegt "EUR 2" te weinig en
 * "minder dan EUR 1" niets over een glas bia hoi van een halve euro.
 */
export const formatteerEuro = (euro: number, centen = false): string => {
  if (centen) return `EUR ${NL_CENTEN.format(euro)}`;
  const afgerond = Math.round(euro);
  if (afgerond === 0) return 'minder dan EUR 1';
  return `EUR ${NL.format(afgerond)}`;
};

/** Dong onder de tien euro krijgt centen; zie `formatteerEuro`. */
const metCenten = (valuta: Valuta, euro: number): boolean => valuta === 'VND' && euro < 10;

/**
 * Het volledige bedrag zoals het op het scherm hoort: lokaal met euro ertussen
 * haakjes, en bij een reeks aan beide kanten een bedrag maar één keer haakjes.
 * Dus ¥300 tot ¥500 (EUR 2 tot 3).
 *
 * Komt de koers niet van het net of uit de opslag maar is hij in de app
 * ingebakken, dan staat er "indicatie" bij het eurobedrag: dan is het een
 * schatting met een koers die maanden oud kan zijn.
 */
export const formatteerBedrag = (bedrag: Bedrag, koersen: Koersen): string => {
  const lokaal =
    bedrag.tot === undefined
      ? formatteerLokaal(bedrag.bedrag, bedrag.valuta)
      : `${formatteerLokaal(bedrag.bedrag, bedrag.valuta)} tot ${formatteerLokaal(bedrag.tot, bedrag.valuta)}`;
  const indicatie = koersen.bron === 'ingebakken' ? ', indicatie' : '';

  const van = naarEuro(bedrag.bedrag, bedrag.valuta, koersen);
  if (van === null) return lokaal;
  const centen = metCenten(bedrag.valuta, van);

  if (bedrag.tot === undefined) return `${lokaal} (${formatteerEuro(van, centen)}${indicatie})`;

  const tot = naarEuro(bedrag.tot, bedrag.valuta, koersen);
  if (tot === null) return `${lokaal} (${formatteerEuro(van, centen)}${indicatie})`;

  if (centen) {
    return `${lokaal} (${formatteerEuro(van, true)} tot ${NL_CENTEN.format(tot)}${indicatie})`;
  }

  // Vallen beide kanten op hetzelfde hele bedrag, dan is "EUR 2 tot 2" alleen
  // maar verwarrend; dan is één getal eerlijker.
  const vanAf = Math.round(van);
  const totAan = Math.round(tot);
  if (vanAf === totAan) return `${lokaal} (${formatteerEuro(van)}${indicatie})`;

  const totTekst = totAan === 0 ? formatteerEuro(tot) : NL.format(totAan);
  return `${lokaal} (${formatteerEuro(van)} tot ${totTekst}${indicatie})`;
};

/** Hetzelfde, maar dan voor een prijs die ook "gratis" kan zijn. */
export const formatteerPrijs = (prijs: Prijs, koersen: Koersen): string =>
  prijs === 'gratis' ? 'gratis' : formatteerBedrag(prijs, koersen);

/**
 * Een regel uit een prijslijst als prijs. Zonder valuta in de regel geldt die
 * van de stad; een bedrag van nul is gratis.
 */
export const regelAlsPrijs = (regel: PrijsRegel, stadValuta: Valuta): Prijs => {
  const valuta = regel.valuta ?? stadValuta;
  if (regel.bedrag !== undefined) {
    return regel.bedrag === 0 ? 'gratis' : { bedrag: regel.bedrag, valuta };
  }
  return { bedrag: regel.van ?? 0, tot: regel.tot, valuta };
};

/**
 * De prijsklassen uit hoofdstuk 3 van de specificatie, per valuta. Ze staan
 * hier omdat ze bedragen zijn en dus door dezelfde helper horen te gaan; de
 * grenzen zijn vast, de euro's ernaast bewegen met de koers mee.
 */
export interface Prijsklasse {
  id: string;
  /** Ondergrens, in lokale valuta. */
  vanaf: number;
  /** Bovengrens, in lokale valuta. Leeg is: en hoger. */
  tot?: number;
  valuta: Exclude<Valuta, 'EUR'>;
}

export const PRIJSKLASSEN: Record<Exclude<Valuta, 'EUR'>, Prijsklasse[]> = {
  JPY: [
    { id: 'jpy-1', vanaf: 0, tot: 1500, valuta: 'JPY' },
    { id: 'jpy-2', vanaf: 1500, tot: 4000, valuta: 'JPY' },
    { id: 'jpy-3', vanaf: 4000, tot: 10000, valuta: 'JPY' },
    { id: 'jpy-4', vanaf: 10000, valuta: 'JPY' },
  ],
  VND: [
    { id: 'vnd-1', vanaf: 0, tot: 60000, valuta: 'VND' },
    { id: 'vnd-2', vanaf: 60000, tot: 150000, valuta: 'VND' },
    { id: 'vnd-3', vanaf: 150000, tot: 400000, valuta: 'VND' },
    { id: 'vnd-4', vanaf: 400000, valuta: 'VND' },
  ],
};

/** Het label van een prijsklasse, met de euro's er weer netjes bij. */
export const formatteerPrijsklasse = (klasse: Prijsklasse, koersen: Koersen): string => {
  if (klasse.tot === undefined) {
    return `${formatteerLokaal(klasse.vanaf, klasse.valuta)} en hoger (${euroTekst(klasse.vanaf, klasse.valuta, koersen)} en hoger)`;
  }
  if (klasse.vanaf === 0) {
    return `tot ${formatteerLokaal(klasse.tot, klasse.valuta)} (tot ${euroTekst(klasse.tot, klasse.valuta, koersen)})`;
  }
  return formatteerBedrag(
    { bedrag: klasse.vanaf, tot: klasse.tot, valuta: klasse.valuta },
    koersen,
  );
};

const euroTekst = (bedrag: number, valuta: Exclude<Valuta, 'EUR'>, koersen: Koersen): string => {
  const euro = naarEuro(bedrag, valuta, koersen);
  return euro === null ? '' : formatteerEuro(euro);
};

/**
 * In welke prijsklasse valt een bedrag? Null als het niet in deze valuta is.
 *
 * Een bedrag in euro, zoals een massage in een hotelspa, rekent eerst om naar
 * de valuta van de stad (`stadValuta`) met de koers die meegegeven wordt.
 * Zonder koers of stad valt het buiten de klassen.
 */
export const prijsklasseVan = (
  bedrag: Bedrag,
  omrekenen?: { stadValuta: Valuta; koersen: Koersen },
): Prijsklasse | null => {
  let valuta: Exclude<Valuta, 'EUR'>;
  let hoogte = bedrag.bedrag;
  if (bedrag.valuta === 'EUR') {
    if (!omrekenen || omrekenen.stadValuta === 'EUR') return null;
    valuta = omrekenen.stadValuta;
    hoogte = bedrag.bedrag * omrekenen.koersen.perEuro[valuta];
  } else {
    valuta = bedrag.valuta;
  }
  const klassen = PRIJSKLASSEN[valuta];
  return klassen.find((k) => hoogte >= k.vanaf && (k.tot === undefined || hoogte < k.tot)) ?? null;
};
