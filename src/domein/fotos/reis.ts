import type { Coordinaat, Plaats, Stad } from '@/domein/schema';
import { afstandKm } from '@/domein/geo/afstand';
import { datumIn } from '@/domein/tijd/zones';

/**
 * De reis als doorlopende lijn.
 *
 * Alle logica van de fotokaart staat hier, zonder React en zonder opslag. Dat
 * is met opzet: het ordenen op tijd, het groeperen per dag en het voorstellen
 * van een plek voor een foto zonder GPS zijn precies de dingen die je niet met
 * de hand wilt nakijken op een kaart met driehonderd spelden.
 *
 * Het uitgangspunt uit de specificatie dat hier hard gemaakt wordt: heenreis,
 * Japan en terugreis zijn één lijn. Hanoi is geen aparte reis en krijgt dus
 * geen eigen lijn; de route loopt er gewoon doorheen en weer terug.
 */

export interface Foto {
  id: string;
  naam: string;
  /** Wanneer de foto genomen is, als ISO-moment. Zonder dit valt hij buiten de lijn. */
  genomenOp?: string;
  /**
   * De tijd zoals hij op de camera stond, zonder zone.
   *
   * Deze staat er naast het moment omdat de twee verschillende vragen
   * beantwoorden. Het moment zegt wat er eerder was en wat later, ook over een
   * tijdzonegrens heen; de wandklok zegt op welke dag je die foto maakte. Een
   * avondfoto in Kyoto van 18:30 hoort bij die dag, en dat blijft zo ongeacht
   * in welke zone je hem later bekijkt.
   */
  wandklok?: string;
  coordinaten?: Coordinaat;
  /** Of de plek uit de EXIF komt of dat jij hem hebt aangewezen. */
  handmatigGeplaatst?: boolean;
  stadId?: string;
  /** De attractie of het restaurant waar de foto genomen is. */
  plaatsId?: string;
}

/** Foto's op tijd, oudste eerst. Foto's zonder tijdstip vallen erbuiten. */
export const opTijd = <T extends Foto>(fotos: T[]): T[] =>
  fotos
    .filter((f) => f.genomenOp !== undefined)
    .sort((a, b) => Date.parse(a.genomenOp!) - Date.parse(b.genomenOp!));

export interface Reisdag {
  /** De dag als YYYY-MM-DD, in de tijdzone waar je die dag was. */
  datum: string;
  /** De stad waar het zwaartepunt van die dag lag, als die te bepalen is. */
  stadId?: string;
  fotos: Foto[];
}

/**
 * Welke stad hoort bij dit punt? Dezelfde meetkunde als bij de highlight, zodat
 * een foto en je eigen locatie nooit in verschillende steden belanden.
 */
export const stadVoorPunt = (punt: Coordinaat, steden: Stad[]): Stad | undefined => {
  let beste: { stad: Stad; km: number } | undefined;
  for (const stad of steden) {
    const km = afstandKm(punt, stad.centrum);
    if (km <= stad.straalKm && (beste === undefined || km < beste.km)) beste = { stad, km };
  }
  return beste?.stad;
};

/**
 * Foto's per dag.
 *
 * De dag komt uit de wandklok van de camera als die er is, en dat is precies
 * goed: die tijd stond al in de zone waar je stond. Een avondfoto in Kyoto van
 * 18:30 hoort bij die dag, of je hem nu daar of thuis bekijkt.
 *
 * Alleen als de wandklok ontbreekt wordt het moment omgerekend, met de zone van
 * de stad op de foto, of anders die van de vorige foto die wél een plek had.
 * Dat is de zone waarin je op dat moment vrijwel zeker was.
 */
export const groepeerPerDag = (fotos: Foto[], steden: Stad[]): Reisdag[] => {
  const gesorteerd = opTijd(fotos);
  const dagen = new Map<string, Reisdag>();
  let laatsteZone = steden[0]?.tijdzone ?? 'UTC';

  for (const foto of gesorteerd) {
    const stad = foto.coordinaten ? stadVoorPunt(foto.coordinaten, steden) : undefined;
    if (stad) laatsteZone = stad.tijdzone;

    const datum = foto.wandklok
      ? foto.wandklok.slice(0, 10)
      : datumIn(laatsteZone, new Date(foto.genomenOp!));
    const bestaand = dagen.get(datum);
    if (bestaand) {
      bestaand.fotos.push(foto);
      bestaand.stadId ??= stad?.id;
    } else {
      dagen.set(datum, { datum, stadId: stad?.id, fotos: [foto] });
    }
  }

  return [...dagen.values()].sort((a, b) => a.datum.localeCompare(b.datum));
};

/**
 * De lijn door de reis: alle foto's met een plek, op tijd geordend.
 *
 * Eén lijn, dwars door alle steden en beide landen heen. Er wordt met opzet
 * niet per stad geknipt, want dan zou de vlucht van Hanoi naar Tokio uit de
 * kaart verdwijnen en zou de reis eruitzien als losse eilanden.
 *
 * Wel worden twee punten op precies dezelfde plek samengetrokken; anders staan
 * er tien lijnstukken van nul lengte in een reeks foto's van hetzelfde uitzicht.
 */
export const reislijn = (fotos: Foto[]): Coordinaat[] => {
  const punten: Coordinaat[] = [];
  for (const foto of opTijd(fotos)) {
    if (!foto.coordinaten) continue;
    const vorige = punten[punten.length - 1];
    if (vorige && vorige.lat === foto.coordinaten.lat && vorige.lon === foto.coordinaten.lon) {
      continue;
    }
    punten.push(foto.coordinaten);
  }
  return punten;
};

/**
 * De hele reis in cijfers, voor het reisverslag.
 *
 * `afstandKm` telt de hemelsbrede stukken tussen opeenvolgende foto's op. Dat
 * is geen gereden afstand en het staat er als zodanig bij; het is een indruk
 * van de reikwijdte, niet een kilometerstand.
 */
export interface Reisoverzicht {
  eersteFoto?: string;
  laatsteFoto?: string;
  aantalFotos: number;
  aantalMetPlek: number;
  aantalDagen: number;
  hemelsbredeAfstandKm: number;
  stedenBezocht: string[];
}

export const overzicht = (fotos: Foto[], steden: Stad[]): Reisoverzicht => {
  const gesorteerd = opTijd(fotos);
  const lijn = reislijn(fotos);

  let km = 0;
  for (let i = 1; i < lijn.length; i++) km += afstandKm(lijn[i - 1], lijn[i]);

  const bezocht = new Set<string>();
  for (const foto of fotos) {
    const stad =
      foto.stadId ?? (foto.coordinaten ? stadVoorPunt(foto.coordinaten, steden)?.id : undefined);
    if (stad) bezocht.add(stad);
  }

  return {
    eersteFoto: gesorteerd[0]?.genomenOp,
    laatsteFoto: gesorteerd[gesorteerd.length - 1]?.genomenOp,
    aantalFotos: fotos.length,
    aantalMetPlek: fotos.filter((f) => f.coordinaten).length,
    aantalDagen: groepeerPerDag(fotos, steden).length,
    hemelsbredeAfstandKm: Math.round(km),
    // In de volgorde van de reis, niet op alfabet.
    stedenBezocht: steden.filter((s) => bezocht.has(s.id)).map((s) => s.id),
  };
};

export interface Voorstel {
  coordinaten: Coordinaat;
  /** Waar dit voorstel op gebaseerd is, in één regel voor op het scherm. */
  reden: string;
  /** Hoeveel minuten er zit tussen deze foto en het dichtstbijzijnde ankerpunt. */
  minutenVerschil: number;
}

/** Hoe ver een buurfoto in de tijd mag liggen om nog iets te zeggen. */
const MAX_MINUTEN = 90;

/**
 * Een plek voorstellen voor een foto zonder GPS.
 *
 * Op basis van tijd en de route van die dag, precies zoals de specificatie
 * vraagt. De redenering is simpel en daarom betrouwbaar: zat je een kwartier
 * eerder en een kwartier later op dezelfde plek, dan was je er waarschijnlijk
 * ook tussendoor. Ligt er maar aan één kant een foto, dan die.
 *
 * Geeft niets terug als het te ver uit elkaar ligt. Een foto uit het midden van
 * een vlucht van zes uur ergens neerzetten is geen hulp maar een verzinsel, en
 * dan is met de hand plaatsen eerlijker.
 */
export const steldPlekVoor = (foto: Foto, alleFotos: Foto[]): Voorstel | null => {
  if (foto.coordinaten) return null;

  /**
   * Op welke schaal vergelijken we de tijd?
   *
   * De wandklok als de foto er een heeft, en anders het moment. Dat is niet
   * willekeurig: het moment van een foto zonder plek moet berekend worden met
   * een tijdzone die je juist niet kent, en dan belandt een foto van 08:10 in
   * Kyoto negen uur naast de foto van 08:00 ernaast. De wandklok komt van
   * dezelfde camera met dezelfde klok, en is binnen een reisdag precies wat je
   * wilt vergelijken.
   */
  const opWandklok = foto.wandklok !== undefined;
  const tijdstip = (f: Foto): number | null => {
    if (opWandklok) return f.wandklok ? Date.parse(`${f.wandklok}Z`) : null;
    return f.genomenOp ? Date.parse(f.genomenOp) : null;
  };

  const moment = tijdstip(foto);
  if (moment === null) return null;

  const ankers = alleFotos
    .filter((f) => f.id !== foto.id && f.coordinaten && tijdstip(f) !== null)
    .sort((a, b) => tijdstip(a)! - tijdstip(b)!);
  if (ankers.length === 0) return null;

  let voor: Foto | undefined;
  let na: Foto | undefined;
  for (const anker of ankers) {
    if (tijdstip(anker)! <= moment) voor = anker;
    else {
      na = anker;
      break;
    }
  }

  const minuten = (anker: Foto): number => Math.abs(tijdstip(anker)! - moment) / 60_000;

  // Tussen twee foto's die dicht bij elkaar liggen: het midden nemen.
  if (voor && na && minuten(voor) <= MAX_MINUTEN && minuten(na) <= MAX_MINUTEN) {
    const a = voor.coordinaten!;
    const b = na.coordinaten!;
    const uitElkaar = afstandKm(a, b);
    if (uitElkaar < 2) {
      return {
        coordinaten: { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 },
        reden: `Tussen twee foto's van rond dat tijdstip, die minder dan ${Math.max(1, Math.round(uitElkaar * 1000))} meter uit elkaar liggen.`,
        minutenVerschil: Math.round(Math.min(minuten(voor), minuten(na))),
      };
    }
  }

  // Anders de dichtstbijzijnde in de tijd, als die dicht genoeg bij ligt.
  const kandidaten = [voor, na].filter((f) => f !== undefined);
  const dichtste = kandidaten.sort((a, b) => minuten(a) - minuten(b))[0];
  if (!dichtste || minuten(dichtste) > MAX_MINUTEN) return null;

  const verschil = Math.round(minuten(dichtste));
  return {
    coordinaten: dichtste.coordinaten!,
    reden:
      verschil === 0
        ? 'Zelfde tijdstip als een foto die wel een plek heeft.'
        : `${verschil} ${verschil === 1 ? 'minuut' : 'minuten'} ${
            tijdstip(dichtste)! < moment ? 'na' : 'voor'
          } een foto met een plek.`,
    minutenVerschil: verschil,
  };
};

/** Hoe dicht een foto bij een plaats moet liggen om er automatisch aan te hangen. */
const KOPPEL_METER = 120;

/**
 * De attractie of het restaurant waar deze foto genomen is.
 *
 * Puur op afstand, en met een krappe straal. Ruimer maken zou in een
 * stadscentrum elke foto aan de eerste de beste ramenzaak hangen, en een
 * verkeerde koppeling is vervelender dan geen koppeling: in het reisverslag
 * staat dan dat je ergens was waar je nooit binnen bent geweest.
 */
export const plaatsVoorFoto = (foto: Foto, plaatsen: Plaats[]): Plaats | undefined => {
  if (!foto.coordinaten) return undefined;
  let beste: { plaats: Plaats; km: number } | undefined;
  for (const plaats of plaatsen) {
    const km = afstandKm(foto.coordinaten, plaats.coordinaten);
    if (km * 1000 <= KOPPEL_METER && (beste === undefined || km < beste.km)) {
      beste = { plaats, km };
    }
  }
  return beste?.plaats;
};
