import type { Openingstijden, Plaats, Sluiting, Stad, Weekdag } from '@/domein/schema';
import { WEEKDAGEN, WEEKDAGEN_VANAF_ZONDAG } from '@/domein/schema';
import { datumIn, uurIn } from '@/domein/tijd/zones';
import { leesOsm, osmOp, type Blok, type OsmRegel } from './osm';

export type { Blok } from './osm';

/**
 * Is deze plaats vandaag open, en zo niet, wanneer dan wel?
 *
 * Dit voedt de waarschuwing uit hoofdstuk 2 van de specificatie. Het klassieke
 * geval is een museum dat op maandag dicht is: dat staat in elke reisgids, en
 * toch sta je er een keer voor de deur. De app hoort dat te zeggen op het
 * moment dat je de plaats bekijkt, niet in een voetnoot.
 *
 * "Vandaag" is de dag in de tijdzone van de stad. Sta je in Amsterdam Kyoto te
 * plannen, dan is het daar al morgen, en dan is de sluitingsdag van morgen de
 * relevante. Rekenen met de klok van je eigen toestel geeft precies één dag
 * verschuiving, en dat is de dag dat je voor een dichte deur staat.
 *
 * Er zijn twee soorten tijden. Het eenvoudige formaat (`standaard` en `perDag`)
 * hangt alleen van de weekdag af. De notatie van OpenStreetMap (`osm`) hangt
 * van de datum af, want die kent seizoenen en "de eerste maandag". Alles wat
 * hieronder met een datum werkt, kan met allebei overweg.
 */

/** Hoe een dag in de openingstijden gelezen wordt. */
export type Dagstatus =
  /** Vaste sluitingsdag. */
  | { soort: 'gesloten' }
  /** Open, met de tijden zoals ze er staan. */
  | { soort: 'open'; tijden: string }
  /** Niets ingevuld: de app weet het niet en zegt dat ook. */
  | { soort: 'onbekend' };

/**
 * De status op een weekdag, voor het eenvoudige formaat. Voor tijden in de
 * notatie van OpenStreetMap zegt dit onbekend: die hangen van de datum af, en
 * daarvoor is `tijdenOp`.
 */
export const dagstatus = (tijden: Openingstijden | undefined, dag: Weekdag): Dagstatus => {
  if (!tijden || tijden.osm) return { soort: 'onbekend' };

  const voorDeze = tijden.perDag?.[dag];
  if (voorDeze !== undefined) {
    return voorDeze.trim().toLowerCase() === 'gesloten'
      ? { soort: 'gesloten' }
      : { soort: 'open', tijden: voorDeze };
  }

  if (tijden.standaard) return { soort: 'open', tijden: tijden.standaard };
  return { soort: 'onbekend' };
};

/** De klokblokken uit vrije tekst als "06:00-10:00, 18:00-20:30". */
export const leesBlokken = (tekst: string): Blok[] =>
  [...tekst.matchAll(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/g)].map((b) => ({
    van: Number(b[1]) * 60 + Number(b[2]),
    tot: Number(b[3]) * 60 + Number(b[4]),
  }));

/** Hoe een datum in de openingstijden gelezen wordt. */
export type DagTijden =
  /** Open. Zonder blokken staat er wel een tijd, maar geen klok die de app kan lezen. */
  | { soort: 'open'; blokken: Blok[] }
  /** Dicht, met de reden als het om een sluitingsperiode gaat. */
  | { soort: 'gesloten'; sluiting?: Sluiting }
  | { soort: 'onbekend' };

/** De sluitingsperiode waarin deze datum valt, als die er is. */
export const sluitingOp = (
  plaats: Pick<Plaats, 'sluitingen'>,
  datum: string,
): Sluiting | undefined => plaats.sluitingen?.find((s) => s.van <= datum && datum <= s.tot);

const weekdagVanDatum = (datum: string): Weekdag => {
  const [jaar, maand, dag] = datum.split('-').map(Number);
  return WEEKDAGEN_VANAF_ZONDAG[new Date(Date.UTC(jaar, maand - 1, dag, 12)).getUTCDay()];
};

/**
 * Open of dicht op een datum (YYYY-MM-DD), met de blokken van die dag. Een
 * sluitingsperiode gaat voor alles.
 */
export const tijdenOp = (
  plaats: Pick<Plaats, 'openingstijden' | 'sluitingen'>,
  datum: string,
): DagTijden => {
  const sluiting = sluitingOp(plaats, datum);
  if (sluiting) return { soort: 'gesloten', sluiting };

  const tijden = plaats.openingstijden;
  if (tijden?.osm) {
    const uitkomst = osmOp(leesOsm(tijden.osm), datum);
    return uitkomst.soort === 'open'
      ? { soort: 'open', blokken: uitkomst.blokken }
      : { soort: 'gesloten' };
  }

  const status = dagstatus(tijden, weekdagVanDatum(datum));
  if (status.soort === 'open') return { soort: 'open', blokken: leesBlokken(status.tijden) };
  return status;
};

/** Een blok dat na middernacht doorloopt, zoals een bar tot 02:00. */
export const loptDoor = (blok: Blok): boolean => blok.tot <= blok.van;

/** De datum ervoor, als YYYY-MM-DD. */
export const vorigeDatum = (datum: string): string => {
  const [jaar, maand, dag] = datum.split('-').map(Number);
  return new Date(Date.UTC(jaar, maand - 1, dag - 1, 12)).toISOString().slice(0, 10);
};

/**
 * Regels uit de notatie van OpenStreetMap die elke week terugkomen: zonder
 * periode en zonder "de eerste maandag". Daar komen de vaste sluitingsdagen uit.
 */
const wekelijks = (regels: OsmRegel[]): OsmRegel[] => regels.filter((r) => !r.periode && !r.nde);

/**
 * Alle vaste sluitingsdagen, in de volgorde van de week.
 *
 * Bij tijden in de notatie van OpenStreetMap is een dag een vaste sluitingsdag
 * als hij in geen enkele maand open is. De eerste maandag van de maand of een
 * periode dicht tellen niet mee; die horen bij een datum, niet bij de week.
 */
export const vasteSluitingsdagen = (tijden: Openingstijden | undefined): Weekdag[] => {
  if (tijden?.osm) {
    const regels = wekelijks(leesOsm(tijden.osm));
    return WEEKDAGEN.filter((_, weekdag) => {
      for (let maand = 1; maand <= 12; maand++) {
        // Een willekeurige week in die maand; 2026 begint op een donderdag, dus
        // de eerste maandag van januari is de 5e. Hier telt alleen de weekdag.
        const datum = eersteDagVan(2026, maand, weekdag);
        if (osmOp(regels, datum).soort === 'open') return false;
      }
      return true;
    });
  }
  return WEEKDAGEN.filter((dag) => dagstatus(tijden, dag).soort === 'gesloten');
};

/** De eerste datum in een maand die op deze weekdag valt (0 is maandag). */
const eersteDagVan = (jaar: number, maand: number, weekdag: number): string => {
  const eerste = new Date(Date.UTC(jaar, maand - 1, 1, 12));
  const verschil = (weekdag - ((eerste.getUTCDay() + 6) % 7) + 7) % 7;
  eerste.setUTCDate(1 + verschil);
  return eerste.toISOString().slice(0, 10);
};

/** De weekdag waarop dit moment valt, in de tijdzone van de stad. */
export const weekdagIn = (tijdzone: string, moment: Date): Weekdag =>
  // `datumIn` geeft de kalenderdatum in die zone; die als UTC-middag lezen
  // levert altijd de goede weekdag, ongeacht waar het toestel staat.
  weekdagVanDatum(datumIn(tijdzone, moment));

export interface Sluitingswaarschuwing {
  /** Vandaag dicht. Dit is de melding die telt op het moment zelf. */
  vandaagGesloten: boolean;
  /** De sluitingsperiode waarin vandaag valt, als het daarom dicht is. */
  sluiting?: Sluiting;
  /** Alle vaste sluitingsdagen, ook als er vandaag niets aan de hand is. */
  sluitingsdagen: Weekdag[];
  /** De eerstvolgende sluitingsdag binnen een week, als die er is. */
  volgendeSluiting: { dag: Weekdag; overDagen: number } | null;
  /** Losse tekst uit de content over onregelmatige sluitingen. */
  opmerking?: string;
}

/**
 * De volledige waarschuwing voor één plaats in één stad.
 *
 * Geeft null terug als er niets te melden valt. Dat is met opzet: een plaats
 * zonder sluitingsdagen hoort geen leeg waarschuwingsvakje te krijgen, want dan
 * leert de gebruiker de waarschuwingen wegkijken.
 */
export const sluitingswaarschuwing = (
  plaats: Plaats,
  stad: Stad,
  nu: Date = new Date(),
): Sluitingswaarschuwing | null => {
  const sluitingsdagen = vasteSluitingsdagen(plaats.openingstijden);
  const datum = datumIn(stad.tijdzone, nu);
  const vandaagStatus = tijdenOp(plaats, datum);
  const vandaagGesloten = vandaagStatus.soort === 'gesloten';
  if (sluitingsdagen.length === 0 && !plaats.geslotenOpmerking && !vandaagGesloten) return null;

  const vandaag = weekdagVanDatum(datum);
  const vandaagIndex = WEEKDAGEN.indexOf(vandaag);

  let volgende: { dag: Weekdag; overDagen: number } | null = null;
  for (let over = 1; over <= 7; over++) {
    const dag = WEEKDAGEN[(vandaagIndex + over) % 7];
    if (sluitingsdagen.includes(dag)) {
      volgende = { dag, overDagen: over };
      break;
    }
  }

  return {
    vandaagGesloten,
    sluiting: vandaagStatus.soort === 'gesloten' ? vandaagStatus.sluiting : undefined,
    sluitingsdagen,
    volgendeSluiting: volgende,
    opmerking: plaats.geslotenOpmerking,
  };
};

/**
 * De waarschuwing in één zin, klaar om te tonen.
 *
 * Bewust kort: op straat lees je geen alinea. Het onderscheid dat ertoe doet is
 * of het nu speelt of pas later deze week.
 */
export const waarschuwingstekst = (waarschuwing: Sluitingswaarschuwing): string => {
  if (waarschuwing.sluiting) return 'Tijdelijk gesloten';
  if (waarschuwing.vandaagGesloten) return 'Vandaag gesloten';
  if (waarschuwing.volgendeSluiting?.overDagen === 1) {
    return `Morgen gesloten (${waarschuwing.volgendeSluiting.dag})`;
  }
  if (waarschuwing.sluitingsdagen.length > 0) {
    return `Dicht op ${waarschuwing.sluitingsdagen.join(' en ')}`;
  }
  return 'Let op de openingstijden';
};

/** Minuten na middernacht in deze zone. */
export const minutenIn = (tijdzone: string, moment: Date): number =>
  uurIn(tijdzone, moment) * 60 +
  Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: tijdzone, minute: '2-digit' }).format(moment),
  );

/**
 * Open op een wandklokmoment: een datum en een tijd in minuten. Kijkt ook naar
 * de dag ervoor, want een bar die vrijdag tot 02:00 open is, is dat zaterdag
 * om 01:00 nog steeds. Null als de tijden geen klok hebben die de app kan lezen.
 */
export const openOp = (
  plaats: Pick<Plaats, 'openingstijden' | 'sluitingen'>,
  datum: string,
  minuten: number,
): boolean | null => {
  const gisteren = tijdenOp(plaats, vorigeDatum(datum));
  if (gisteren.soort === 'open' && gisteren.blokken.some((b) => loptDoor(b) && minuten < b.tot)) {
    return true;
  }

  const vandaag = tijdenOp(plaats, datum);
  if (vandaag.soort === 'gesloten') return false;
  if (vandaag.soort === 'onbekend' || vandaag.blokken.length === 0) return null;
  return vandaag.blokken.some((b) =>
    loptDoor(b) ? minuten >= b.van : minuten >= b.van && minuten < b.tot,
  );
};

/**
 * Is het nu open? Null zodra het niet eenduidig is: tijden zonder klok
 * ("Zonsopgang tot zonsondergang"), of geen tijden. Dan toont het scherm de
 * tijden en beslist de gebruiker; een gok zou een zekerheid suggereren die er
 * niet is.
 */
export const nuOpen = (plaats: Plaats, stad: Stad, nu: Date = new Date()): boolean | null =>
  openOp(plaats, datumIn(stad.tijdzone, nu), minutenIn(stad.tijdzone, nu));

/** Een aanvangstijd als "16:10" in minuten na middernacht. */
export const klokMinuten = (klok: string): number => {
  const [uur, minuut] = klok.split(':').map(Number);
  return uur * 60 + minuut;
};

/**
 * De eerstvolgende voorstelling vanaf dit moment, in minuten na middernacht.
 * Null als er vandaag geen meer is, of als de plek geen voorstellingen heeft.
 */
export const volgendeVoorstelling = (
  plaats: Pick<Plaats, 'voorstellingen'>,
  vanaf: number,
): number | null => {
  const tijden = (plaats.voorstellingen ?? []).map(klokMinuten).sort((a, b) => a - b);
  return tijden.find((t) => t >= vanaf) ?? null;
};

/**
 * De sluitingsperiode die over een van deze datums valt, zoals je dagen in een
 * stad. Voor het label "Tijdelijk gesloten".
 */
export const sluitingTijdens = (
  plaats: Pick<Plaats, 'sluitingen'>,
  datums: string[],
): Sluiting | undefined =>
  plaats.sluitingen?.find((s) => datums.some((d) => s.van <= d && d <= s.tot));
