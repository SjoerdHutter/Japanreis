import { z } from 'zod';
import { strToU8 } from 'fflate';
import {
  bijlageGegevensSchema,
  controleRecordSchema,
  dagplanRecordSchema,
  eigenPuntSchema,
  fotoRecordSchema,
  gegevenSchema,
  opnameRecordSchema,
  overschrijvingRecordSchema,
  overstapRecordSchema,
  reserveringRecordSchema,
  stempelRecordSchema,
  uitgaveRecordSchema,
} from '@/domein/schema';
import {
  BACKUP_SCHEMA_VERSIE,
  backupNaam,
  blobPad,
  blobVerwijzingSchema,
  manifestPad,
  manifestSchema,
  storeBestandSchema,
  storePad,
  voegSamen,
  type BackupOpties,
  type Manifest,
} from '@/domein/backup/backup';
import {
  ZipFout,
  blobUit,
  leesInhoud,
  schrijfZip,
  tekstUit,
  type ZipInvoer,
} from '@/domein/backup/zip';
import { getDb, lees, leesAlles, schrijf, type SleutelWaarde, type Store } from './db/idb';
import { meldWijziging } from './db/wijzigingen';

/**
 * De backup maken en terugzetten.
 *
 * Welke stores erin gaan staat hieronder in één lijst. Een store die er later
 * bij komt hoort hier ook bij te komen, anders gaat hij bij een nieuw toestel
 * verloren; de test op die lijst vangt dat af.
 *
 * Bewust niet in de backup: de kaarttegels (die haal je opnieuw op), welke stad
 * je het laatst bekeek, je highlightkeuze van vandaag, en de laatst opgehaalde
 * wisselkoers en het weer. Dat is toestand van dit toestel, geen gegevens van jou.
 */

interface StoreBeschrijving {
  store: Store;
  /** Zoals hij in het voorbeeld van het terugzetten heet. */
  naam: string;
  schema: z.ZodType;
  /** Velden met een Blob, die als los bestand in de zip gaan. */
  blobs?: { veld: string; verplicht?: boolean }[];
  /** Alleen mee als deze keuze aan staat. */
  optie?: keyof BackupOpties;
  sleutel?: string;
}

export const BACKUP_STORES: StoreBeschrijving[] = [
  { store: 'gegevens', naam: 'Mijn gegevens', schema: gegevenSchema },
  {
    store: 'bijlagen',
    naam: 'Persoonlijke documenten en vouchers',
    schema: bijlageGegevensSchema,
    blobs: [{ veld: 'bestand', verplicht: true }, { veld: 'weergave' }, { veld: 'miniatuur' }],
    optie: 'documenten',
  },
  { store: 'reserveringen', naam: 'Reserveringen', schema: reserveringRecordSchema },
  { store: 'uitgaven', naam: 'Uitgaven', schema: uitgaveRecordSchema },
  { store: 'opnames', naam: 'Contant geld', schema: opnameRecordSchema },
  {
    store: 'stempels',
    naam: 'Stempels',
    schema: stempelRecordSchema,
    blobs: [{ veld: 'afbeelding' }],
  },
  {
    store: 'fotos',
    naam: "Foto's",
    schema: fotoRecordSchema,
    blobs: [
      { veld: 'volledig', verplicht: true },
      { veld: 'miniatuur', verplicht: true },
    ],
    optie: 'fotos',
  },
  { store: 'eigenpunten', naam: 'Eigen punten en lijsten', schema: eigenPuntSchema },
  { store: 'overstappen', naam: 'Overstapplannen', schema: overstapRecordSchema },
  { store: 'controles', naam: 'Nagekeken feiten', schema: controleRecordSchema },
  { store: 'dagplannen', naam: 'Dagplannen', schema: dagplanRecordSchema },
  { store: 'overschrijvingen', naam: 'Eigen waarden', schema: overschrijvingRecordSchema },
];

/** Instellingen uit de sleutelstore die met je meeverhuizen naar een ander toestel. */
const KV_IN_BACKUP: (keyof SleutelWaarde)[] = ['jetlag.instellingen', 'stempelboek.tipGetoond'];
/** Instellingen die in localStorage staan, zoals het thema. */
const LOKAAL_VOORVOEGSEL = 'japanreis.';
const INSTELLINGEN_PAD = 'instellingen.json';

const instellingenSchema = z.object({
  kv: z.record(z.string(), z.unknown()),
  lokaal: z.record(z.string(), z.string()),
});

const doetMee = (b: StoreBeschrijving, opties: BackupOpties) => !b.optie || opties[b.optie];

export interface Schatting {
  perStore: { store: Store; naam: string; aantal: number; bytes: number }[];
  bytes: number;
}

const blobGrootte = (regel: Record<string, unknown>, b: StoreBeschrijving): number =>
  (b.blobs ?? []).reduce((som, { veld }) => {
    const waarde = regel[veld];
    return som + (waarde instanceof Blob ? waarde.size : 0);
  }, 0);

/** Hoe groot de backup ongeveer wordt, per onderdeel. */
export const schatBackup = async (opties: BackupOpties): Promise<Schatting> => {
  const perStore: Schatting['perStore'] = [];
  for (const b of BACKUP_STORES.filter((b) => doetMee(b, opties))) {
    const regels = (await leesAlles(b.store)) as Record<string, unknown>[];
    const bytes = regels.reduce((som, r) => som + blobGrootte(r, b) + JSON.stringify(r).length, 0);
    perStore.push({ store: b.store, naam: b.naam, aantal: regels.length, bytes });
  }
  return { perStore, bytes: perStore.reduce((som, s) => som + s.bytes, 0) };
};

/**
 * Maakt de backup als één zip. `opVoortgang` telt de bestanden, zodat het
 * scherm iets kan laten zien terwijl tweehonderd foto's worden ingepakt.
 */
export const maakBackup = async (
  opties: BackupOpties,
  opVoortgang?: (klaar: number, totaal: number) => void,
): Promise<File> => {
  const moment = new Date();
  const inhoud: { b: StoreBeschrijving; regels: Record<string, unknown>[] }[] = [];
  for (const b of BACKUP_STORES.filter((b) => doetMee(b, opties))) {
    inhoud.push({ b, regels: (await leesAlles(b.store)) as Record<string, unknown>[] });
  }

  const kv: Record<string, unknown> = {};
  for (const sleutel of KV_IN_BACKUP) {
    const waarde = await lees(sleutel);
    if (waarde !== undefined) kv[sleutel] = waarde;
  }
  const lokaal: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const sleutel = localStorage.key(i);
      if (sleutel?.startsWith(LOKAAL_VOORVOEGSEL))
        lokaal[sleutel] = localStorage.getItem(sleutel) ?? '';
    }
  } catch {
    /* geen localStorage, bijvoorbeeld in een privévenster */
  }

  const manifest: Manifest = {
    app: 'japanreis',
    schemaVersie: BACKUP_SCHEMA_VERSIE,
    appVersie: __APP_VERSIE__,
    gemaaktOp: moment.toISOString(),
    opties,
    aantallen: Object.fromEntries(inhoud.map(({ b, regels }) => [b.store, regels.length])),
  };

  const totaal =
    inhoud.reduce(
      (som, { b, regels }) =>
        som +
        1 +
        regels.reduce(
          (n, r) => n + (b.blobs ?? []).filter(({ veld }) => r[veld] instanceof Blob).length,
          0,
        ),
      0,
    ) + 2;
  let klaar = 0;
  const tel = () => opVoortgang?.(++klaar, totaal);

  async function* bestanden(): AsyncGenerator<ZipInvoer> {
    yield { naam: manifestPad, data: strToU8(JSON.stringify(manifest, null, 2)), comprimeer: true };
    tel();
    yield {
      naam: INSTELLINGEN_PAD,
      data: strToU8(JSON.stringify({ kv, lokaal })),
      comprimeer: true,
    };
    tel();
    for (const { b, regels } of inhoud) {
      const alsJson: Record<string, unknown>[] = [];
      for (const [index, regel] of regels.entries()) {
        const kopie: Record<string, unknown> = { ...regel };
        for (const { veld } of b.blobs ?? []) {
          const blob = regel[veld];
          if (!(blob instanceof Blob)) {
            delete kopie[veld];
            continue;
          }
          const pad = blobPad(b.store, index, veld);
          kopie[veld] = { $blob: pad, type: blob.type };
          yield { naam: pad, data: new Uint8Array(await blob.arrayBuffer()), comprimeer: false };
          tel();
        }
        alsJson.push(kopie);
      }
      yield {
        naam: storePad(b.store),
        data: strToU8(JSON.stringify({ store: b.store, regels: alsJson })),
        comprimeer: true,
      };
      tel();
    }
  }

  const zip = await schrijfZip(bestanden());
  return new File([zip], backupNaam(moment), { type: 'application/zip' });
};

export interface TerugzetStore {
  b: StoreBeschrijving;
  regels: Record<string, unknown>[];
}

export interface Terugzetting {
  manifest: Manifest;
  stores: TerugzetStore[];
  instellingen: z.infer<typeof instellingenSchema>;
}

export class BackupFout extends Error {
  constructor(public fouten: string[]) {
    super(fouten[0]);
  }
}

/**
 * Leest een backup en controleert alles, zonder iets op te slaan. Gooit een
 * BackupFout met alle problemen tegelijk, zodat je ziet wat er mis is in plaats
 * van één melding per poging.
 */
export const leesBackup = async (bestand: Blob): Promise<Terugzetting> => {
  let inhoud;
  try {
    inhoud = await leesInhoud(bestand);
  } catch (fout) {
    throw new BackupFout([
      fout instanceof ZipFout ? fout.message : 'Dit bestand is niet te lezen.',
    ]);
  }
  const manifestItem = inhoud.get(manifestPad);
  if (!manifestItem)
    throw new BackupFout(['Dit is geen backup van Japanreis: het manifest ontbreekt.']);

  let manifest: Manifest;
  try {
    manifest = manifestSchema.parse(JSON.parse(await tekstUit(bestand, manifestItem)));
  } catch {
    throw new BackupFout(['Het manifest van deze backup is niet te lezen.']);
  }
  if (manifest.schemaVersie > BACKUP_SCHEMA_VERSIE) {
    throw new BackupFout([
      'Deze backup komt uit een nieuwere versie van de app. Werk de app eerst bij (Meer, onderaan) en probeer het dan opnieuw.',
    ]);
  }

  const fouten: string[] = [];
  const stores: TerugzetStore[] = [];
  for (const b of BACKUP_STORES) {
    const item = inhoud.get(storePad(b.store));
    if (!item) continue;
    let bestandInhoud;
    try {
      bestandInhoud = storeBestandSchema.parse(JSON.parse(await tekstUit(bestand, item)));
    } catch {
      fouten.push(`${b.naam}: het bestand is niet te lezen.`);
      continue;
    }
    const regels: Record<string, unknown>[] = [];
    for (const [i, ruw] of bestandInhoud.regels.entries()) {
      const zonderBlobs: Record<string, unknown> = { ...ruw };
      const blobs: Record<string, Blob> = {};
      let heel = true;
      for (const { veld, verplicht } of b.blobs ?? []) {
        delete zonderBlobs[veld];
        const verwijzing = blobVerwijzingSchema.safeParse(ruw[veld]);
        const zipItem = verwijzing.success ? inhoud.get(verwijzing.data.$blob) : undefined;
        if (verwijzing.success && zipItem) {
          blobs[veld] = await blobUit(bestand, zipItem, verwijzing.data.type);
        } else if (verplicht) {
          fouten.push(`${b.naam}, regel ${i + 1}: het bestand ${veld} ontbreekt in de backup.`);
          heel = false;
        }
      }
      const uitkomst = b.schema.safeParse(zonderBlobs);
      if (!uitkomst.success) {
        const probleem = uitkomst.error.issues[0];
        fouten.push(
          `${b.naam}, regel ${i + 1}: ${probleem.path.map(String).join('.') || 'regel'}: ${probleem.message}`,
        );
        continue;
      }
      if (heel) regels.push({ ...(uitkomst.data as Record<string, unknown>), ...blobs });
    }
    stores.push({ b, regels });
  }

  let instellingen: Terugzetting['instellingen'] = { kv: {}, lokaal: {} };
  const instellingenItem = inhoud.get(INSTELLINGEN_PAD);
  if (instellingenItem) {
    const uitkomst = instellingenSchema.safeParse(
      JSON.parse(await tekstUit(bestand, instellingenItem)),
    );
    if (uitkomst.success) instellingen = uitkomst.data;
    else fouten.push('De instellingen in deze backup zijn niet te lezen.');
  }

  if (fouten.length > 0) throw new BackupFout(fouten);
  return { manifest, stores, instellingen };
};

export interface Telling {
  store: Store;
  naam: string;
  inBackup: number;
  nieuw: number;
  nieuwer: number;
  overgeslagen: number;
  opToestel: number;
}

/** Wat samenvoegen en vervangen per onderdeel zouden doen. */
export const telTerugzetting = async (terugzetting: Terugzetting): Promise<Telling[]> => {
  const uit: Telling[] = [];
  for (const { b, regels } of terugzetting.stores) {
    const lokaal = (await leesAlles(b.store)) as Record<string, unknown>[];
    const samen = voegSamen(lokaal, regels, b.sleutel ?? 'id');
    uit.push({
      store: b.store,
      naam: b.naam,
      inBackup: regels.length,
      nieuw: samen.nieuw,
      nieuwer: samen.nieuwer,
      overgeslagen: samen.overgeslagen,
      opToestel: lokaal.length,
    });
  }
  return uit;
};

/**
 * Zet de backup terug. Bij vervangen worden alleen de onderdelen geleegd die in
 * de backup zitten: een backup zonder foto's laat je foto's staan.
 */
export const zetTerug = async (
  terugzetting: Terugzetting,
  modus: 'samenvoegen' | 'vervangen',
): Promise<number> => {
  const db = await getDb();
  let geschreven = 0;
  for (const { b, regels } of terugzetting.stores) {
    const teSchrijven =
      modus === 'vervangen'
        ? regels
        : voegSamen(
            (await leesAlles(b.store)) as Record<string, unknown>[],
            regels,
            b.sleutel ?? 'id',
          ).teBewaren;
    const transactie = db.transaction(b.store, 'readwrite');
    await Promise.all([
      ...(modus === 'vervangen' ? [transactie.store.clear()] : []),
      ...teSchrijven.map((regel) => transactie.store.put(regel as never)),
      transactie.done,
    ]);
    geschreven += teSchrijven.length;
  }

  for (const [sleutel, waarde] of Object.entries(terugzetting.instellingen.kv)) {
    if (!(KV_IN_BACKUP as string[]).includes(sleutel)) continue;
    const k = sleutel as keyof SleutelWaarde;
    if (modus === 'vervangen' || (await lees(k)) === undefined) {
      await schrijf(k, waarde as SleutelWaarde[typeof k]);
    }
  }
  try {
    for (const [sleutel, waarde] of Object.entries(terugzetting.instellingen.lokaal)) {
      if (!sleutel.startsWith(LOKAAL_VOORVOEGSEL)) continue;
      if (modus === 'vervangen' || localStorage.getItem(sleutel) === null) {
        localStorage.setItem(sleutel, waarde);
      }
    }
  } catch {
    /* geen localStorage */
  }

  // De backup telt als gemaakt op het moment dat hij gemaakt is, zodat een
  // vers teruggezet toestel niet meteen om een nieuwe backup vraagt.
  const gemaakt = terugzetting.manifest.gemaaktOp;
  const laatste = await lees('backup.laatste');
  if (!laatste || laatste < gemaakt) await schrijf('backup.laatste', gemaakt);
  if (!(await lees('data.gewijzigdOp'))) await schrijf('data.gewijzigdOp', gemaakt);

  meldWijziging('gegevens', 'bijlagen', 'reserveringen', 'controles', 'overschrijvingen');
  return geschreven;
};
