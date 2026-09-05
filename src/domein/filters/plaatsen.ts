import type {
  AttractieType,
  Coordinaat,
  Dagdeel,
  Keuken,
  Plaats,
  Prijs,
  Stad,
} from '@/domein/schema';
import { afstandKm } from '@/domein/geo/afstand';
import { prijsklasseVan } from '@/domein/valuta/formatteer';
import { nuOpen, vasteSluitingsdagen, weekdagIn } from '@/domein/openingstijden/status';

/**
 * De filters uit hoofdstuk 2 en 3, als pure functies.
 *
 * Eén filtermodel voor attracties en eetlocaties samen, want ze draaien op
 * hetzelfde `Plaats`-model en de gebruiker combineert ze ook: "wat kan ik hier
 * doen en waar eet ik daarna". Elk veld dat leeg blijft filtert niets weg, zodat
 * een lege selectie altijd de volledige lijst geeft en de gebruiker nooit voor
 * een leeg scherm staat zonder te begrijpen waarom.
 *
 * Wat er met opzet niet in zit, omdat de specificatie dat uitsluit: Engelse
 * kaart, contant only, en rookvergunning.
 */

/** Hoe ver je in een minuut loopt, in kilometers. Vier kilometer per uur. */
const LOOPSNELHEID_KM_PER_MINUUT = 4 / 60;

export interface Filter {
  /** Vrije tekst; kijkt naar naam, lokale naam, beschrijving en tags. */
  zoek?: string;

  // Attracties, hoofdstuk 2.
  typen?: AttractieType[];
  /** Bovengrens aan de bezoekduur in minuten. Punten zonder duur blijven staan. */
  maxBezoekduur?: number;
  regenbestendig?: boolean;
  dagdelen?: Dagdeel[];

  // Eten, hoofdstuk 3.
  keukens?: Keuken[];
  /** De ids uit PRIJSKLASSEN, bijvoorbeeld jpy-2. */
  prijsklassen?: string[];
  ontbijt?: boolean;
  lateNight?: boolean;
  /** Alleen zaken waarvoor je omloopt, of juist alleen de snelle bak. */
  moeite?: 'waardig-een-omweg' | 'snelle-bak';

  // Overal van toepassing.
  /** Alleen wat nu open is, voor zover de content dat hard maakt. */
  nuOpen?: boolean;
  /** Verberg wat vandaag een vaste sluitingsdag heeft. */
  verbergVandaagGesloten?: boolean;
  reserveringVerplicht?: boolean;
  gratis?: boolean;
  /** Verwijzing naar een tijdvak, om vanaf de tijdlijn terug te filteren. */
  tijdvak?: string;
  /**
   * Maximale looptijd in minuten vanaf `vanaf`. Zonder `vanaf` doet dit niets:
   * zonder vertrekpunt is een looptijd betekenisloos, en dan stilletjes de
   * halve lijst weggooien is erger dan niet filteren.
   */
  maxLooptijd?: number;
  vanaf?: Coordinaat;
}

export const LEEG_FILTER: Filter = {};

/** Staat er iets aan? Voedt de knop om alles in één tik los te laten. */
export const filterActief = (filter: Filter): boolean =>
  Object.entries(filter).some(([sleutel, waarde]) => {
    if (sleutel === 'vanaf') return false; // het vertrekpunt is geen filter
    if (waarde === undefined || waarde === null) return false;
    if (Array.isArray(waarde)) return waarde.length > 0;
    if (typeof waarde === 'string') return waarde.trim() !== '';
    return waarde !== false;
  });

const normaliseer = (tekst: string): string =>
  tekst.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const raaktZoekterm = (plaats: Plaats, term: string): boolean => {
  const naald = normaliseer(term.trim());
  if (!naald) return true;
  const hooiberg = normaliseer(
    [
      plaats.naam,
      plaats.naamLokaal,
      plaats.beschrijving,
      plaats.adres,
      plaats.attractie?.type,
      plaats.eten?.keuken,
      ...(plaats.tags ?? []),
    ]
      .filter(Boolean)
      .join(' '),
  );
  // Elk woord moet ergens voorkomen; zo werkt "ramen station" zoals verwacht.
  return naald.split(/\s+/).every((woord) => hooiberg.includes(woord));
};

const prijsIsGratis = (prijs: Prijs | undefined): boolean => prijs === 'gratis';

/**
 * Past het filter toe. `stad` is nodig voor alles wat met tijd te maken heeft,
 * want open of dicht hangt af van de tijdzone daar en niet van die van je
 * toestel.
 */
export const filterPlaatsen = (
  plaatsen: Plaats[],
  filter: Filter,
  stad: Stad,
  nu: Date = new Date(),
): Plaats[] => {
  const vandaag = weekdagIn(stad.tijdzone, nu);

  return plaatsen.filter((plaats) => {
    if (filter.zoek && !raaktZoekterm(plaats, filter.zoek)) return false;

    // Attracties.
    if (filter.typen?.length) {
      if (!plaats.attractie || !filter.typen.includes(plaats.attractie.type)) return false;
    }
    if (filter.maxBezoekduur !== undefined) {
      const duur = plaats.attractie?.bezoekduurMinuten;
      // Een punt zonder opgegeven duur valt niet af: dat de content iets niet
      // weet is geen reden om het te verbergen.
      if (duur !== undefined && duur > filter.maxBezoekduur) return false;
    }
    if (filter.regenbestendig === true && plaats.attractie?.regenbestendig !== true) return false;
    if (filter.dagdelen?.length) {
      const dagdelen = plaats.attractie?.dagdeel;
      if (!dagdelen || !filter.dagdelen.some((d) => dagdelen.includes(d))) return false;
    }

    // Eten.
    if (filter.keukens?.length) {
      if (!plaats.eten || !filter.keukens.includes(plaats.eten.keuken)) return false;
    }
    if (filter.prijsklassen?.length) {
      // Geldt voor elk punt met een prijs, niet alleen voor eten: een entree van
      // ¥500 valt net zo goed in een trede. Het scherm laat deze knoppen bij
      // eten zien, maar dat onderscheid hoort daar en niet hier.
      if (plaats.prijs === undefined) return false;
      // Gratis valt altijd in de goedkoopste klasse; dat is wat een gebruiker
      // die op de onderste prijstrede tikt bedoelt.
      const klasse =
        plaats.prijs === 'gratis'
          ? stad.valuta === 'VND'
            ? 'vnd-1'
            : 'jpy-1'
          : prijsklasseVan(plaats.prijs)?.id;
      if (!klasse || !filter.prijsklassen.includes(klasse)) return false;
    }
    if (filter.ontbijt === true && plaats.eten?.ontbijt !== true) return false;
    if (filter.lateNight === true && plaats.eten?.lateNight !== true) return false;
    if (filter.moeite && plaats.eten?.moeite !== filter.moeite) return false;

    // Overal van toepassing.
    if (filter.reserveringVerplicht === true && plaats.reservering !== 'verplicht') return false;
    if (filter.gratis === true && !prijsIsGratis(plaats.prijs)) return false;
    if (filter.tijdvak && !plaats.tijdvakken?.includes(filter.tijdvak)) return false;

    if (filter.verbergVandaagGesloten === true) {
      if (vasteSluitingsdagen(plaats.openingstijden).includes(vandaag)) return false;
    }
    if (filter.nuOpen === true) {
      // Alleen wegfilteren wat aantoonbaar dicht is. Een plaats waarvan de
      // tijden niet uit te rekenen zijn blijft staan, met zijn tijden erbij;
      // dat is eerlijker dan hem verstoppen op een gok.
      if (nuOpen(plaats, stad, nu) === false) return false;
    }

    if (filter.maxLooptijd !== undefined && filter.vanaf) {
      const km = afstandKm(filter.vanaf, plaats.coordinaten);
      if (km > filter.maxLooptijd * LOOPSNELHEID_KM_PER_MINUUT) return false;
    }

    return true;
  });
};

/** Looptijd in hele minuten, hemelsbreed. Voor het label bij een punt. */
export const looptijdMinuten = (van: Coordinaat, naar: Coordinaat): number =>
  Math.max(1, Math.round(afstandKm(van, naar) / LOOPSNELHEID_KM_PER_MINUUT));

/**
 * Welke waarden komen er in deze stad werkelijk voor?
 *
 * Het filter toont alleen knoppen die iets opleveren. Een keuzelijst met
 * "kaiseki" in Hanoi of "pho" in Kyoto is niet alleen nutteloos, hij laat de
 * gebruiker ook zoeken naar iets dat er niet is.
 */
export interface Keuzes {
  typen: AttractieType[];
  keukens: Keuken[];
  dagdelen: Dagdeel[];
  tijdvakken: string[];
  heeftRegenbestendig: boolean;
  heeftOntbijt: boolean;
  heeftLateNight: boolean;
  heeftReservering: boolean;
  heeftGratis: boolean;
}

export const keuzesUit = (plaatsen: Plaats[]): Keuzes => {
  const typen = new Set<AttractieType>();
  const keukens = new Set<Keuken>();
  const dagdelen = new Set<Dagdeel>();
  const tijdvakken = new Set<string>();
  let heeftRegenbestendig = false;
  let heeftOntbijt = false;
  let heeftLateNight = false;
  let heeftReservering = false;
  let heeftGratis = false;

  for (const plaats of plaatsen) {
    if (plaats.attractie) {
      typen.add(plaats.attractie.type);
      for (const d of plaats.attractie.dagdeel ?? []) dagdelen.add(d);
      if (plaats.attractie.regenbestendig) heeftRegenbestendig = true;
    }
    if (plaats.eten) {
      keukens.add(plaats.eten.keuken);
      if (plaats.eten.ontbijt) heeftOntbijt = true;
      if (plaats.eten.lateNight) heeftLateNight = true;
    }
    for (const v of plaats.tijdvakken ?? []) tijdvakken.add(v);
    if (plaats.reservering === 'verplicht') heeftReservering = true;
    if (prijsIsGratis(plaats.prijs)) heeftGratis = true;
  }

  return {
    typen: [...typen].sort(),
    keukens: [...keukens].sort(),
    dagdelen: (['ochtend', 'middag', 'avond', 'nacht'] as Dagdeel[]).filter((d) => dagdelen.has(d)),
    tijdvakken: [...tijdvakken],
    heeftRegenbestendig,
    heeftOntbijt,
    heeftLateNight,
    heeftReservering,
    heeftGratis,
  };
};
