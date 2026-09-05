import type { Openingstijden, Plaats, Stad, Weekdag } from '@/domein/schema';
import { WEEKDAGEN, WEEKDAGEN_VANAF_ZONDAG } from '@/domein/schema';
import { datumIn, uurIn } from '@/domein/tijd/zones';

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
 */

/** Hoe een dag in de openingstijden gelezen wordt. */
export type Dagstatus =
  /** Vaste sluitingsdag. */
  | { soort: 'gesloten' }
  /** Open, met de tijden zoals ze er staan. */
  | { soort: 'open'; tijden: string }
  /** Niets ingevuld: de app weet het niet en zegt dat ook. */
  | { soort: 'onbekend' };

export const dagstatus = (tijden: Openingstijden | undefined, dag: Weekdag): Dagstatus => {
  if (!tijden) return { soort: 'onbekend' };

  const voorDeze = tijden.perDag?.[dag];
  if (voorDeze !== undefined) {
    return voorDeze.trim().toLowerCase() === 'gesloten'
      ? { soort: 'gesloten' }
      : { soort: 'open', tijden: voorDeze };
  }

  if (tijden.standaard) return { soort: 'open', tijden: tijden.standaard };
  return { soort: 'onbekend' };
};

/** Alle vaste sluitingsdagen, in de volgorde van de week. */
export const vasteSluitingsdagen = (tijden: Openingstijden | undefined): Weekdag[] =>
  WEEKDAGEN.filter((dag) => dagstatus(tijden, dag).soort === 'gesloten');

/** De weekdag waarop dit moment valt, in de tijdzone van de stad. */
export const weekdagIn = (tijdzone: string, moment: Date): Weekdag => {
  // `datumIn` geeft de kalenderdatum in die zone; die als UTC-middag lezen
  // levert altijd de goede weekdag, ongeacht waar het toestel staat.
  const [jaar, maand, dag] = datumIn(tijdzone, moment).split('-').map(Number);
  return WEEKDAGEN_VANAF_ZONDAG[new Date(Date.UTC(jaar, maand - 1, dag, 12)).getUTCDay()];
};

export interface Sluitingswaarschuwing {
  /** Vandaag dicht. Dit is de melding die telt op het moment zelf. */
  vandaagGesloten: boolean;
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
  if (sluitingsdagen.length === 0 && !plaats.geslotenOpmerking) return null;

  const vandaag = weekdagIn(stad.tijdzone, nu);
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
    vandaagGesloten: sluitingsdagen.includes(vandaag),
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
  if (waarschuwing.vandaagGesloten) return 'Vandaag gesloten';
  if (waarschuwing.volgendeSluiting?.overDagen === 1) {
    return `Morgen gesloten (${waarschuwing.volgendeSluiting.dag})`;
  }
  if (waarschuwing.sluitingsdagen.length > 0) {
    return `Dicht op ${waarschuwing.sluitingsdagen.join(' en ')}`;
  }
  return 'Let op de openingstijden';
};

/**
 * Een ruwe schatting of het nu open is, op basis van de eerste tijd in de reeks.
 *
 * Met opzet ruw. De tijden in de content zijn vrije tekst ("06:00-17:00", maar
 * ook "Zonsopgang tot zonsondergang"), en doen alsof daar een sluitend
 * antwoord uit komt zou een zekerheid suggereren die er niet is. Levert dus
 * null zodra het niet eenduidig is, en dan toont het scherm gewoon de tijden.
 */
export const nuOpen = (plaats: Plaats, stad: Stad, nu: Date = new Date()): boolean | null => {
  const status = dagstatus(plaats.openingstijden, weekdagIn(stad.tijdzone, nu));
  if (status.soort === 'gesloten') return false;
  if (status.soort === 'onbekend') return null;

  const blokken = [...status.tijden.matchAll(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/g)];
  if (blokken.length === 0) return null;

  const minuten = uurIn(stad.tijdzone, nu) * 60 + minutenIn(stad.tijdzone, nu);
  return blokken.some((blok) => {
    const van = Number(blok[1]) * 60 + Number(blok[2]);
    const tot = Number(blok[3]) * 60 + Number(blok[4]);
    // Een blok dat over middernacht heen loopt, zoals een izakaya tot 02:00.
    return tot >= van ? minuten >= van && minuten < tot : minuten >= van || minuten < tot;
  });
};

const minutenIn = (tijdzone: string, moment: Date): number =>
  Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: tijdzone, minute: '2-digit' }).format(moment),
  );
