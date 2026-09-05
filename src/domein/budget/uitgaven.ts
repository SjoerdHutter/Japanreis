import type { Bedrag, Valuta } from '@/domein/schema';
import type { Koersen } from '@/domein/valuta/koers';
import { naarEuro } from '@/domein/valuta/formatteer';

/**
 * Uitgaven bijhouden, met een aparte teller voor contant geld.
 *
 * Die tweedeling is niet cosmetisch. In Japan gaat veel met kaart, maar kleine
 * tempels, marktkraampjes, lockers en de bus willen munten, en in Vietnam is
 * contant nog de norm. Wie alleen een totaal bijhoudt, staat op een dag zonder
 * pinautomaat voor een tempel die geen kaart aanneemt terwijl zijn app zegt dat
 * hij nog ruim in het budget zit.
 */

export type Categorie =
  'eten' | 'vervoer' | 'attracties' | 'verblijf' | 'winkelen' | 'stempels' | 'overig';

export const CATEGORIEEN: Categorie[] = [
  'eten',
  'vervoer',
  'attracties',
  'verblijf',
  'winkelen',
  'stempels',
  'overig',
];

export interface Uitgave {
  id: string;
  /** Waar het aan opging, in de eigen woorden van de gebruiker. */
  omschrijving: string;
  bedrag: Bedrag;
  categorie: Categorie;
  /** Contant of met kaart. Bepaalt de aparte contantteller. */
  contant: boolean;
  /** De dag waarop je het uitgaf, als YYYY-MM-DD. */
  datum: string;
  stadId?: string;
}

/** Contant geld dat je hebt opgenomen of ingewisseld; vult de contantvoorraad. */
export interface Opname {
  id: string;
  bedrag: Bedrag;
  datum: string;
  omschrijving?: string;
}

export interface Totalen {
  /** Alles bij elkaar, omgerekend naar euro. */
  euro: number;
  /** Per valuta apart, want dat is wat er in je portemonnee zit. */
  perValuta: Map<Valuta, number>;
  perCategorie: Map<Categorie, number>;
  contantEuro: number;
  kaartEuro: number;
}

const optellen = <K>(kaart: Map<K, number>, sleutel: K, waarde: number): void => {
  kaart.set(sleutel, (kaart.get(sleutel) ?? 0) + waarde);
};

/**
 * Alles opgeteld.
 *
 * De euro's zijn de gemeenschappelijke noemer, want yen en dong optellen levert
 * een getal op dat niets betekent. De bedragen per valuta staan er los naast,
 * omdat je die nodig hebt om te weten wat er nog in je portemonnee zit.
 */
export const totalen = (uitgaven: Uitgave[], koersen: Koersen): Totalen => {
  const perValuta = new Map<Valuta, number>();
  const perCategorie = new Map<Categorie, number>();
  let euro = 0;
  let contantEuro = 0;
  let kaartEuro = 0;

  for (const uitgave of uitgaven) {
    const { bedrag, valuta } = uitgave.bedrag;
    optellen(perValuta, valuta, bedrag);

    // In euro's, want optellen over valuta's heen kan niet anders. Een bedrag
    // dat al in euro staat telt gewoon mee.
    const inEuro = valuta === 'EUR' ? bedrag : (naarEuro(bedrag, valuta, koersen) ?? 0);
    euro += inEuro;
    optellen(perCategorie, uitgave.categorie, inEuro);
    if (uitgave.contant) contantEuro += inEuro;
    else kaartEuro += inEuro;
  }

  return { euro, perValuta, perCategorie, contantEuro, kaartEuro };
};

/**
 * Hoeveel contant je nog zou moeten hebben, per valuta.
 *
 * Opgenomen min contant uitgegeven. Dit is een boekhouding en geen meting: als
 * je vergeet iets in te voeren klopt hij niet meer, en dat is precies waarom het
 * getal ernaast staat en niet als waarheid gepresenteerd wordt.
 */
export const contantVoorraad = (opnames: Opname[], uitgaven: Uitgave[]): Map<Valuta, number> => {
  const voorraad = new Map<Valuta, number>();
  for (const opname of opnames) optellen(voorraad, opname.bedrag.valuta, opname.bedrag.bedrag);
  for (const uitgave of uitgaven) {
    if (uitgave.contant) optellen(voorraad, uitgave.bedrag.valuta, -uitgave.bedrag.bedrag);
  }
  return voorraad;
};

/** Uitgaven per dag, nieuwste eerst. Voor het overzicht in het scherm. */
export const perDag = (uitgaven: Uitgave[]): { datum: string; uitgaven: Uitgave[] }[] => {
  const dagen = new Map<string, Uitgave[]>();
  for (const uitgave of uitgaven) {
    const lijst = dagen.get(uitgave.datum);
    if (lijst) lijst.push(uitgave);
    else dagen.set(uitgave.datum, [uitgave]);
  }
  return [...dagen.entries()]
    .map(([datum, lijst]) => ({ datum, uitgaven: lijst }))
    .sort((a, b) => b.datum.localeCompare(a.datum));
};

/**
 * Tax free winkelen in Japan.
 *
 * De drempel is ¥5.000 per winkel per dag, en er zijn twee soorten: verbruik
 * (eten, cosmetica, medicijnen) die verzegeld wordt en het land uit moet, en
 * algemene goederen die je gewoon mag gebruiken. Ze tellen sinds enkele jaren
 * bij elkaar op voor de drempel.
 */
export const TAX_FREE_DREMPEL: Bedrag = { bedrag: 5000, valuta: 'JPY' };

export const haaltTaxFreeDrempel = (bedrag: Bedrag): boolean =>
  bedrag.valuta === 'JPY' && bedrag.bedrag >= TAX_FREE_DREMPEL.bedrag;
