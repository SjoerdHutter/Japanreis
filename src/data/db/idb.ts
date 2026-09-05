import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Cachestatus, Coordinaat, EigenPunt } from '@/domein/schema';
import type { Opname, Uitgave } from '@/domein/budget/uitgaven';
import type { Koersen } from '@/domein/valuta/koers';
import type { Keuze } from '@/domein/highlight/bepaal';

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
}

/**
 * Een reservering: restaurant, ryokan, of een ticket dat op een vast moment in
 * de verkoop gaat.
 *
 * Dat laatste is waarom dit meer is dan een lijstje. Het Ghibli Museum verkoopt
 * op de tiende van de maand ervoor en is binnen minuten weg; teamLab werkt met
 * tijdvakken. Wie dat moment mist, mist het bezoek.
 */
export interface Reservering {
  id: string;
  wat: string;
  /** Datum van het bezoek zelf, als YYYY-MM-DD. */
  datum?: string;
  /** Tijd van het bezoek als HH:MM. */
  tijd?: string;
  /** Wanneer de kaartverkoop opengaat, als YYYY-MM-DD. */
  verkoopVanaf?: string;
  stadId?: string;
  plaatsId?: string;
  status: 'te-regelen' | 'geboekt';
  notitie?: string;
}

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
const DB_VERSIE = 6;

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
    },
  });
  return dbBelofte;
};

/**
 * Lezen en schrijven met typen die kloppen. De `catch` eromheen is er omdat
 * IndexedDB in een privévenster of met geblokkeerde opslag gewoon weigert; de
 * app hoort dan door te draaien zonder geheugen, niet om te vallen.
 */
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
};

/** Werkt één punt bij: een plek erbij zetten, koppelen of de notitie wijzigen. */
export const werkEigenPuntBij = async (punt: EigenPunt): Promise<void> => {
  try {
    await (await getDb()).put('eigenpunten', punt);
  } catch {
    /* geen opslag beschikbaar */
  }
};

export const verwijderEigenPunt = async (id: string): Promise<void> => {
  try {
    await (await getDb()).delete('eigenpunten', id);
  } catch {
    /* geen opslag beschikbaar */
  }
};

/** Gooit alles weg wat uit één import kwam, voor het geval het niet klopte. */
export const verwijderEigenPuntenVanLijst = async (lijst: string): Promise<number> => {
  try {
    const db = await getDb();
    const alle = await db.getAll('eigenpunten');
    const weg = alle.filter((p) => p.lijst === lijst);
    const transactie = db.transaction('eigenpunten', 'readwrite');
    await Promise.all([...weg.map((p) => transactie.store.delete(p.id)), transactie.done]);
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
};

export const werkFotoBij = async (foto: OpgeslagenFoto): Promise<void> => {
  try {
    await (await getDb()).put('fotos', foto);
  } catch {
    /* zie hierboven */
  }
};

export const verwijderFoto = async (id: string): Promise<void> => {
  try {
    await (await getDb()).delete('fotos', id);
  } catch {
    /* zie hierboven */
  }
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
};

export const verwijderStempel = async (id: string): Promise<void> => {
  try {
    await (await getDb()).delete('stempels', id);
  } catch {
    /* geen opslag beschikbaar */
  }
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
};

export const verwijderUitgave = async (id: string): Promise<void> => {
  try {
    await (await getDb()).delete('uitgaven', id);
  } catch {
    /* geen opslag beschikbaar */
  }
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
};

export const verwijderOpname = async (id: string): Promise<void> => {
  try {
    await (await getDb()).delete('opnames', id);
  } catch {
    /* geen opslag beschikbaar */
  }
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
};

export const verwijderReservering = async (id: string): Promise<void> => {
  try {
    await (await getDb()).delete('reserveringen', id);
  } catch {
    /* geen opslag beschikbaar */
  }
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
};
