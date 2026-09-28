import type { Jetlagdag, Venster } from '@/domein/jetlag/protocol';
import { alsTijd } from '@/domein/planning/overstap';

/**
 * Van het plan naar zinnen.
 *
 * Het domein rekent in minuten; hier wordt dat iets wat je om zeven uur 's
 * ochtends in een hotelkamer in één keer leest. Kort, met de tijd vooraan, en
 * bij elk advies de reden erbij waar die niet vanzelf spreekt: "zonnebril op"
 * zonder uitleg is precies het advies dat je overslaat.
 */

export interface Regel {
  /** De tijd of het tijdvak vooraan de regel. Leeg voor een algemene opmerking. */
  tijd: string | null;
  tekst: string;
  nadruk?: 'licht' | 'donker';
}

const DAGFORMAAT = new Intl.DateTimeFormat('nl-NL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

const hoofdletter = (zin: string): string => `${zin.charAt(0).toUpperCase()}${zin.slice(1)}`;

/** 2026-09-30 wordt "Woensdag 30 september". Een datum in een zin hoort geen streepjes te hebben. */
export const alsDagLabel = (datum: string): string =>
  hoofdletter(DAGFORMAAT.format(new Date(`${datum}T12:00:00Z`)));

/** 390 minuten wordt "6,5 uur", in halve uren, want preciezer is het model niet. */
export const alsUren = (minuten: number): string => {
  const uren = Math.round(Math.abs(minuten) / 30) / 2;
  if (uren === 0.5) return 'een half uur';
  return `${String(uren).replace('.', ',')} uur`;
};

/** "07:00 tot 08:00", of "tot 09:00" als het venster al bij het opstaan begint. */
export const alsVenster = (venster: Venster): string =>
  venster.vanafOpstaan
    ? `tot ${alsTijd(venster.tot)}`
    : `${alsTijd(venster.van)} tot ${alsTijd(venster.tot)}`;

/** Een venster voor twaalf uur 's middags vraagt om een zonnebril, een later om gedempte lampen. */
const inDeOchtend = (venster: Venster): boolean => venster.van % 1440 < 12 * 60;

/** Waar je die dag bent, voor boven de kaart van de dag. */
export const plekVan = (
  dag: Jetlagdag,
  stadNaam: (id: string) => string | undefined,
  voorbereidingsdagen: number,
): string => {
  switch (dag.soort) {
    case 'voorbereiding':
      return `Thuis, voorbereiding ${dag.volgnummer} van ${voorbereidingsdagen}`;
    case 'vertrek':
      return 'Vertrekdag';
    case 'terugreis':
      return 'Terugreis';
    case 'thuis':
      return 'Thuis';
    case 'bestemming':
      return dag.stadIds.map((id) => stadNaam(id) ?? id).join(' en ') || 'Onderweg';
  }
};

/**
 * Alles wat je die dag moet doen, op volgorde van de klok.
 *
 * De opmerkingen zonder tijd staan eromheen: wat je vooraf moet weten bovenaan,
 * wat voor de hele dag geldt onderaan.
 */
export const regelsVan = (dag: Jetlagdag): Regel[] => {
  if (dag.soort === 'terugreis') {
    return [
      {
        tijd: null,
        tekst:
          'Zet bij het instappen je horloge op Nederlandse tijd. Slaap in het vliegtuig alleen als het thuis nacht is, en blijf anders wakker met het licht aan.',
      },
      {
        tijd: null,
        tekst:
          'Kom je overdag aan, blijf dan op tot je gewone bedtijd. Een dutje van hooguit twintig minuten mag.',
      },
    ];
  }

  if (dag.aangepast) {
    return [
      {
        tijd: null,
        tekst: 'Je klok loopt gelijk met de lokale tijd. Vanaf hier gewoon je eigen ritme.',
      },
    ];
  }

  const vooraf: Regel[] = [];
  const achteraf: Regel[] = [];

  if (dag.soort === 'voorbereiding') {
    vooraf.push({
      tijd: null,
      tekst:
        'Vanavond een uur eerder naar bed dan de avond ervoor. Zo begint je klok thuis al te schuiven.',
    });
  }
  if (dag.naNachtvlucht) {
    vooraf.push({
      tijd: null,
      tekst:
        'Je komt aan na een nacht in het vliegtuig. Ga pas op de avond slapen; een dutje van hooguit twintig minuten, voor 15:00, mag.',
    });
  }

  // De regels met een tijd. Gesorteerd vanaf de ochtend, zodat een bedtijd na
  // middernacht achteraan komt en niet vooraan.
  const begin = dag.opstaan ?? 5 * 60;
  const getimed: { om: number; regel: Regel }[] = [];
  if (dag.opstaan !== null) {
    getimed.push({ om: dag.opstaan, regel: { tijd: alsTijd(dag.opstaan), tekst: 'Opstaan.' } });
  }
  if (dag.lichtZoeken) {
    const thuis = dag.soort === 'voorbereiding' || dag.soort === 'vertrek';
    getimed.push({
      om: dag.lichtZoeken.van,
      regel: {
        tijd: alsVenster(dag.lichtZoeken),
        tekst: thuis
          ? 'Fel licht. Buiten als het al licht is, anders zo fel mogelijk binnen of voor een daglichtlamp.'
          : 'Fel licht. Naar buiten, ook als het bewolkt is: daglicht is vele malen feller dan binnen.',
        nadruk: 'licht',
      },
    });
  }
  if (dag.lichtMijden) {
    getimed.push({
      om: dag.lichtMijden.van,
      regel: {
        tijd: alsVenster(dag.lichtMijden),
        tekst: inDeOchtend(dag.lichtMijden)
          ? 'Geen fel licht: zonnebril op en uit de zon. Je lichaam zit nog in de nacht, en licht nu duwt je klok de verkeerde kant op.'
          : 'Gedempt licht: grote lampen uit en je scherm op de nachtstand. Licht nu duwt je klok de verkeerde kant op.',
        nadruk: 'donker',
      },
    });
  }
  if (dag.cafeineTot !== null) {
    getimed.push({
      om: dag.cafeineTot,
      regel: {
        tijd: `na ${alsTijd(dag.cafeineTot)}`,
        tekst: 'Geen koffie, energiedrank of groene thee meer.',
      },
    });
  }
  if (dag.melatonine !== null) {
    getimed.push({
      om: dag.melatonine - 1,
      regel: { tijd: alsTijd(dag.melatonine), tekst: 'Melatonine, vlak voor het slapengaan.' },
    });
  }
  if (dag.naarBed !== null) {
    getimed.push({
      om: dag.naarBed,
      regel: {
        tijd: alsTijd(dag.naarBed),
        tekst: 'Naar bed. Lukt slapen niet, blijf dan rustig liggen in het donker.',
      },
    });
  }
  getimed.sort((a, b) => ((a.om - begin + 1440) % 1440) - ((b.om - begin + 1440) % 1440));

  if (dag.soort === 'vertrek') {
    achteraf.push({
      tijd: null,
      tekst:
        'Zet bij het instappen je horloge op de tijd van je bestemming. Slaap in het vliegtuig als het daar nacht is en blijf wakker als het daar dag is. Veel water, weinig alcohol.',
    });
  } else if (dag.nachtvlucht) {
    achteraf.push({
      tijd: null,
      tekst:
        'Vannacht zit je in het vliegtuig. Slaap zoveel je kunt: op je bestemming is het dan nacht.',
    });
  }
  if ((dag.soort === 'bestemming' || dag.soort === 'thuis') && !dag.naNachtvlucht) {
    achteraf.push({
      tijd: null,
      tekst: 'Een dutje mag, maar hooguit twintig minuten en voor 15:00.',
    });
  }
  if (dag.richting === 'verlaten' && dag.opstaan !== null) {
    achteraf.push({
      tijd: null,
      tekst: `Word je vroeg wakker, blijf dan in het donker liggen tot ${alsTijd(dag.opstaan)}.`,
    });
  }

  return [...vooraf, ...getimed.map((g) => g.regel), ...achteraf];
};

/** De dag in één zin, voor het hoofdmenu. */
export const kernregel = (dag: Jetlagdag): string => {
  if (dag.soort === 'terugreis') {
    return 'Reisdag. Horloge op Nederlandse tijd, en in het vliegtuig alleen slapen als het thuis nacht is.';
  }
  if (dag.aangepast) return 'Je klok loopt gelijk. Gewoon je eigen ritme.';

  const van = (venster: Venster): string =>
    `${venster.vanafOpstaan ? '' : 'van '}${alsVenster(venster)}`;
  const delen: string[] = [];
  if (dag.lichtMijden && inDeOchtend(dag.lichtMijden)) {
    delen.push(`geen fel licht ${van(dag.lichtMijden)}`);
  }
  if (dag.lichtZoeken) delen.push(`fel licht ${van(dag.lichtZoeken)}`);
  if (dag.lichtMijden && !inDeOchtend(dag.lichtMijden)) {
    delen.push(`gedempt licht ${van(dag.lichtMijden)}`);
  }
  if (dag.naarBed !== null) delen.push(`naar bed om ${alsTijd(dag.naarBed)}`);
  if (dag.nachtvlucht) delen.push('slapen in het vliegtuig');
  if (delen.length === 0) return 'Gewoon je ritme aanhouden.';
  return `${hoofdletter(delen.join(', '))}.`;
};
