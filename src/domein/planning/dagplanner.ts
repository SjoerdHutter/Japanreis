import type { Plaats, Stad, Weekdag } from '@/domein/schema';
import { afstandKm } from '@/domein/geo/afstand';
import { looptijdMinuten } from '@/domein/filters/plaatsen';
import { dagstatus, vasteSluitingsdagen, weekdagIn } from '@/domein/openingstijden/status';

/**
 * De slimme dagplanner uit hoofdstuk 12.
 *
 * Bouwt een dag uit de punten die je hebt gekozen, op basis van de looproute en
 * de openingstijden, met een waarschuwing bij sluitingsdagen.
 *
 * De volgorde komt uit een naaste-buur route: begin bij het startpunt, loop
 * telkens naar het dichtstbijzijnde punt dat nog over is. Dat is niet de
 * kortst mogelijke route (dat probleem is niet in redelijke tijd op te lossen
 * en het verschil is op stadsschaal klein), maar het scheelt in de praktijk
 * uren heen en weer lopen ten opzichte van de volgorde waarin je ze aanvinkte.
 *
 * Wat de planner niet doet is doen alsof hij het weet. Openingstijden in de
 * content zijn vrije tekst, en waar er geen klok uit te halen valt komt er geen
 * tijdvenster maar een opmerking.
 */

/** Hoeveel minuten je gemiddeld kwijt bent aan een bezoek zonder opgegeven duur. */
const STANDAARD_DUUR = 60;

export interface Stop {
  plaats: Plaats;
  /** Wanneer je er aankomt, in minuten na middernacht. */
  aankomst: number;
  /** Wanneer je weer weggaat. */
  vertrek: number;
  /** Hoeveel minuten lopen vanaf de vorige stop. */
  looptijd: number;
  /** Wat er mis is met deze stop op deze dag. */
  waarschuwingen: string[];
}

export interface Dagplan {
  datum: string;
  stops: Stop[];
  /** Punten die niet meer in de dag pasten. */
  nietGepland: Plaats[];
  /** Waarschuwingen over de dag als geheel. */
  waarschuwingen: string[];
  /** Totale looptijd tussen de stops, in minuten. */
  looptijdTotaal: number;
}

const bezoekduur = (plaats: Plaats): number =>
  plaats.attractie?.bezoekduurMinuten ?? (plaats.categorie === 'eten' ? 45 : STANDAARD_DUUR);

/**
 * De eerste openingstijd en de laatste sluitingstijd van een dag, in minuten.
 *
 * Null als er geen klok uit de tekst te halen valt. Dat is vaker dan je denkt:
 * "Dag en nacht open" en "Zonsopgang tot zonsondergang" staan allebei in de
 * content, en daar een getal van maken zou een precisie voorwenden die er niet is.
 */
export const venster = (plaats: Plaats, dag: Weekdag): { van: number; tot: number } | null => {
  const status = dagstatus(plaats.openingstijden, dag);
  if (status.soort !== 'open') return null;

  const blokken = [...status.tijden.matchAll(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/g)];
  if (blokken.length === 0) return null;

  const vanaf = blokken.map((b) => Number(b[1]) * 60 + Number(b[2]));
  const tot = blokken.map((b) => Number(b[3]) * 60 + Number(b[4]));
  return { van: Math.min(...vanaf), tot: Math.max(...tot) };
};

/**
 * De route: naaste buur vanaf het startpunt.
 *
 * Exporteerbaar omdat het los te testen is, en omdat het scherm hem ook zonder
 * tijden wil kunnen tonen.
 */
export const looproute = (plaatsen: Plaats[], start?: Plaats): Plaats[] => {
  if (plaatsen.length === 0) return [];

  const over = [...plaatsen];
  const route: Plaats[] = [];

  // Zonder startpunt beginnen we bij het punt dat het vroegst opengaat, want
  // dat is de enige stop waarvoor de tijd echt knelt.
  let huidig = start ?? over[0];
  if (!start) {
    const index = over.indexOf(huidig);
    over.splice(index, 1);
    route.push(huidig);
  }

  while (over.length > 0) {
    let besteIndex = 0;
    let besteAfstand = Number.POSITIVE_INFINITY;
    for (const [i, kandidaat] of over.entries()) {
      const km = afstandKm(huidig.coordinaten, kandidaat.coordinaten);
      if (km < besteAfstand) {
        besteAfstand = km;
        besteIndex = i;
      }
    }
    huidig = over.splice(besteIndex, 1)[0];
    route.push(huidig);
  }

  return route;
};

export interface PlanInvoer {
  plaatsen: Plaats[];
  stad: Stad;
  /** De dag waarvoor je plant, als YYYY-MM-DD. */
  datum: string;
  /** Wanneer je begint, als minuten na middernacht. */
  startMinuten: number;
  /** Wanneer je klaar wilt zijn. */
  eindMinuten: number;
}

/**
 * Bouwt de dag.
 *
 * Loopt de route af en schuift elke stop op tot hij binnen de openingstijden
 * past. Wat er niet meer in past komt apart te staan in plaats van stilletjes
 * te verdwijnen: dan zie je zelf of je iets wilt laten vallen of een dag wilt
 * verschuiven.
 */
export const maakDagplan = (invoer: PlanInvoer): Dagplan => {
  const { plaatsen, stad, datum, startMinuten, eindMinuten } = invoer;

  // De weekdag van de gekozen datum, in de tijdzone van de stad. Bij plannen
  // vanaf de bank is het daar vaak al morgen, en dan is de sluitingsdag van
  // morgen de relevante.
  const dag = weekdagIn(stad.tijdzone, new Date(`${datum}T12:00:00Z`));

  const route = looproute(plaatsen);
  const stops: Stop[] = [];
  const nietGepland: Plaats[] = [];
  const waarschuwingen: string[] = [];

  let klok = startMinuten;
  let vorige: Plaats | null = null;
  let looptijdTotaal = 0;

  for (const plaats of route) {
    const looptijd = vorige ? looptijdMinuten(vorige.coordinaten, plaats.coordinaten) : 0;
    const stopWaarschuwingen: string[] = [];

    // Vandaag dicht: niet inplannen, wel melden. Anders sta je er.
    if (vasteSluitingsdagen(plaats.openingstijden).includes(dag)) {
      nietGepland.push(plaats);
      waarschuwingen.push(`${plaats.naam} is op ${dag} gesloten.`);
      continue;
    }

    let aankomst = klok + looptijd;
    const raam = venster(plaats, dag);

    if (raam) {
      // Te vroeg: wachten tot de deur opengaat.
      if (aankomst < raam.van) {
        stopWaarschuwingen.push(`Gaat pas om ${alsKlok(raam.van)} open, dus je wacht even.`);
        aankomst = raam.van;
      }
      // Te laat: dan past hij vandaag niet meer.
      if (aankomst >= raam.tot) {
        nietGepland.push(plaats);
        waarschuwingen.push(
          `${plaats.naam} sluit om ${alsKlok(raam.tot)}; op deze route kom je er te laat aan.`,
        );
        continue;
      }
    } else if (plaats.openingstijden) {
      stopWaarschuwingen.push('De openingstijden staan niet als klok in de app; kijk ze na.');
    }

    const duur = bezoekduur(plaats);
    let vertrek = aankomst + duur;

    if (raam && vertrek > raam.tot) {
      stopWaarschuwingen.push(
        `Je hebt maar tot ${alsKlok(raam.tot)}, korter dan de ${duur} minuten die dit meestal kost.`,
      );
      vertrek = raam.tot;
    }

    if (aankomst >= eindMinuten) {
      nietGepland.push(plaats);
      continue;
    }
    if (vertrek > eindMinuten) {
      stopWaarschuwingen.push('Dit loopt over het einde van je dag heen.');
    }

    if (plaats.reservering === 'verplicht') {
      stopWaarschuwingen.push('Reserveren is hier verplicht; regel dat vooraf.');
    }

    stops.push({ plaats, aankomst, vertrek, looptijd, waarschuwingen: stopWaarschuwingen });
    looptijdTotaal += looptijd;
    klok = vertrek;
    vorige = plaats;
  }

  if (stops.length > 0 && klok > eindMinuten) {
    waarschuwingen.push(
      `Deze dag loopt tot ${alsKlok(klok)}, later dan de ${alsKlok(eindMinuten)} die je aangaf.`,
    );
  }

  return { datum, stops, nietGepland, waarschuwingen, looptijdTotaal };
};

/** Minuten na middernacht als "HH:MM". */
export const alsKlok = (minuten: number): string => {
  const genormaliseerd = ((Math.round(minuten) % 1440) + 1440) % 1440;
  return `${String(Math.floor(genormaliseerd / 60)).padStart(2, '0')}:${String(genormaliseerd % 60).padStart(2, '0')}`;
};
