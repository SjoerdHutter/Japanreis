import { z } from 'zod';
import { alsBestandsdatum } from '@/domein/tijd/datums';

/**
 * De backup: wat erin staat en hoe hij terug in de app komt.
 *
 * Eén zip met een manifest, per store een JSON-bestand, en de foto's en
 * bijlagen als losse bestanden. Het manifest zegt uit welke versie van de app
 * hij komt, wat erin zit en hoeveel; zo kan het terugzetten eerst laten zien
 * wat er gaat gebeuren, en weigeren wat het niet begrijpt.
 */

/**
 * Verhoog dit als de vorm van een store verandert op een manier die een oudere
 * app niet begrijpt. Een backup uit een nieuwere versie wordt dan geweigerd in
 * plaats van half teruggezet.
 */
export const BACKUP_SCHEMA_VERSIE = 1;

export const backupOptiesSchema = z.object({
  fotos: z.boolean(),
  documenten: z.boolean(),
});
export type BackupOpties = z.infer<typeof backupOptiesSchema>;

export const manifestSchema = z.object({
  app: z.literal('japanreis'),
  schemaVersie: z.number().int().positive(),
  appVersie: z.string(),
  gemaaktOp: z.string().min(1),
  opties: backupOptiesSchema,
  /** Aantal regels per store, ook voor een lege store. */
  aantallen: z.record(z.string(), z.number().int().nonnegative()),
});
export type Manifest = z.infer<typeof manifestSchema>;

/** Een verwijzing in de JSON naar een bestand elders in de zip. */
export const blobVerwijzingSchema = z.object({
  $blob: z.string().min(1),
  type: z.string(),
});
export type BlobVerwijzing = z.infer<typeof blobVerwijzingSchema>;

export const storeBestandSchema = z.object({
  store: z.string().min(1),
  regels: z.array(z.record(z.string(), z.unknown())),
});

export const backupNaam = (moment: Date = new Date()): string =>
  `japanreis_backup_${alsBestandsdatum(moment)}.zip`;

export const manifestPad = 'manifest.json';
export const storePad = (store: string): string => `stores/${store}.json`;
export const blobPad = (store: string, index: number, veld: string): string =>
  `blobs/${store}/${index}_${veld}`;

/**
 * Wanneer een regel voor het laatst veranderde. Niet elke store heeft een veld
 * met die naam, dus de eerste die er is telt. Zonder tijd is een regel nooit
 * nieuwer dan wat er al staat.
 */
export const tijdVan = (regel: Record<string, unknown>): string | undefined => {
  for (const veld of ['gewijzigdOp', 'toegevoegdOp', 'bewaardOp', 'gehaaldOp']) {
    const waarde = regel[veld];
    if (typeof waarde === 'string' && waarde) return waarde;
  }
  return undefined;
};

export interface Samenvoeging<T> {
  /** Wat er geschreven moet worden: nieuw, of nieuwer dan wat er stond. */
  teBewaren: T[];
  nieuw: number;
  nieuwer: number;
  /** Stond er al, even oud of nieuwer: blijft zoals het is. */
  overgeslagen: number;
}

/**
 * Samenvoegen op sleutel: wat er nog niet is komt erbij, en bij een regel die
 * er al is wint de nieuwste. Bij gelijke of onbekende tijd blijft staan wat op
 * het toestel staat, want dat is wat je het laatst in handen had.
 */
export const voegSamen = <T extends Record<string, unknown>>(
  lokaal: T[],
  uitBackup: T[],
  sleutel: string,
): Samenvoeging<T> => {
  const bestaand = new Map(lokaal.map((r) => [String(r[sleutel]), r]));
  const uit: Samenvoeging<T> = { teBewaren: [], nieuw: 0, nieuwer: 0, overgeslagen: 0 };
  for (const regel of uitBackup) {
    const hier = bestaand.get(String(regel[sleutel]));
    if (!hier) {
      uit.teBewaren.push(regel);
      uit.nieuw++;
      continue;
    }
    const daar = tijdVan(regel);
    const nu = tijdVan(hier);
    if (daar && (!nu || daar > nu)) {
      uit.teBewaren.push(regel);
      uit.nieuwer++;
    } else {
      uit.overgeslagen++;
    }
  }
  return uit;
};

/** Of een backup-herinnering op zijn plaats is: data sinds de laatste, en die is te oud. */
export const herinnerAanBackup = (
  laatsteBackup: string | undefined,
  laatsteWijziging: string | undefined,
  nu: Date,
  dagen = 3,
): boolean => {
  if (!laatsteWijziging) return false;
  if (!laatsteBackup) return true;
  const oud = nu.getTime() - Date.parse(laatsteBackup) > dagen * 86_400_000;
  return oud && laatsteWijziging > laatsteBackup;
};
