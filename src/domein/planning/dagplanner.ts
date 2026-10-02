import type { Plaats, Sluiting, Stad } from '@/domein/schema';
import { afstandKm } from '@/domein/geo/afstand';
import {
  bezoekduurVan,
  drukteVan,
  looptijdMinuten,
  regenbestendigVan,
} from '@/domein/filters/plaatsen';
import {
  klokMinuten,
  loptDoor,
  openOp,
  tijdenOp,
  vasteSluitingsdagen,
  volgendeVoorstelling,
  vorigeDatum,
  weekdagIn,
  type Blok,
} from '@/domein/openingstijden/status';
import { BUURT_KM } from '@/domein/plaatsen/buurt';
import { alsKorteDatum, alsPeriode } from '@/domein/tijd/datums';
import { ankerVan, leesTijdslot, type Anker, type Tijdslot } from './drukte';

/**
 * De slimme dagplanner uit hoofdstuk 12.
 *
 * Bouwt een dag uit de punten die je hebt gekozen, op basis van de looproute en
 * de openingstijden van die datum, met een waarschuwing bij sluitingsdagen.
 *
 * De volgorde komt uit een naaste-buur route: begin bij het startpunt, loop
 * telkens naar het dichtstbijzijnde punt dat nog over is. Dat is niet de
 * kortst mogelijke route (dat probleem is niet in redelijke tijd op te lossen
 * en het verschil is op stadsschaal klein), maar het scheelt in de praktijk
 * uren heen en weer lopen ten opzichte van de volgorde waarin je ze aanvinkte.
 *
 * De openingstijden gaan per datum: een middagpauze, een sluitingsperiode,
 * de eerste maandag van de maand en een bar die tot na middernacht open is,
 * tellen allemaal mee. Wat de planner niet doet is doen alsof hij het weet:
 * waar er geen klok uit de tijden te halen valt, komt er geen tijdvenster
 * maar een opmerking.
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
  /** Waarom de stop op dit moment staat: de drukte of een voorstelling. Eén regel. */
  uitleg?: string;
}

/** Een eetplek bij een maaltijdmoment. Een voorstel: hij staat niet in de dag. */
export interface Maaltijdvoorstel {
  maaltijd: 'lunch' | 'diner';
  /** Rond wanneer, in minuten na middernacht. */
  moment: number;
  plaats: Plaats;
  /** De stop waar hij bij hoort: via inDeBuurtVan, of omdat hij het dichtstbij ligt. */
  bij: Plaats;
  /** Gekoppeld via inDeBuurtVan, en niet alleen toevallig dichtbij. */
  gekoppeld: boolean;
  /** Minuten lopen vanaf die stop, als beide op de kaart staan. */
  minuten: number | null;
  /** De stop waarna het voorstel valt; leeg als het voor de eerste stop is. */
  na?: Plaats;
}

export interface Dagplan {
  datum: string;
  stops: Stop[];
  /** Punten die niet meer in de dag pasten of die dag dicht zijn. */
  nietGepland: Plaats[];
  /** Waarschuwingen over de dag als geheel. */
  waarschuwingen: string[];
  /** Totale looptijd tussen de stops, in minuten. */
  looptijdTotaal: number;
  /** Waar je kunt lunchen en eten, bij de stops die er op dat moment omheen liggen. */
  maaltijden: Maaltijdvoorstel[];
}

const bezoekduur = (plaats: Plaats): number =>
  bezoekduurVan(plaats) ??
  (plaats.categorie === 'eten' ? 45 : plaats.categorie === 'spa' ? 90 : STANDAARD_DUUR);

/** Hoe een plek op een datum open is, met de blokken op een doorlopende klok. */
export type Openingsraam =
  /**
   * Open, met de blokken op volgorde. Een blok dat na middernacht doorloopt,
   * eindigt na 1440; een blok van gisteren dat vandaag nog loopt, begint om 0.
   */
  | { soort: 'open'; blokken: Blok[] }
  /** Dicht, met de reden als het om een sluitingsperiode gaat. */
  | { soort: 'gesloten'; sluiting?: Sluiting }
  /** Geen tijden, of tijden zonder klok die de planner kan lezen. */
  | { soort: 'onbekend' };

/** De eigen blokken van een dag, met een blok over middernacht doorgetrokken. */
const eigenBlokken = (blokken: Blok[]): Blok[] =>
  blokken.map((b) => (loptDoor(b) ? { van: b.van, tot: b.tot + 1440 } : b));

/** Open en dicht op een datum, zoals de planner ermee rekent. */
export const openingsraam = (
  plaats: Pick<Plaats, 'openingstijden' | 'sluitingen'>,
  datum: string,
): Openingsraam => {
  const vandaag = tijdenOp(plaats, datum);
  if (vandaag.soort === 'gesloten') return vandaag;
  if (vandaag.soort === 'onbekend' || vandaag.blokken.length === 0) return { soort: 'onbekend' };

  const blokken = eigenBlokken(vandaag.blokken);
  const gisteren = tijdenOp(plaats, vorigeDatum(datum));
  if (gisteren.soort === 'open') {
    for (const b of gisteren.blokken) {
      if (loptDoor(b) && b.tot > 0) blokken.push({ van: 0, tot: b.tot });
    }
  }
  return { soort: 'open', blokken: blokken.sort((a, b) => a.van - b.van) };
};

/**
 * De eerste openingstijd en de laatste sluitingstijd op een datum, in minuten.
 *
 * Null als er geen klok uit de tijden te halen valt. Dat is vaker dan je denkt:
 * "Dag en nacht open" en "Zonsopgang tot zonsondergang" staan allebei in de
 * content, en daar een getal van maken zou een precisie voorwenden die er niet is.
 * Een blok van gisteren dat na middernacht doorloopt, telt hier niet mee.
 */
export const venster = (
  plaats: Pick<Plaats, 'openingstijden' | 'sluitingen'>,
  datum: string,
): { van: number; tot: number } | null => {
  const dag = tijdenOp(plaats, datum);
  if (dag.soort !== 'open' || dag.blokken.length === 0) return null;
  const blokken = eigenBlokken(dag.blokken);
  return {
    van: Math.min(...blokken.map((b) => b.van)),
    tot: Math.max(...blokken.map((b) => b.tot)),
  };
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
      // Een plek zonder pin komt achteraan: er valt niet te zeggen hoe ver hij is.
      const km =
        huidig.coordinaten && kandidaat.coordinaten
          ? afstandKm(huidig.coordinaten, kandidaat.coordinaten)
          : Number.MAX_SAFE_INTEGER;
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
  /** Alle plekken van de stad, voor de voorstellen bij lunch en diner. */
  alle?: Plaats[];
  /** Een regendag: dan geen terras of dakbar als voorstel. */
  regen?: boolean;
}

/** "Jaarlijks onderhoud" wordt "Jaarlijks onderhoud.", zodat er een zin achter kan. */
const alsZin = (tekst: string): string => {
  const t = tekst.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
};

/** De eerste voorstelling van de dag, als de plek voorstellingen heeft. */
const eersteVoorstelling = (plaats: Plaats): number | null =>
  plaats.voorstellingen?.length ? Math.min(...plaats.voorstellingen.map(klokMinuten)) : null;

/** De voorstellingen als "16:10, 17:20 en 18:30". */
const voorstellingenTekst = (plaats: Plaats): string => {
  const tijden = [...(plaats.voorstellingen ?? [])].sort((a, b) => klokMinuten(a) - klokMinuten(b));
  return tijden.length > 1
    ? `${tijden.slice(0, -1).join(', ')} en ${tijden[tijden.length - 1]}`
    : (tijden[0] ?? '');
};

type Inpassing =
  | { soort: 'past'; aankomst: number; vertrek: number; waarschuwingen: string[] }
  | { soort: 'te-laat'; sluit: number };

/**
 * Zoekt het eerste open blok waar het bezoek in past.
 *
 * Kom je in een middagpauze aan, dan wacht je tot het weer opengaat. Is er in
 * het huidige blok minder dan de helft van de bezoekduur over en komt er nog
 * een blok, dan schuift het bezoek naar dat blok; een half museum is geen
 * bezoek. Anders wordt het bezoek ingekort tot de sluitingstijd, met een
 * waarschuwing. De planner zet je nooit binnen terwijl het dicht is.
 */
const inpassen = (blokken: Blok[], aankomst: number, duur: number): Inpassing => {
  const waarschuwingen: string[] = [];
  for (const [i, blok] of blokken.entries()) {
    if (blok.tot <= aankomst) continue;
    const begin = Math.max(aankomst, blok.van);
    const volgende = blokken[i + 1];
    if (blok.tot - begin < duur / 2 && volgende) {
      waarschuwingen.push(
        `Tussen ${alsKlok(blok.tot)} en ${alsKlok(volgende.van)} is het dicht, dus dit staat erna.`,
      );
      continue;
    }
    if (begin > aankomst && waarschuwingen.length === 0) {
      // Weer open na een pauze; een blok dat om middernacht begint is de nacht
      // ervoor, en dat telt niet als pauze.
      const pauze = i > 0 && blokken[i - 1].van > 0 && blokken[i - 1].tot <= aankomst;
      waarschuwingen.push(
        pauze
          ? `Gaat om ${alsKlok(begin)} weer open, dus je wacht even.`
          : `Gaat pas om ${alsKlok(begin)} open, dus je wacht even.`,
      );
    }
    let vertrek = begin + duur;
    if (vertrek > blok.tot) {
      waarschuwingen.push(
        `Je hebt maar tot ${alsKlok(blok.tot)}, korter dan de ${duur} minuten die dit meestal kost.`,
      );
      vertrek = blok.tot;
    }
    return { soort: 'past', aankomst: begin, vertrek, waarschuwingen };
  }
  return { soort: 'te-laat', sluit: blokken[blokken.length - 1]?.tot ?? aankomst };
};

/**
 * Bouwt de dag.
 *
 * Loopt de route af en schuift elke stop op tot hij binnen de openingstijden
 * van die datum past. Wat er niet meer in past of die dag dicht is, komt apart
 * te staan in plaats van stilletjes te verdwijnen: dan zie je zelf of je iets
 * wilt laten vallen of een dag wilt verschuiven.
 */
export const maakDagplan = (invoer: PlanInvoer): Dagplan => {
  const { plaatsen, stad, datum, startMinuten, eindMinuten } = invoer;

  // De weekdag van de gekozen datum, voor de waarschuwingen. Een datum is al
  // een kalenderdag in de stad zelf, dus dit is de weekdag daar.
  const dag = weekdagIn(stad.tijdzone, new Date(`${datum}T12:00:00Z`));

  // Drukke plekken met een rustig moment gaan vooraan of achteraan de dag,
  // als de openingstijden dat toelaten; de rest volgt de looproute ertussen.
  // Een plek met voorstellingen vanaf de middag gaat achteraan, anders wacht
  // je de hele dag op de eerste voorstelling.
  const slotVan = new Map<string, { slot: Tijdslot; anker: Anker }>();
  for (const plaats of plaatsen) {
    const show = eersteVoorstelling(plaats);
    if (show !== null) {
      if (show >= 12 * 60) slotVan.set(plaats.id, { slot: { van: show }, anker: 'laat' });
      continue;
    }
    const slot = leesTijdslot(drukteVan(plaats)?.besteTijdslot);
    const anker = ankerVan(slot, venster(plaats, datum));
    if (slot && anker) slotVan.set(plaats.id, { slot, anker });
  }
  const moment = (p: Plaats) => {
    const s = slotVan.get(p.id)?.slot;
    return s?.van ?? s?.tot ?? venster(p, datum)?.van ?? 0;
  };
  const vroeg = plaatsen
    .filter((p) => slotVan.get(p.id)?.anker === 'vroeg')
    .sort((a, b) => moment(a) - moment(b));
  const laat = plaatsen
    .filter((p) => slotVan.get(p.id)?.anker === 'laat')
    .sort((a, b) => moment(a) - moment(b));
  const rest = plaatsen.filter((p) => !slotVan.has(p.id));
  const route = [...vroeg, ...looproute(rest, vroeg[vroeg.length - 1]), ...laat];
  const stops: Stop[] = [];
  const nietGepland: Plaats[] = [];
  const waarschuwingen: string[] = [];

  let klok = startMinuten;
  let vorige: Plaats | null = null;
  let looptijdTotaal = 0;

  for (const plaats of route) {
    const stopWaarschuwingen: string[] = [];
    let looptijd = 0;
    if (vorige) {
      if (vorige.coordinaten && plaats.coordinaten) {
        looptijd = looptijdMinuten(vorige.coordinaten, plaats.coordinaten);
      } else {
        stopWaarschuwingen.push(
          'Deze plek staat nog niet op de kaart, dus de looptijd is onbekend.',
        );
      }
    }

    // Die dag dicht: niet inplannen, wel melden, met de reden erbij als het
    // om een sluitingsperiode gaat. Anders sta je er.
    const raam = openingsraam(plaats, datum);
    if (raam.soort === 'gesloten') {
      nietGepland.push(plaats);
      const s = raam.sluiting;
      waarschuwingen.push(
        s
          ? `${plaats.naam} is tijdelijk gesloten (${alsPeriode(s.van, s.tot)}). ${alsZin(s.reden)}`
          : vasteSluitingsdagen(plaats.openingstijden).includes(dag)
            ? `${plaats.naam} is op ${dag} gesloten.`
            : `${plaats.naam} is op ${dag} ${alsKorteDatum(datum)} gesloten.`,
      );
      continue;
    }

    let aankomst = klok + looptijd;
    const duur = bezoekduur(plaats);
    let vertrek: number;
    let uitleg: string | undefined;

    if (plaats.voorstellingen?.length) {
      // Een voorstelling begint op een vaste tijd: wachten op de volgende, en
      // is er die dag geen meer, dan past hij niet.
      const show = volgendeVoorstelling(plaats, aankomst);
      if (show === null) {
        nietGepland.push(plaats);
        waarschuwingen.push(
          `${plaats.naam}: na ${alsKlok(aankomst)} is er die dag geen voorstelling meer.`,
        );
        continue;
      }
      aankomst = show;
      vertrek = show + duur;
      uitleg = `Op de voorstelling van ${alsKlok(show)}; de tijden zijn ${voorstellingenTekst(plaats)}.`;
    } else {
      const drukte = slotVan.get(plaats.id);
      const slotTekst = drukteVan(plaats)?.besteTijdslot;
      if (drukte?.anker === 'laat' && drukte.slot.van !== undefined) {
        if (aankomst < drukte.slot.van) aankomst = drukte.slot.van;
        uitleg = `Laat op de dag ingepland: ${slotTekst} is het hier het rustigst.`;
      } else if (drukte?.anker === 'vroeg') {
        const tot = drukte.slot.tot;
        if (drukte.slot.van !== undefined && aankomst < drukte.slot.van) {
          aankomst = drukte.slot.van;
        }
        uitleg =
          tot !== undefined && aankomst > tot
            ? `Het rustigst ${slotTekst}; begin je dag eerder om dat te halen.`
            : drukte.slot.opening
              ? 'Bij opening ingepland: dan is het hier het rustigst.'
              : `Vroeg ingepland: ${slotTekst} is het hier het rustigst.`;
      }

      if (raam.soort === 'open') {
        const passing = inpassen(raam.blokken, aankomst, duur);
        if (passing.soort === 'te-laat') {
          nietGepland.push(plaats);
          waarschuwingen.push(
            `${plaats.naam} sluit om ${alsKlok(passing.sluit)}; op deze route kom je er te laat aan.`,
          );
          continue;
        }
        aankomst = passing.aankomst;
        vertrek = passing.vertrek;
        stopWaarschuwingen.push(...passing.waarschuwingen);
      } else {
        if (plaats.openingstijden) {
          stopWaarschuwingen.push('De openingstijden staan niet als klok in de app; kijk ze na.');
        }
        vertrek = aankomst + duur;
      }
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

    stops.push({ plaats, aankomst, vertrek, looptijd, waarschuwingen: stopWaarschuwingen, uitleg });
    looptijdTotaal += looptijd;
    klok = vertrek;
    vorige = plaats;
  }

  if (stops.length > 0 && klok > eindMinuten) {
    waarschuwingen.push(
      `Deze dag loopt tot ${alsKlok(klok)}, later dan de ${alsKlok(eindMinuten)} die je aangaf.`,
    );
  }

  const maaltijden = maaltijdvoorstellen(stops, invoer.alle ?? [], datum, startMinuten, {
    regen: invoer.regen,
  });

  return { datum, stops, nietGepland, waarschuwingen, looptijdTotaal, maaltijden };
};

/** De maaltijdmomenten, in minuten na middernacht. */
export const MAALTIJDEN = [
  { maaltijd: 'lunch', van: 11 * 60 + 30, tot: 14 * 60 },
  { maaltijd: 'diner', van: 18 * 60, tot: 21 * 60 },
] as const;

/** Een plek waar je een maaltijd haalt, en niet alleen koffie, thee of een drankje. */
const isMaaltijd = (plaats: Plaats): boolean =>
  plaats.categorie === 'eten' &&
  plaats.eten?.keuken !== 'koffie' &&
  plaats.eten?.keuken !== 'thee' &&
  plaats.eten?.keuken !== 'bar';

const lopen = (a: Plaats, b: Plaats): number | null =>
  a.coordinaten && b.coordinaten ? looptijdMinuten(a.coordinaten, b.coordinaten) : null;

/**
 * Voorstellen voor lunch (11:30 tot 14:00) en diner (18:00 tot 21:00).
 *
 * Valt er een moment tussen twee stops in zo'n venster, en staat er nog geen
 * maaltijd in de dag, dan zoekt dit een eetplek die op dat moment open is.
 * Eerst een plek die via inDeBuurtVan aan de vorige of de volgende stop
 * gekoppeld is, dan de dichtstbijzijnde binnen 800 meter. Het is een voorstel:
 * de dag zelf verandert er niet door.
 */
export const maaltijdvoorstellen = (
  stops: Stop[],
  alle: Plaats[],
  datum: string,
  startMinuten: number,
  opties: { regen?: boolean } = {},
): Maaltijdvoorstel[] => {
  if (stops.length === 0) return [];
  const gebruikt = new Set(stops.map((s) => s.plaats.id));
  const voorstellen: Maaltijdvoorstel[] = [];

  // Elk moment waarop je tussen twee stops staat: voor de eerste, en na elke stop.
  const grenzen = [
    { moment: startMinuten, na: undefined, volgende: stops[0].plaats },
    ...stops.map((s, i) => ({ moment: s.vertrek, na: s.plaats, volgende: stops[i + 1]?.plaats })),
  ];

  for (const maaltijd of MAALTIJDEN) {
    // Er staat al een maaltijd in dat venster: dan hoeft er niets bij.
    if (
      stops.some(
        (s) => isMaaltijd(s.plaats) && s.aankomst < maaltijd.tot && s.vertrek > maaltijd.van,
      )
    ) {
      continue;
    }
    // Minstens een half uur voor het einde van het venster, anders is het te laat.
    for (const grens of grenzen) {
      if (grens.moment < maaltijd.van || grens.moment > maaltijd.tot - 30) continue;
      const open = alle.filter(
        (p) =>
          isMaaltijd(p) &&
          !gebruikt.has(p.id) &&
          openOp(p, datum, grens.moment) === true &&
          !(opties.regen && regenbestendigVan(p) === false),
      );
      const buren = [grens.na, grens.volgende].filter((p): p is Plaats => p !== undefined);
      const voorstel = gekoppeldeEetplek(open, buren) ?? dichtsteEetplek(open, buren);
      if (!voorstel) continue;
      gebruikt.add(voorstel.plaats.id);
      voorstellen.push({
        maaltijd: maaltijd.maaltijd,
        moment: grens.moment,
        na: grens.na,
        ...voorstel,
      });
      break;
    }
  }
  return voorstellen;
};

type Gevonden = Pick<Maaltijdvoorstel, 'plaats' | 'bij' | 'gekoppeld' | 'minuten'>;

/** Op looptijd, en wat geen looptijd heeft achteraan. */
const opLooptijd = (a: Gevonden, b: Gevonden): number =>
  (a.minuten ?? Number.MAX_SAFE_INTEGER) - (b.minuten ?? Number.MAX_SAFE_INTEGER);

/** Een eetplek die aan een van de buren gekoppeld is; de vorige stop gaat voor. */
const gekoppeldeEetplek = (open: Plaats[], buren: Plaats[]): Gevonden | undefined => {
  for (const bij of buren) {
    const gekoppeld = open
      .filter((p) => p.inDeBuurtVan?.includes(bij.id))
      .map((p) => ({ plaats: p, bij, gekoppeld: true, minuten: lopen(bij, p) }))
      .sort(opLooptijd);
    if (gekoppeld.length > 0) return gekoppeld[0];
  }
  return undefined;
};

/** De dichtstbijzijnde eetplek binnen 800 meter van een van de buren. */
const dichtsteEetplek = (open: Plaats[], buren: Plaats[]): Gevonden | undefined => {
  let beste: { gevonden: Gevonden; km: number } | undefined;
  for (const bij of buren) {
    if (!bij.coordinaten) continue;
    for (const p of open) {
      if (!p.coordinaten) continue;
      const km = afstandKm(bij.coordinaten, p.coordinaten);
      if (km <= BUURT_KM && (!beste || km < beste.km)) {
        beste = { gevonden: { plaats: p, bij, gekoppeld: false, minuten: lopen(bij, p) }, km };
      }
    }
  }
  return beste?.gevonden;
};

/** Minuten na middernacht als "HH:MM". */
export const alsKlok = (minuten: number): string => {
  const genormaliseerd = ((Math.round(minuten) % 1440) + 1440) % 1440;
  return `${String(Math.floor(genormaliseerd / 60)).padStart(2, '0')}:${String(genormaliseerd % 60).padStart(2, '0')}`;
};
