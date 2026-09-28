import {
  openDB,
  type DBSchema,
  type IDBPDatabase,
  type IndexKey,
  type IndexNames,
  type StoreKey,
  type StoreNames,
  type StoreValue,
} from 'idb';
import type {
  Bijlage,
  Cachestatus,
  Coordinaat,
  EigenPunt,
  Gegeven,
  Dagnotitie,
  OpgeslagenReservering,
  OpgeslagenSpoor,
} from '@/domein/schema';
import type { Opname, Uitgave } from '@/domein/budget/uitgaven';
import type { Koersen } from '@/domein/valuta/koers';
import type { Keuze } from '@/domein/highlight/bepaal';
import type { JetlagInstellingen } from '@/domein/jetlag/protocol';
import type { WeerVanStad } from '@/domein/weer/verwachting';
import type { Overschrijving } from '@/domein/overschrijven/samenvoegen';
import { meldWijziging } from './wijzigingen';

/**
 * Alles wat op het toestel blijft staan.
 *
 * De redactionele content reist met de app mee en staat dus niet hier; wat hier
 * staat is van jou en van dit toestel: je highlight keuze, welke steden je
 * offline hebt klaargezet, de laatst opgehaalde wisselkoers, en straks je
 * notities, foto's en uitgaven. IndexedDB en niet localStorage, omdat er
 * later foto's bij komen en die passen daar niet in.
 *
 * Verhoog `DB_VERSIE` als er een store bij komt, en voeg hem toe in `upgrade`.
 * Bestaande stores nooit weggooien: dan verliest iemand die de app al draait
 * zijn gegevens bij een gewone update.
 */

/** Losse sleutels met een waarde: voorkeuren en kleine toestand. */
export interface SleutelWaarde {
  'highlight.keuze': Keuze;
  'stad.laatstBekeken': string;
  'koers.laatste': Koersen;
  'stempelboek.tipGetoond': boolean;
  /** Je gewone slaaptijden en je keuzes voor het jetlagplan. */
  'jetlag.instellingen': JetlagInstellingen;
  /** Wanneer je voor het laatst een backup maakte, als ISO-moment. */
  'backup.laatste': string;
  /** Tot wanneer de herinnering aan een backup even stil is. */
  'backup.uitgesteldTot': string;
  /** Wanneer er voor het laatst iets van jou veranderde, voor de backupherinnering. */
  'data.gewijzigdOp': string;
  /** Of de browser beloofde je gegevens niet zomaar op te ruimen. */
  'opslag.persistent': boolean;
}

interface JapanreisDB extends DBSchema {
  kv: { key: keyof SleutelWaarde; value: unknown };
  cachestatus: { key: string; value: Cachestatus };
  /** De persoonlijke laag: eigen punten uit Google Maps, Instagram of met de hand. */
  eigenpunten: { key: string; value: EigenPunt; indexes: { stad: string } };
  /** De foto's van de reis. Blijven op dit toestel; zie fotos.ts. */
  fotos: { key: string; value: OpgeslagenFoto; indexes: { genomenOp: string } };
  /** Het stempelboek: welke stempels je hebt gehaald. */
  stempels: { key: string; value: VerzameldeStempel; indexes: { stad: string } };
  /** Uitgaven en geldopnames; zie domein/budget. */
  uitgaven: { key: string; value: Uitgave };
  opnames: { key: string; value: Opname };
  /** Reserveringen en opgeslagen overstapplannen; zie domein/planning. */
  reserveringen: { key: string; value: Reservering };
  overstappen: { key: string; value: OpgeslagenOverstap };
  /**
   * Mijn gegevens: verzekering, noodcontacten, medisch, vluchten en verblijven.
   * Eén store met een index op soort, want het zijn allemaal kleine regels die
   * samen op één scherm staan. Zie domein/schema/gegevens.ts.
   */
  gegevens: { key: string; value: Gegeven; indexes: { soort: string } };
  /**
   * Bijlagen: pdf's en foto's bij je gegevens en reserveringen, als Blob. Met
   * een index op eigenaar, zodat een vlucht zijn e-ticket vindt zonder alle
   * paspoortfoto's langs te lopen.
   */
  bijlagen: { key: string; value: Bijlage; indexes: { eigenaar: string } };
  /**
   * Welke meegeleverde feiten je zelf hebt nagekeken: een noodnummer, een
   * vertaling, een laatste trein. Het vinkje is van jou, niet van de content.
   */
  controles: { key: string; value: Controle };
  /** De laatst opgehaalde weersverwachting per stad. Een cache, geen eigen gegevens. */
  weer: { key: string; value: WeerVanStad };
  /** Wat je per dag en stad in de dagplanner hebt gekozen. */
  dagplannen: { key: string; value: Dagplan };
  /** Je eigen waarden over de meegeleverde content heen; zie domein/overschrijven. */
  overschrijvingen: { key: string; value: Overschrijving };
  /** Gelopen routes uit GPX-bestanden; zie domein/sporen. */
  sporen: { key: string; value: OpgeslagenSpoor };
  /** Je notitie en hoogtepunt per dag, met de datum als sleutel. */
  dagnotities: { key: string; value: Dagnotitie };
}

/** Je keuze in de dagplanner voor één dag in één stad. */
export interface Dagplan {
  /** `${datum}_${stadId}` */
  id: string;
  datum: string;
  stadId: string;
  plaatsIds: string[];
  start: string;
  eind: string;
  /** Het regenvoorstel met de hand uitgezet. */
  regenUit?: boolean;
  gewijzigdOp: string;
}

/** Een feit uit de content dat je hebt nagekeken. De id is `bron:id`, zoals `nood:japan-politie`. */
export interface Controle {
  id: string;
  gecontroleerdOp: string;
}

/** Een reservering; het schema en de uitleg staan in domein/schema/opslag.ts. */
export type Reservering = OpgeslagenReservering;

/** Een opgeslagen overstapplan voor Hanoi, heen of terug. */
export interface OpgeslagenOverstap {
  /** 'heenreis' of 'terugreis'; twee plannen die los van elkaar staan. */
  id: 'heenreis' | 'terugreis';
  landing: string;
  vertrek: string;
  bagageOphalen: boolean;
  /** De punten die je voor dit dagdeel hebt gekozen. */
  plaatsIds: string[];
  bewaardOp: string;
}

/**
 * Een stempel die je hebt gehaald.
 *
 * De sleutel is de plaats plus het type, zodat je per plek één eki stamp en één
 * goshuin kunt hebben zonder dat ze elkaar overschrijven. Bij een tempel die
 * allebei aanbiedt zijn dat twee aparte regels, want het zijn twee aparte
 * boekjes.
 */
export interface VerzameldeStempel {
  /** `${plaatsId}:${type}` */
  id: string;
  plaatsId: string;
  stadId: string;
  type: 'eki' | 'goshuin';
  /** Wanneer je hem hebt gehaald, als ISO-datum. */
  gehaaldOp: string;
  /** De foto of scan van de stempel, als je die hebt gemaakt. */
  afbeelding?: Blob;
  notitie?: string;
}

/**
 * Een foto zoals hij op het toestel staat.
 *
 * De bytes zitten er als Blob in, twee keer: het origineel en een miniatuur.
 * Dat laatste is nodig omdat een galerij met vijftig foto's van vier megabyte
 * een telefoon plat legt, en het scheelt bij het scrollen door de tijdbalk
 * telkens opnieuw decoderen.
 *
 * Foto's blijven lokaal. Er is geen server om ze naartoe te sturen en er komt
 * er ook geen; delen gebeurt alleen via de export die je zelf aanzet.
 */
export interface OpgeslagenFoto {
  id: string;
  naam: string;
  /** Wanneer de foto genomen is, als ISO-moment. */
  genomenOp?: string;
  /** Dezelfde tijd zoals hij op de camera stond, zonder zone. Bepaalt de dag. */
  wandklok?: string;
  /** Of dat uit de EXIF komt of uit de datum van het bestand. */
  tijdstipBron?: 'exif' | 'bestand';
  coordinaten?: Coordinaat;
  /** Of jij de plek hebt aangewezen in plaats van de camera. */
  handmatigGeplaatst?: boolean;
  stadId?: string;
  /** De attractie of het restaurant waar de foto genomen is. */
  plaatsId?: string;
  volledig: Blob;
  miniatuur: Blob;
  toegevoegdOp: string;
}

const DB_NAAM = 'japanreis';
const DB_VERSIE = 12;

let dbBelofte: Promise<IDBPDatabase<JapanreisDB>> | null = null;

export const getDb = (): Promise<IDBPDatabase<JapanreisDB>> => {
  dbBelofte ??= openDB<JapanreisDB>(DB_NAAM, DB_VERSIE, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('cachestatus')) {
        db.createObjectStore('cachestatus', { keyPath: 'stadId' });
      }
      if (!db.objectStoreNames.contains('eigenpunten')) {
        const store = db.createObjectStore('eigenpunten', { keyPath: 'id' });
        // Een index op stad, zodat het stadsscherm niet de hele verzameling
        // hoeft door te lopen als er straks honderden punten in staan.
        store.createIndex('stad', 'stadId');
      }
      if (!db.objectStoreNames.contains('fotos')) {
        const store = db.createObjectStore('fotos', { keyPath: 'id' });
        // Op tijd, want dat is de volgorde waarin de fotokaart ze altijd wil.
        store.createIndex('genomenOp', 'genomenOp');
      }
      if (!db.objectStoreNames.contains('stempels')) {
        const store = db.createObjectStore('stempels', { keyPath: 'id' });
        store.createIndex('stad', 'stadId');
      }
      if (!db.objectStoreNames.contains('uitgaven')) {
        db.createObjectStore('uitgaven', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('opnames')) {
        db.createObjectStore('opnames', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('reserveringen')) {
        db.createObjectStore('reserveringen', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('overstappen')) {
        db.createObjectStore('overstappen', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('gegevens')) {
        const store = db.createObjectStore('gegevens', { keyPath: 'id' });
        store.createIndex('soort', 'soort');
      }
      if (!db.objectStoreNames.contains('bijlagen')) {
        const store = db.createObjectStore('bijlagen', { keyPath: 'id' });
        store.createIndex('eigenaar', 'eigenaar');
      }
      if (!db.objectStoreNames.contains('controles')) {
        db.createObjectStore('controles', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('weer')) {
        db.createObjectStore('weer', { keyPath: 'stadId' });
      }
      if (!db.objectStoreNames.contains('dagplannen')) {
        db.createObjectStore('dagplannen', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('overschrijvingen')) {
        db.createObjectStore('overschrijvingen', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sporen')) {
        db.createObjectStore('sporen', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('dagnotities')) {
        db.createObjectStore('dagnotities', { keyPath: 'datum' });
      }
    },
  });
  return dbBelofte;
};

/**
 * Lezen en schrijven met typen die kloppen. De `catch` eromheen is er omdat
 * IndexedDB in een privévenster of met geblokkeerde opslag gewoon weigert; de
 * app hoort dan door te draaien zonder geheugen, niet om te vallen.
 */
/** Elke store behalve `kv`, die zijn sleutel los krijgt in plaats van uit de waarde. */
export type Store = Exclude<StoreNames<JapanreisDB>, 'kv'>;
export type Waarde<S extends Store> = StoreValue<JapanreisDB, S>;
export type Sleutel<S extends Store> = StoreKey<JapanreisDB, S>;

/**
 * Stores die geen gegevens van jou bevatten maar een cache of toestand van dit
 * toestel. Een wijziging daarin is geen reden om aan een backup te herinneren.
 */
const GEEN_EIGEN_DATA = new Set<string>(['cachestatus', 'weer']);

/**
 * Onthoudt dat er iets van jou veranderde. De backupherinnering vergelijkt dit
 * met het moment van de laatste backup.
 */
export const markeerGewijzigd = (store?: string): void => {
  if (store && GEEN_EIGEN_DATA.has(store)) return;
  void schrijf('data.gewijzigdOp', new Date().toISOString());
};

/**
 * Algemene lees- en schrijfhulpjes voor de stores die er later bij kwamen.
 *
 * De oudere stores hebben elk een eigen setje functies hieronder, allemaal met
 * dezelfde try en catch. Voor elke nieuwe store nog eens tien van die functies
 * schrijven voegt niets toe; deze doen hetzelfde voor elke store.
 *
 * Schrijven geeft terug of het lukte. Bij je verzekering of een e-ticket wil je
 * weten dat opslaan mislukte, bijvoorbeeld omdat het toestel vol zit, in
 * plaats van dat het stilletjes verdwijnt.
 */
export const leesAlles = async <S extends Store>(store: S): Promise<Waarde<S>[]> => {
  try {
    return await (await getDb()).getAll(store);
  } catch {
    return [];
  }
};

export const leesEen = async <S extends Store>(
  store: S,
  sleutel: Sleutel<S>,
): Promise<Waarde<S> | undefined> => {
  try {
    return await (await getDb()).get(store, sleutel);
  } catch {
    return undefined;
  }
};

export const leesUitIndex = async <S extends Store, I extends IndexNames<JapanreisDB, S>>(
  store: S,
  index: I,
  sleutel: IndexKey<JapanreisDB, S, I>,
): Promise<Waarde<S>[]> => {
  try {
    return await (await getDb()).getAllFromIndex(store, index, sleutel);
  } catch {
    return [];
  }
};

export const bewaarIn = async <S extends Store>(
  store: S,
  ...waarden: Waarde<S>[]
): Promise<boolean> => {
  try {
    const transactie = (await getDb()).transaction(store, 'readwrite');
    await Promise.all([...waarden.map((w) => transactie.store.put(w)), transactie.done]);
    markeerGewijzigd(store);
    return true;
  } catch {
    return false;
  }
};

export const verwijderUit = async <S extends Store>(
  store: S,
  ...sleutels: Sleutel<S>[]
): Promise<boolean> => {
  try {
    const transactie = (await getDb()).transaction(store, 'readwrite');
    await Promise.all([...sleutels.map((k) => transactie.store.delete(k)), transactie.done]);
    markeerGewijzigd(store);
    return true;
  } catch {
    return false;
  }
};

export const lees = async <K extends keyof SleutelWaarde>(
  sleutel: K,
): Promise<SleutelWaarde[K] | undefined> => {
  try {
    const db = await getDb();
    return (await db.get('kv', sleutel)) as SleutelWaarde[K] | undefined;
  } catch {
    return undefined;
  }
};

export const schrijf = async <K extends keyof SleutelWaarde>(
  sleutel: K,
  waarde: SleutelWaarde[K],
): Promise<void> => {
  try {
    const db = await getDb();
    await db.put('kv', waarde, sleutel);
  } catch {
    /* geen opslag beschikbaar: dan onthoudt de app het deze sessie alleen */
  }
};

export const verwijder = async (sleutel: keyof SleutelWaarde): Promise<void> => {
  try {
    const db = await getDb();
    await db.delete('kv', sleutel);
  } catch {
    /* zie hierboven */
  }
};

export const leesCachestatus = async (): Promise<Cachestatus[]> => {
  try {
    return await (await getDb()).getAll('cachestatus');
  } catch {
    return [];
  }
};

export const schrijfCachestatus = async (status: Cachestatus): Promise<void> => {
  try {
    await (await getDb()).put('cachestatus', status);
  } catch {
    /* zie hierboven */
  }
};

/**
 * De eigen punten. Bewust in een aparte store en niet door de redactionele
 * content heen: die reist met de app mee en wordt bij elke update overschreven,
 * terwijl dit van jou is en moet blijven staan.
 */
export const leesEigenPunten = async (stadId?: string): Promise<EigenPunt[]> => {
  try {
    const db = await getDb();
    if (stadId === undefined) return await db.getAll('eigenpunten');
    return await db.getAllFromIndex('eigenpunten', 'stad', stadId);
  } catch {
    return [];
  }
};

export const bewaarEigenPunten = async (punten: EigenPunt[]): Promise<void> => {
  try {
    const db = await getDb();
    const transactie = db.transaction('eigenpunten', 'readwrite');
    await Promise.all([...punten.map((p) => transactie.store.put(p)), transactie.done]);
  } catch {
    /* geen opslag beschikbaar */
  }
  markeerGewijzigd();
};

/** Werkt één punt bij: een plek erbij zetten, koppelen of de notitie wijzigen. */
export const werkEigenPuntBij = async (punt: EigenPunt): Promise<void> => {
  try {
    await (await getDb()).put('eigenpunten', punt);
  } catch {
    /* geen opslag beschikbaar */
  }
  markeerGewijzigd();
};

export const verwijderEigenPunt = async (id: string): Promise<void> => {
  try {
    await (await getDb()).delete('eigenpunten', id);
  } catch {
    /* geen opslag beschikbaar */
  }
  markeerGewijzigd();
};

/** Gooit alles weg wat uit één import kwam, voor het geval het niet klopte. */
export const verwijderEigenPuntenVanLijst = async (lijst: string): Promise<number> => {
  try {
    const db = await getDb();
    const alle = await db.getAll('eigenpunten');
    const weg = alle.filter((p) => p.lijst === lijst);
    const transactie = db.transaction('eigenpunten', 'readwrite');
    await Promise.all([...weg.map((p) => transactie.store.delete(p.id)), transactie.done]);
    markeerGewijzigd();
    return weg.length;
  } catch {
    return 0;
  }
};

/**
 * De foto's van de reis.
 *
 * Bij het lezen komen de Blobs mee. Dat is bewust: de galerij heeft ze nodig en
 * een tweede ronde langs de database per foto is trager dan één keer alles
 * ophalen. Wie alleen de gegevens wil gebruikt `leesFotoGegevens`.
 */
export const leesFotos = async (): Promise<OpgeslagenFoto[]> => {
  try {
    return await (await getDb()).getAll('fotos');
  } catch {
    return [];
  }
};

export const bewaarFotos = async (fotos: OpgeslagenFoto[]): Promise<void> => {
  try {
    const db = await getDb();
    const transactie = db.transaction('fotos', 'readwrite');
    await Promise.all([...fotos.map((f) => transactie.store.put(f)), transactie.done]);
  } catch {
    /* geen opslag beschikbaar, of de schijf zit vol */
  }
  markeerGewijzigd();
};

export const werkFotoBij = async (foto: OpgeslagenFoto): Promise<void> => {
  try {
    await (await getDb()).put('fotos', foto);
  } catch {
    /* zie hierboven */
  }
  markeerGewijzigd();
};

export const verwijderFoto = async (id: string): Promise<void> => {
  try {
    await (await getDb()).delete('fotos', id);
  } catch {
    /* zie hierboven */
  }
  markeerGewijzigd();
};

/** Hoeveel ruimte de foto's innemen, voor de melding in het scherm. */
export const fotoRuimteBytes = async (): Promise<number> => {
  const fotos = await leesFotos();
  return fotos.reduce((totaal, f) => totaal + f.volledig.size + f.miniatuur.size, 0);
};

/** Het stempelboek. */
export const leesStempels = async (): Promise<VerzameldeStempel[]> => {
  try {
    return await (await getDb()).getAll('stempels');
  } catch {
    return [];
  }
};

export const bewaarStempel = async (stempel: VerzameldeStempel): Promise<void> => {
  try {
    await (await getDb()).put('stempels', stempel);
  } catch {
    /* geen opslag beschikbaar */
  }
  markeerGewijzigd();
};

export const verwijderStempel = async (id: string): Promise<void> => {
  try {
    await (await getDb()).delete('stempels', id);
  } catch {
    /* geen opslag beschikbaar */
  }
  markeerGewijzigd();
};

/** Uitgaven en opnames. */
export const leesUitgaven = async (): Promise<Uitgave[]> => {
  try {
    return await (await getDb()).getAll('uitgaven');
  } catch {
    return [];
  }
};

export const bewaarUitgave = async (uitgave: Uitgave): Promise<void> => {
  try {
    await (await getDb()).put('uitgaven', uitgave);
  } catch {
    /* geen opslag beschikbaar */
  }
  markeerGewijzigd();
};

export const verwijderUitgave = async (id: string): Promise<void> => {
  try {
    await (await getDb()).delete('uitgaven', id);
  } catch {
    /* geen opslag beschikbaar */
  }
  markeerGewijzigd();
};

export const leesOpnames = async (): Promise<Opname[]> => {
  try {
    return await (await getDb()).getAll('opnames');
  } catch {
    return [];
  }
};

export const bewaarOpname = async (opname: Opname): Promise<void> => {
  try {
    await (await getDb()).put('opnames', opname);
  } catch {
    /* geen opslag beschikbaar */
  }
  markeerGewijzigd();
};

export const verwijderOpname = async (id: string): Promise<void> => {
  try {
    await (await getDb()).delete('opnames', id);
  } catch {
    /* geen opslag beschikbaar */
  }
  markeerGewijzigd();
};

/** Reserveringen. */
export const leesReserveringen = async (): Promise<Reservering[]> => {
  try {
    return await (await getDb()).getAll('reserveringen');
  } catch {
    return [];
  }
};

export const bewaarReservering = async (reservering: Reservering): Promise<void> => {
  try {
    await (await getDb()).put('reserveringen', reservering);
  } catch {
    /* geen opslag beschikbaar */
  }
  meldWijziging('reserveringen');
  markeerGewijzigd();
};

/** Gooit een reservering weg, en de vouchers en QR-codes die erbij horen. */
export const verwijderReservering = async (id: string): Promise<void> => {
  try {
    const db = await getDb();
    await db.delete('reserveringen', id);
    const bijlagen = await db.getAllKeysFromIndex('bijlagen', 'eigenaar', `reservering:${id}`);
    if (bijlagen.length > 0) await verwijderUit('bijlagen', ...bijlagen);
  } catch {
    /* geen opslag beschikbaar */
  }
  meldWijziging('reserveringen', 'bijlagen');
  markeerGewijzigd();
};

/** Opgeslagen overstapplannen, heen en terug apart. */
export const leesOverstappen = async (): Promise<OpgeslagenOverstap[]> => {
  try {
    return await (await getDb()).getAll('overstappen');
  } catch {
    return [];
  }
};

export const bewaarOverstap = async (overstap: OpgeslagenOverstap): Promise<void> => {
  try {
    await (await getDb()).put('overstappen', overstap);
  } catch {
    /* geen opslag beschikbaar */
  }
  markeerGewijzigd();
};
