import type { Coordinaat, Reisschema, Stad } from '@/domein/schema';
import { afstandKm } from '@/domein/geo/afstand';
import { datumIn, volgendeMiddernacht } from '@/domein/tijd/zones';

/**
 * Welke stad staat er bovenaan?
 *
 * Hoofdstuk 1 van de specificatie, als één pure functie. Alles wat de app over
 * je situatie weet gaat erin, en er komt uit welke stad of steden bovenaan
 * horen en of daar een keuzebalk bij hoort. Geen opslag, geen netwerk, geen
 * React: dat maakt hem volledig testbaar, en dat is nodig, want dit is de plek
 * waar een fout betekent dat je in Kyoto naar Tokio zit te kijken.
 *
 * Het uitgangspunt dat nergens gebroken mag worden: dit bepaalt alleen welke
 * stad prominent staat. Elke stad blijft altijd volledig te openen, ook de stad
 * aan de andere kant van de wereld.
 */

/** Wat de gebruiker zelf heeft aangewezen. Blijft staan tot het vervalt. */
export interface Keuze {
  stadId: string;
  /** Bij een reisdag met ochtend in stad A en avond in stad B. */
  tweedeStadId?: string;
  /**
   * Handmatig vastgezet zonder dat er een conflict was, bijvoorbeeld om vanuit
   * Tokio alvast Hiroshima voor te bereiden. Krijgt een label op het scherm,
   * zodat duidelijk is dat de automatische logica uitstaat.
   */
  vastgezet: boolean;
  /** Tot wanneer deze keuze geldt, als ISO-moment. */
  vervaltOp: string;
}

export interface Invoer {
  steden: Stad[];
  reisschema: Reisschema;
  /** De GPS-positie, als die er is. Ontbreken is een normale toestand. */
  positie?: Coordinaat;
  keuze?: Keuze;
  /** De laatste stad die de gebruiker heeft geopend; de laatste redding. */
  laatstBekekenStadId?: string;
  nu?: Date;
}

export type Reden =
  /** GPS en reisschema wijzen dezelfde stad aan. */
  | 'gps-en-schema'
  /** Alleen GPS wist het. */
  | 'gps'
  /** Alleen het reisschema wist het. */
  | 'schema'
  /** De gebruiker heeft gekozen uit twee steden die niet overeenkwamen. */
  | 'keuze'
  /** De gebruiker heeft een stad vastgezet zonder dat er iets botste. */
  | 'vastgezet'
  /** Niets wist het; dit is de laatst geopende stad. */
  | 'laatst-bekeken'
  /** Zelfs dat niet; dit is gewoon de eerste stad uit de lijst. */
  | 'eerste';

export interface Uitkomst {
  /** De stad die bovenaan komt. Altijd gevuld zolang er steden zijn. */
  stadId: string | null;
  /** De tweede stad, bij een reisdag waarop je er twee wilt zien. */
  tweedeStadId?: string;
  reden: Reden;
  /**
   * De twee steden waaruit gekozen moet worden. Alleen gevuld als GPS en
   * reisschema het oneens zijn en de gebruiker nog niet gekozen heeft.
   */
  conflict?: { gpsStadId: string; schemaStadId: string };
  /** Toont het label "vastgezet" op het scherm. */
  vastgezet: boolean;
}

/**
 * In welke stad ben je volgens GPS? De dichtstbijzijnde stad waarvan je binnen
 * de straal zit. Zit je nergens binnen (in de trein tussen twee steden, of
 * gewoon thuis in Nederland), dan is het antwoord niets, en dat is prima.
 */
export const stadVolgensGps = (steden: Stad[], positie: Coordinaat): Stad | null => {
  let beste: { stad: Stad; km: number } | null = null;
  for (const stad of steden) {
    const km = afstandKm(positie, stad.centrum);
    if (km <= stad.straalKm && (beste === null || km < beste.km)) beste = { stad, km };
  }
  return beste?.stad ?? null;
};

/**
 * Welke stad is er volgens het reisschema vandaag aan de beurt?
 *
 * "Vandaag" is de dag in de tijdzone van de stad zelf, niet die van het
 * toestel. Segmenten zonder datums tellen niet mee: het schema mag half
 * ingevuld zijn zonder dat de app daarop vastloopt.
 *
 * Staan er meerdere segmenten op dezelfde dag, dan wint het eerste. Dat is de
 * reisdag met een ochtend in stad A en een avond in stad B; de gebruiker kan er
 * met één tik beide van maken.
 */
export const stadVolgensSchema = (
  steden: Stad[],
  reisschema: Reisschema,
  nu: Date,
): { stad: Stad; volgende?: Stad } | null => {
  const perId = new Map(steden.map((s) => [s.id, s]));
  const treffers: Stad[] = [];

  for (const segment of reisschema.segmenten) {
    if (!segment.van || !segment.tot) continue;
    const stad = perId.get(segment.stad);
    if (!stad) continue;
    const vandaag = datumIn(stad.tijdzone, nu);
    if (segment.van <= vandaag && vandaag <= segment.tot) treffers.push(stad);
  }

  if (treffers.length === 0) return null;
  return { stad: treffers[0], volgende: treffers[1] };
};

/** Is deze keuze nog geldig, of is hij over de middernachtgrens gegaan? */
export const keuzeGeldig = (keuze: Keuze | undefined, nu: Date): keuze is Keuze =>
  keuze !== undefined && Date.parse(keuze.vervaltOp) > nu.getTime();

/**
 * Maakt een keuze die geldt tot middernacht in de tijdzone van de gekozen stad.
 *
 * Waarom niet de tijdzone van het toestel: op de dag dat je van Hanoi naar
 * Tokio vliegt springt de telefoon om, en dan zou de keuze die je bij het
 * instappen maakte al vervallen zijn voordat je landt.
 */
export const maakKeuze = (
  stad: Stad,
  opties: { tweedeStadId?: string; vastgezet?: boolean; nu?: Date } = {},
): Keuze => ({
  stadId: stad.id,
  tweedeStadId: opties.tweedeStadId,
  vastgezet: opties.vastgezet ?? false,
  vervaltOp: volgendeMiddernacht(stad.tijdzone, opties.nu ?? new Date()).toISOString(),
});

/**
 * De hele beslisboom uit hoofdstuk 1, in de volgorde waarin hij hoort te lopen.
 */
export const bepaalHighlight = (invoer: Invoer): Uitkomst => {
  const { steden, reisschema, positie, keuze, laatstBekekenStadId } = invoer;
  const nu = invoer.nu ?? new Date();

  if (steden.length === 0) return { stadId: null, reden: 'eerste', vastgezet: false };

  const bestaat = (id: string | undefined): id is string =>
    id !== undefined && steden.some((s) => s.id === id);

  // 1. Een geldige eigen keuze wint van alles. Die blijft staan tot
  //    middernacht, zodat de highlight niet terugspringt tijdens een treinreis.
  if (keuzeGeldig(keuze, nu) && bestaat(keuze.stadId)) {
    return {
      stadId: keuze.stadId,
      tweedeStadId: bestaat(keuze.tweedeStadId) ? keuze.tweedeStadId : undefined,
      reden: keuze.vastgezet ? 'vastgezet' : 'keuze',
      vastgezet: keuze.vastgezet,
    };
  }

  const gps = positie ? stadVolgensGps(steden, positie) : null;
  const schema = stadVolgensSchema(steden, reisschema, nu);

  // 2. Beide bronnen zijn het eens: zonder verdere melding highlighten.
  if (gps && schema && gps.id === schema.stad.id) {
    return { stadId: gps.id, reden: 'gps-en-schema', vastgezet: false };
  }

  // 3. Beide bronnen weten iets, maar iets anders. Dan de keuzebalk, met de
  //    stad waar je volgens GPS werkelijk bent voorlopig bovenaan.
  if (gps && schema) {
    return {
      stadId: gps.id,
      reden: 'gps',
      conflict: { gpsStadId: gps.id, schemaStadId: schema.stad.id },
      vastgezet: false,
    };
  }

  // 4. Eén van de twee weet iets. Zonder GPS het schema, zonder schema de GPS.
  if (gps) return { stadId: gps.id, reden: 'gps', vastgezet: false };
  if (schema) {
    // Twee segmenten op dezelfde dag is een reisdag. Dat is geen conflict maar
    // een aanbod: laat beide steden zien als de gebruiker dat wil.
    return {
      stadId: schema.stad.id,
      reden: 'schema',
      conflict: schema.volgende
        ? { gpsStadId: schema.stad.id, schemaStadId: schema.volgende.id }
        : undefined,
      vastgezet: false,
    };
  }

  // 5. Geen van beide. Dan de stad die je het laatst open had.
  if (bestaat(laatstBekekenStadId)) {
    return { stadId: laatstBekekenStadId, reden: 'laatst-bekeken', vastgezet: false };
  }

  // 6. Eerste keer, geen bereik, geen datums. Gewoon de eerste stad.
  const eerste = [...steden].sort((a, b) => a.volgorde - b.volgorde)[0];
  return { stadId: eerste.id, reden: 'eerste', vastgezet: false };
};
