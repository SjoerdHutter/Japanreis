import type { Reisschema, Stad } from '@/domein/schema';
import { alsMinuten } from '@/domein/planning/overstap';
import { datumIn, utcOffsetMinuten } from '@/domein/tijd/zones';

/**
 * Het jetlagplan: per dag wanneer je slaapt, en wanneer je licht zoekt of juist
 * mijdt.
 *
 * Licht is het sterkste middel dat er is, en ook het verraderlijkste. Je
 * lichaamsklok heeft een dieptepunt, het koudste moment van de nacht, ergens in
 * de vroege ochtend. Licht in de uren daarna zet de klok vooruit; licht in de
 * uren ervoor zet hem terug. Wie na een vlucht naar het oosten meteen de
 * ochtendzon in loopt terwijl zijn lichaam nog midden in de nacht zit, duwt zijn
 * klok de verkeerde kant op en is een week later nog steeds moe. Daarom rekent
 * dit plan per dag uit waar dat dieptepunt ligt, in de tijd van de plek waar je
 * die dag bent.
 *
 * Het model is met opzet eenvoudig en voorzichtig:
 *
 * 1. Je klok schuift ongeveer een uur per dag naar het oosten en anderhalf uur
 *    naar het westen. Dat zijn de gangbare getallen uit het werk van Eastman en
 *    Burgess (How to travel the world without jet lag, Sleep Medicine Clinics,
 *    2009). Wie het perfect doet haalt soms meer, maar een plan dat te snel
 *    rekent stuurt je de dag erna naar licht op het verkeerde moment.
 * 2. Op reisdagen schuift de klok in het model niet. Op een dag met een vlucht
 *    heb je het licht niet in de hand.
 * 3. Voor een reis naar het oosten kun je thuis al beginnen, door elke dag een
 *    uur eerder te gaan slapen en op te staan, met direct fel licht. Ook dat komt
 *    van Eastman en Burgess.
 *
 * Alles rekent in minuten en in verschillen met UTC, niet in datums. Zo telt de
 * zomertijd thuis vanzelf mee: op 25 oktober 2026 gaat de klok in Nederland een
 * uur terug, en dan moet je lichaam op de terugweg acht uur schuiven in plaats
 * van zeven.
 */

/** Waar je woont. De reis begint en eindigt hier. */
export const THUIS_TIJDZONE = 'Europe/Amsterdam';

/**
 * Hoe ver het dieptepunt van je lichaamstemperatuur voor je gewone wektijd ligt.
 *
 * Een schatting en geen meting: bij de meeste mensen ligt het twee tot drie uur
 * voor het wakker worden. Alle lichttijden hangen hieraan.
 */
export const DIEPTEPUNT_VOOR_WEKTIJD = 180;

/** Hoe lang het licht voor en na het dieptepunt het sterkst meetelt. */
export const LICHTVENSTER = 240;

/** Hoeveel je klok per dag schuift, naar het oosten en naar het westen. */
export const PER_DAG_OOST = 60;
export const PER_DAG_WEST = 90;

/** Meer dan drie dagen voorbereiden legt je thuis te veel op voor te weinig winst. */
export const MAX_VOORBEREIDING = 3;

/**
 * Hoe lang voor het slapengaan de laatste koffie. Cafeïne is na vijf uur pas
 * voor de helft uit je bloed, en koffie zes uur voor bedtijd kost aantoonbaar
 * slaap. Acht uur is aan de veilige kant.
 */
export const CAFEINE_VOOR_BEDTIJD = 8 * 60;

/** Binnen een half uur van de lokale tijd telt je klok als gelijk. */
const AANGEPAST_BINNEN = 30;

/** Hoe lang het plan na thuiskomst doorloopt, ook als je dan nog niet gelijk loopt. */
const MAX_DAGEN_THUIS = 14;

/** Een venster korter dan dit is geen advies maar een afrondingsrestje. */
const KORTSTE_VENSTER = 15;

/** Hoe lang je op een dag zonder bed wakker bent, voor het afknippen van de vensters. */
const WAKKER_ZONDER_BED = 17 * 60;

export interface JetlagInstellingen {
  /** Hoe laat je thuis gewoonlijk gaat slapen, als "HH:MM". */
  bedtijd: string;
  /** Hoe laat je thuis gewoonlijk opstaat, als "HH:MM". */
  wektijd: string;
  /** Hoeveel dagen je thuis al begint met verschuiven, van 0 tot en met 3. */
  voorbereidingsdagen: number;
  /** Of melatonine in het plan staat. Standaard niet: dat is jouw keuze. */
  melatonine: boolean;
}

export const STANDAARD_INSTELLINGEN: JetlagInstellingen = {
  bedtijd: '23:00',
  wektijd: '07:00',
  voorbereidingsdagen: MAX_VOORBEREIDING,
  melatonine: false,
};

export type Dagsoort = 'voorbereiding' | 'vertrek' | 'bestemming' | 'terugreis' | 'thuis';

export type Richting = 'vervroegen' | 'verlaten' | 'geen';

/** Een tijdvak op één dag, in minuten na middernacht in de lokale tijd. */
export interface Venster {
  van: number;
  /** Kan voorbij 1440 lopen als het venster over middernacht heen gaat. */
  tot: number;
  /** Het venster loopt al vanaf het opstaan; dan zegt "tot 09:00" meer dan twee tijden. */
  vanafOpstaan: boolean;
}

export interface Jetlagdag {
  datum: string;
  soort: Dagsoort;
  /** Bij een voorbereidingsdag: de hoeveelste, vanaf 1. */
  volgnummer?: number;
  /** De tijdzone waarin alle tijden van deze dag staan. */
  tijdzone: string;
  /** De steden uit het reisschema op deze dag. Leeg als je thuis bent. */
  stadIds: string[];
  /** Hoeveel minuten je klok aan het begin van de dag nog moet schuiven. Positief is vervroegen. */
  achterstand: number;
  richting: Richting;
  aangepast: boolean;
  /** Het geschatte dieptepunt van je lichaamstemperatuur, in lokale tijd. */
  dieptepunt: number;
  /** Leeg op een dag waarop je uit een vliegtuig stapt of erin: dan bepaalt de vlucht het. */
  opstaan: number | null;
  naarBed: number | null;
  lichtZoeken: Venster | null;
  lichtMijden: Venster | null;
  cafeineTot: number | null;
  melatonine: number | null;
  /** De nacht na deze dag breng je in het vliegtuig door. */
  nachtvlucht: boolean;
  /** Je komt deze ochtend aan na een nacht in het vliegtuig. */
  naNachtvlucht: boolean;
}

export interface Jetlagplan {
  thuis: string;
  /** De dag dat je van huis vertrekt: de dag voor de eerste dag in het reisschema. */
  vertrekdag: string;
  /** De eerste dag weer thuis: de dag na de laatste dag in het reisschema. */
  thuiskomst: string;
  /** De tijdzone waar je de meeste dagen bent. */
  hoofdbestemming: string;
  /** Hoeveel minuten de hoofdbestemming voorloopt op thuis bij vertrek. */
  verschilHeen: number;
  /** Hoeveel minuten thuis voorloopt op de plek waar je vertrekt; negatief is achter. */
  verschilTerug: number;
  heen: Jetlagdag[];
  terug: Jetlagdag[];
  /** Een wisseling van zomer- of wintertijd thuis tijdens de terugweg. */
  klokWisselThuis: { datum: string; minuten: number } | null;
}

export interface JetlagInvoer {
  reisschema: Reisschema;
  steden: Pick<Stad, 'id' | 'tijdzone'>[];
  instellingen: JetlagInstellingen;
  /** Standaard Amsterdam. */
  thuis?: string;
}

const DAG_MS = 86_400_000;

/** Een kalenderdatum een aantal dagen verder, of terug bij een negatief getal. */
export const plusDagen = (datum: string, dagen: number): string =>
  new Date(Date.parse(`${datum}T00:00:00Z`) + dagen * DAG_MS).toISOString().slice(0, 10);

/** Het verschil met UTC op een dag. Op het middaguur, want de zomertijd wisselt 's nachts. */
const verschilOp = (tijdzone: string, datum: string): number =>
  utcOffsetMinuten(tijdzone, new Date(`${datum}T12:00:00Z`));

/** Minuten terug binnen een etmaal, ook bij een negatief getal. */
const rond = (minuten: number): number => ((minuten % 1440) + 1440) % 1440;

/**
 * Een verschil tussen twee klokken, de korte kant op: tussen min en plus twaalf
 * uur. Zeven uur vooruit is nooit zeventien uur achteruit.
 */
const kortsteKant = (minuten: number): number => rond(minuten + 720) - 720;

interface Reisdag {
  tijdzone: string;
  stadIds: string[];
  /** Het reisschema zegt met zoveel woorden dat je hier niet slaapt. */
  zonderBed: boolean;
}

/** Een dag zoals hij uit de segmenten komt, voordat de gaten zijn gevuld. */
interface RuweDag {
  tijdzones: string[];
  stadIds: string[];
  /** Een segment op deze dag zegt nul nachten. */
  nulNachten: boolean;
  /** Een segment op deze dag zegt dat je er wel slaapt. */
  welNachten: boolean;
}

/**
 * Elke dag van de reis met de tijdzone waar je dan bent.
 *
 * Staan er op één dag twee steden, dan telt de eerste uit het reisschema: daar
 * word je wakker. Een dag die tussen twee segmenten in valt hoort gewoon bij de
 * reis; je bent dan waar je de dag ervoor was.
 */
const leesReisdagen = (
  reisschema: Reisschema,
  steden: Pick<Stad, 'id' | 'tijdzone'>[],
): Map<string, Reisdag> => {
  const ruw = new Map<string, RuweDag>();

  for (const segment of reisschema.segmenten) {
    const stad = steden.find((s) => s.id === segment.stad);
    if (!stad || segment.van === undefined || segment.tot === undefined) continue;
    for (let datum = segment.van; datum <= segment.tot; datum = plusDagen(datum, 1)) {
      const dag: RuweDag = ruw.get(datum) ?? {
        tijdzones: [],
        stadIds: [],
        nulNachten: false,
        welNachten: false,
      };
      dag.tijdzones.push(stad.tijdzone);
      if (!dag.stadIds.includes(stad.id)) dag.stadIds.push(stad.id);
      if (segment.verblijf?.nachten === 0) dag.nulNachten = true;
      if ((segment.verblijf?.nachten ?? 0) > 0) dag.welNachten = true;
      ruw.set(datum, dag);
    }
  }

  const datums = [...ruw.keys()].sort();
  const dagen = new Map<string, Reisdag>();
  if (datums.length === 0) return dagen;

  let vorige: Reisdag | null = null;
  for (let datum = datums[0]; datum <= datums[datums.length - 1]; datum = plusDagen(datum, 1)) {
    const deze = ruw.get(datum);
    const dag: Reisdag = deze
      ? {
          tijdzone: deze.tijdzones[0],
          stadIds: deze.stadIds,
          zonderBed: deze.nulNachten && !deze.welNachten,
        }
      : { ...vorige!, zonderBed: false };
    dagen.set(datum, dag);
    vorige = dag;
  }
  return dagen;
};

/** De tijdzone waar je de meeste dagen doorbrengt; daar stuurt de voorbereiding naartoe. */
const hoofdbestemmingVan = (dagen: Map<string, Reisdag>): string => {
  const telling = new Map<string, number>();
  for (const dag of dagen.values()) {
    telling.set(dag.tijdzone, (telling.get(dag.tijdzone) ?? 0) + 1);
  }
  let beste = '';
  let meeste = 0;
  for (const [tijdzone, aantal] of telling) {
    if (aantal > meeste) {
      beste = tijdzone;
      meeste = aantal;
    }
  }
  return beste;
};

/**
 * Een venster rond het dieptepunt afknippen op de uren dat je wakker bent.
 *
 * Licht mijden terwijl je slaapt gaat vanzelf, en licht zoeken om vier uur 's
 * nachts vraagt niemand van je. Wat overblijft is het deel waarin je echt iets
 * moet doen.
 */
const knip = (van: number, wakkerVan: number, wakkerTot: number): Venster | null => {
  let beste: { van: number; tot: number } | null = null;
  for (const verschuiving of [-1440, 0, 1440]) {
    const begin = Math.max(van + verschuiving, wakkerVan);
    const eind = Math.min(van + verschuiving + LICHTVENSTER, wakkerTot);
    if (eind - begin > (beste ? beste.tot - beste.van : 0)) beste = { van: begin, tot: eind };
  }
  if (!beste || beste.tot - beste.van < KORTSTE_VENSTER) return null;
  return { van: beste.van, tot: beste.tot, vanafOpstaan: beste.van === wakkerVan };
};

/**
 * Het plan maken.
 *
 * Geeft null als er niets te plannen valt: geen datums in het reisschema, of
 * slaaptijden die (nog) geen tijd zijn. Het scherm vult dit bij elke toetsaanslag
 * opnieuw in, en halverwege het typen is de invoer nu eenmaal even onvolledig.
 *
 * De dag van vertrek is de dag voor de eerste dag in het reisschema. Dat klopt
 * voor elke vlucht van Europa naar Azië: die landt altijd de volgende dag.
 */
export const maakJetlagplan = (invoer: JetlagInvoer): Jetlagplan | null => {
  const thuis = invoer.thuis ?? THUIS_TIJDZONE;
  const bed = alsMinuten(invoer.instellingen.bedtijd);
  const wek = alsMinuten(invoer.instellingen.wektijd);
  if (bed === null || wek === null) return null;

  const reisdagen = leesReisdagen(invoer.reisschema, invoer.steden);
  const datums = [...reisdagen.keys()];
  if (datums.length === 0) return null;
  const eerste = datums[0];
  const laatste = datums[datums.length - 1];

  const voorbereiding = Math.min(
    MAX_VOORBEREIDING,
    Math.max(0, Math.round(invoer.instellingen.voorbereidingsdagen)),
  );
  const vertrekdag = plusDagen(eerste, -1);
  const thuiskomst = plusDagen(laatste, 1);
  const hoofdbestemming = hoofdbestemmingVan(reisdagen);
  const doelHeen = verschilOp(hoofdbestemming, eerste);

  const heen: Jetlagdag[] = [];
  const terug: Jetlagdag[] = [];
  let heenKlaar = false;
  let vorigeNachtvlucht = false;
  let volgnummer = 0;

  const start = plusDagen(vertrekdag, -voorbereiding);
  const einde = plusDagen(laatste, MAX_DAGEN_THUIS);
  /**
   * Waar je lichaamsklok staat, uitgedrukt als het verschil met UTC waar hij op
   * loopt. Thuis in oktober is dat +120; aangepast in Japan +540.
   */
  let lichaam = verschilOp(thuis, start);

  for (let datum = start; datum <= einde; datum = plusDagen(datum, 1)) {
    const soort: Dagsoort =
      datum < vertrekdag
        ? 'voorbereiding'
        : datum === vertrekdag
          ? 'vertrek'
          : datum < laatste
            ? 'bestemming'
            : datum === laatste
              ? 'terugreis'
              : 'thuis';

    const reisdag = reisdagen.get(datum);
    const tijdzone = reisdag?.tijdzone ?? thuis;
    const lokaal = verschilOp(tijdzone, datum);
    const volgende = reisdagen.get(plusDagen(datum, 1));

    // Een nacht in het vliegtuig. Bij vertrek altijd; onderweg als het
    // reisschema zegt dat je hier niet slaapt en je morgen in een andere zone
    // bent, zoals de overstap in Hanoi op de heenreis.
    const nachtvlucht =
      soort === 'vertrek' ||
      (soort === 'bestemming' &&
        reisdag !== undefined &&
        reisdag.zonderBed &&
        volgende !== undefined &&
        verschilOp(volgende.tijdzone, datum) !== lokaal);

    // Waar je klok vandaag heen moet. Op een overstapdag is dat al de zone van
    // morgen: in Hanoi op weg naar Japan heeft het geen zin eerst op Vietnam te
    // gaan lopen.
    const doel =
      soort === 'voorbereiding' || soort === 'vertrek'
        ? doelHeen
        : soort === 'bestemming'
          ? nachtvlucht && volgende
            ? verschilOp(volgende.tijdzone, datum)
            : lokaal
          : verschilOp(thuis, datum);

    const achterstand = kortsteKant(doel - lichaam);
    const aangepast = Math.abs(achterstand) <= AANGEPAST_BINNEN;
    const richting: Richting = aangepast ? 'geen' : achterstand > 0 ? 'vervroegen' : 'verlaten';

    const perDag = achterstand > 0 ? PER_DAG_OOST : PER_DAG_WEST;
    const stap = aangepast
      ? achterstand
      : soort === 'voorbereiding'
        ? Math.sign(achterstand) * Math.min(Math.abs(achterstand), PER_DAG_OOST)
        : soort === 'bestemming' || soort === 'thuis'
          ? Math.sign(achterstand) * Math.min(Math.abs(achterstand), perDag)
          : 0;

    // Je gewone ritme hangt aan je lichaam. Thuis om 07:00 op is 07:00 op de
    // klok van je lichaam, en tijdens de voorbereiding schuift dat met die klok
    // mee. Op de bestemming volg je vanaf de eerste dag de lokale klok.
    const volgensLichaam = (minuten: number, lichaamsklok: number): number =>
      rond(minuten + lokaal - lichaamsklok);
    const naNachtvlucht = vorigeNachtvlucht;
    let opstaan: number | null;
    let naarBed: number | null;
    if (soort === 'voorbereiding') {
      volgnummer += 1;
      opstaan = volgensLichaam(wek, lichaam);
      naarBed = volgensLichaam(bed, lichaam + stap);
    } else if (soort === 'vertrek') {
      opstaan = volgensLichaam(wek, lichaam);
      naarBed = null;
    } else if (soort === 'terugreis') {
      opstaan = null;
      naarBed = null;
    } else {
      opstaan = naNachtvlucht ? null : wek;
      naarBed = nachtvlucht ? null : bed;
    }

    const wakkerVan = opstaan ?? wek;
    let wakkerTot = naarBed ?? wakkerVan + WAKKER_ZONDER_BED;
    if (wakkerTot <= wakkerVan) wakkerTot += 1440;

    const dieptepunt = rond(wek - DIEPTEPUNT_VOOR_WEKTIJD + lokaal - lichaam);
    const ervoor = rond(dieptepunt - LICHTVENSTER);
    const metLicht = !aangepast && soort !== 'terugreis';
    const lichtZoeken = metLicht
      ? knip(richting === 'vervroegen' ? dieptepunt : ervoor, wakkerVan, wakkerTot)
      : null;
    const lichtMijden = metLicht
      ? knip(richting === 'vervroegen' ? ervoor : dieptepunt, wakkerVan, wakkerTot)
      : null;

    const laatsteKoffie = naarBed === null ? null : rond(naarBed - CAFEINE_VOOR_BEDTIJD);
    // Melatonine bij bedtijd ter plaatse, alleen als je klok vooruit moet. Daar
    // is het bewijs het sterkst (Herxheimer en Petrie, Cochrane review, 2002);
    // naar het westen helpt licht meer.
    const melatonine =
      invoer.instellingen.melatonine &&
      richting === 'vervroegen' &&
      (soort === 'bestemming' || soort === 'thuis') &&
      naarBed !== null
        ? naarBed
        : null;

    const dag: Jetlagdag = {
      datum,
      soort,
      ...(soort === 'voorbereiding' ? { volgnummer } : {}),
      tijdzone,
      stadIds: reisdag?.stadIds ?? [],
      achterstand,
      richting,
      aangepast,
      dieptepunt,
      opstaan,
      naarBed,
      lichtZoeken,
      lichtMijden,
      cafeineTot: aangepast ? null : laatsteKoffie,
      melatonine,
      nachtvlucht,
      naNachtvlucht,
    };

    if (soort === 'terugreis' || soort === 'thuis') {
      terug.push(dag);
      if (soort === 'thuis' && aangepast) break;
    } else if (!heenKlaar) {
      heen.push(dag);
      if (soort === 'bestemming' && aangepast) heenKlaar = true;
    }

    lichaam += stap;
    vorigeNachtvlucht = nachtvlucht;
  }

  let klokWisselThuis: Jetlagplan['klokWisselThuis'] = null;
  for (let i = 1; i < terug.length; i++) {
    const minuten = verschilOp(thuis, terug[i].datum) - verschilOp(thuis, terug[i - 1].datum);
    if (minuten !== 0) {
      klokWisselThuis = { datum: terug[i].datum, minuten };
      break;
    }
  }

  return {
    thuis,
    vertrekdag,
    thuiskomst,
    hoofdbestemming,
    verschilHeen: kortsteKant(doelHeen - verschilOp(thuis, vertrekdag)),
    verschilTerug: kortsteKant(
      verschilOp(thuis, thuiskomst) - verschilOp(reisdagen.get(laatste)!.tijdzone, laatste),
    ),
    heen,
    terug,
    klokWisselThuis,
  };
};

/**
 * Welke dag van het plan vandaag is.
 *
 * Elke dag staat in zijn eigen tijdzone, dus er is geen "vandaag" die voor het
 * hele plan geldt. Midden in de vlucht naar Hanoi is het thuis nog de derde en
 * in Hanoi al de vierde. Dan wint de laatste: je bent daarheen onderweg, en wat
 * je daar moet doen is wat je nu wil weten. Een reisdag telt ook in de tijd van
 * thuis, anders valt de avond van thuiskomst tussen twee dagen in.
 */
export const dagVanVandaag = (plan: Jetlagplan, nu: Date = new Date()): Jetlagdag | null => {
  let gevonden: Jetlagdag | null = null;
  for (const dag of [...plan.heen, ...plan.terug]) {
    const reisdag = dag.soort === 'vertrek' || dag.soort === 'terugreis';
    if (
      datumIn(dag.tijdzone, nu) === dag.datum ||
      (reisdag && datumIn(plan.thuis, nu) === dag.datum)
    ) {
      gevonden = dag;
    }
  }
  return gevonden;
};
