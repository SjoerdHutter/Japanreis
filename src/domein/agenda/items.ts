import type { OpgeslagenReservering, Plaats, Stad } from '@/domein/schema';
import { utcVan } from '@/domein/schema';
import type { MijnGegevens } from '@/domein/gegevens/orden';
import { momentInZone } from '@/domein/tijd/zones';
import type { AgendaItem, AgendaTijd } from './ics';

/**
 * Van je gegevens naar afspraken: vluchten, in- en uitchecken, geboekte
 * reserveringen en het moment dat een kaartverkoop opent.
 *
 * Adressen en boekingsnummers gaan er alleen in als je daarvoor kiest. Een
 * agenda wordt vaak gedeeld of gesynchroniseerd met diensten waar je niet aan
 * denkt, en een boekingsnummer is een sleutel tot je boeking.
 */

export type Omvang =
  { soort: 'alles' } | { soort: 'dag'; datum: string } | { soort: 'kaartverkoop' };

export interface AgendaInvoer {
  gegevens: MijnGegevens;
  reserveringen: OpgeslagenReservering[];
  steden: Stad[];
  plaatsen?: Plaats[];
  persoonlijk: boolean;
  omvang: Omvang;
}

const DOMEIN = '@japanreis.app';

interface MetDag {
  item: AgendaItem;
  /** De kalenderdag waarop het plaatsvindt, voor "één dag". */
  datum: string;
  kaartverkoop: boolean;
}

const lokaalMoment = (zone: string, datum: string, tijd?: string): AgendaTijd => {
  if (!tijd) return { soort: 'dag', datum };
  const moment = momentInZone(zone, `${datum}T${tijd}`);
  return moment ? { soort: 'moment', utc: moment.getTime() } : { soort: 'dag', datum };
};

const plus = (tijd: AgendaTijd, minuten: number): AgendaTijd | undefined =>
  tijd.soort === 'moment' ? { soort: 'moment', utc: tijd.utc + minuten * 60_000 } : undefined;

const regels = (...delen: (string | false | undefined)[]): string | undefined => {
  const tekst = delen.filter(Boolean).join('\n');
  return tekst || undefined;
};

export const agendaItems = (invoer: AgendaInvoer): AgendaItem[] => {
  const { gegevens, reserveringen, steden, plaatsen = [], persoonlijk, omvang } = invoer;
  const zoneVan = (stadId?: string) =>
    steden.find((s) => s.id === stadId)?.tijdzone ?? 'Asia/Tokyo';
  const naamVan = (stadId?: string) => steden.find((s) => s.id === stadId)?.naam;
  const alle: MetDag[] = [];

  for (const vlucht of gegevens.vluchten) {
    const vertrek = utcVan(vlucht.vertrek);
    const aankomst = utcVan(vlucht.aankomst);
    const begin: AgendaTijd =
      vertrek === null
        ? { soort: 'dag', datum: vlucht.vertrek.datum }
        : { soort: 'moment', utc: vertrek };
    alle.push({
      datum: vlucht.vertrek.datum,
      kaartverkoop: false,
      item: {
        uid: `vlucht-${vlucht.id}${DOMEIN}`,
        titel: `Vlucht ${vlucht.vluchtnummer}, ${vlucht.van} naar ${vlucht.naar}`,
        begin,
        eind:
          vertrek !== null && aankomst !== null && aankomst > vertrek
            ? { soort: 'moment', utc: aankomst }
            : undefined,
        locatie: vlucht.van,
        beschrijving: regels(
          vlucht.maatschappij,
          persoonlijk && vlucht.boekingsnummer && `Boekingsnummer: ${vlucht.boekingsnummer}`,
        ),
        alarmen: begin.soort === 'moment' ? ['PT3H'] : [],
        zone: vlucht.vertrek.tijdzone,
      },
    });
  }

  for (const verblijf of gegevens.accommodaties) {
    const zone = zoneVan(verblijf.stadId);
    const locatie = persoonlijk ? verblijf.adresLatijn : undefined;
    const beschrijving = regels(
      naamVan(verblijf.stadId),
      persoonlijk && verblijf.boekingsnummer && `Boekingsnummer: ${verblijf.boekingsnummer}`,
    );
    const incheck = lokaalMoment(zone, verblijf.incheck.datum, verblijf.incheck.tijd);
    const uitcheck = lokaalMoment(zone, verblijf.uitcheck.datum, verblijf.uitcheck.tijd);
    alle.push(
      {
        datum: verblijf.incheck.datum,
        kaartverkoop: false,
        item: {
          uid: `incheck-${verblijf.id}${DOMEIN}`,
          titel: `Inchecken: ${verblijf.naam}`,
          begin: incheck,
          eind: plus(incheck, 30),
          locatie,
          beschrijving,
          alarmen: [],
          zone,
        },
      },
      {
        datum: verblijf.uitcheck.datum,
        kaartverkoop: false,
        item: {
          uid: `uitcheck-${verblijf.id}${DOMEIN}`,
          titel: `Uitchecken: ${verblijf.naam}`,
          begin: uitcheck,
          eind: plus(uitcheck, 30),
          locatie,
          beschrijving,
          alarmen: uitcheck.soort === 'moment' ? ['PT1H'] : [],
          zone,
        },
      },
    );
  }

  for (const reservering of reserveringen) {
    const zone = zoneVan(reservering.stadId);
    const plaats = plaatsen.find((p) => p.id === reservering.plaatsId);
    if (reservering.status === 'geboekt' && reservering.datum) {
      const begin = lokaalMoment(zone, reservering.datum, reservering.tijd);
      alle.push({
        datum: reservering.datum,
        kaartverkoop: false,
        item: {
          uid: `res-${reservering.id}${DOMEIN}`,
          titel: reservering.wat,
          begin,
          eind: plus(begin, 60),
          locatie: persoonlijk ? (plaats?.adres ?? plaats?.naam) : undefined,
          beschrijving: regels(
            naamVan(reservering.stadId),
            persoonlijk &&
              reservering.boekingsnummer &&
              `Boekingsnummer: ${reservering.boekingsnummer}`,
            persoonlijk && reservering.notitie,
          ),
          alarmen: [],
          zone,
        },
      });
    }
    if (reservering.status === 'te-regelen' && reservering.verkoopVanaf) {
      const begin = lokaalMoment(zone, reservering.verkoopVanaf, reservering.verkoopTijd);
      alle.push({
        datum: reservering.verkoopVanaf,
        kaartverkoop: true,
        item: {
          uid: `verkoop-${reservering.id}${DOMEIN}`,
          titel: `Kaartverkoop opent: ${reservering.wat}`,
          begin,
          eind: plus(begin, 15),
          beschrijving: regels(
            begin.soort === 'moment'
              ? `Om ${reservering.verkoopTijd} in ${naamVan(reservering.stadId) ?? 'Japan'}.`
              : 'De tijd van de verkoop staat nog niet in de app.',
          ),
          alarmen: ['P1D', 'PT15M'],
          zone,
        },
      });
    }
  }

  const gekozen = alle.filter((a) =>
    omvang.soort === 'alles'
      ? true
      : omvang.soort === 'kaartverkoop'
        ? a.kaartverkoop
        : a.datum === omvang.datum,
  );
  const sleutel = (t: AgendaTijd) =>
    t.soort === 'moment' ? t.utc : Date.parse(`${t.datum}T00:00:00Z`);
  return gekozen.map((a) => a.item).sort((a, b) => sleutel(a.begin) - sleutel(b.begin));
};
