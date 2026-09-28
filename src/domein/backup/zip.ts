import { Zip, ZipDeflate, ZipPassThrough, inflateSync, strFromU8 } from 'fflate';

/**
 * Een zip schrijven en lezen, zonder alles tegelijk in het geheugen.
 *
 * Een backup met foto's is al snel een paar honderd megabyte, en een iPhone
 * geeft een tabblad niet eindeloos geheugen. Schrijven gaat daarom bestand voor
 * bestand: elk stuk wordt meteen een Blob, die de browser op schijf mag zetten.
 * Foto's en pdf's worden niet opnieuw gecomprimeerd, dat levert niets op en
 * kost alleen tijd; de JSON wel.
 *
 * Lezen gaat via de inhoudsopgave achteraan de zip. Daarmee is van elk bestand
 * bekend waar het staat, en wordt een foto een stukje (slice) van het gekozen
 * bestand in plaats van een kopie in het geheugen. Het schrijven gebruikt
 * fflate; het lezen is zo klein dat het hier zelf staat, en werkt daardoor ook
 * op zips die fflate met gegevensblokken achteraan schrijft.
 */

export interface ZipInvoer {
  naam: string;
  data: Uint8Array;
  /** Comprimeren loont voor tekst, niet voor foto's en pdf's. */
  comprimeer: boolean;
}

export const schrijfZip = async (
  bestanden: AsyncIterable<ZipInvoer> | Iterable<ZipInvoer>,
): Promise<Blob> => {
  const delen: Blob[] = [];
  let fout: Error | null = null;
  let klaar = false;
  const zip = new Zip((err, stuk, laatste) => {
    if (err) fout = err;
    else if (stuk.length > 0) delen.push(new Blob([stuk as Uint8Array<ArrayBuffer>]));
    if (laatste) klaar = true;
  });

  for await (const bestand of bestanden) {
    const stroom = bestand.comprimeer
      ? new ZipDeflate(bestand.naam, { level: 6 })
      : new ZipPassThrough(bestand.naam);
    zip.add(stroom);
    stroom.push(bestand.data, true);
    if (fout) throw fout;
  }
  zip.end();
  if (fout) throw fout;
  if (!klaar) throw new Error('De zip is niet afgerond.');
  return new Blob(delen, { type: 'application/zip' });
};

export class ZipFout extends Error {}

export interface ZipItem {
  naam: string;
  /** 0 is ongecomprimeerd, 8 is deflate. */
  methode: number;
  gecomprimeerd: number;
  grootte: number;
  /** Waar de lokale kop van dit bestand begint. */
  kop: number;
}

const u16 = (b: Uint8Array, o: number): number => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number): number =>
  (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

const bytes = async (blob: Blob, van: number, tot: number): Promise<Uint8Array> =>
  new Uint8Array(await blob.slice(van, tot).arrayBuffer());

/** De inhoudsopgave van een zip: welke bestanden erin zitten en waar. */
export const leesInhoud = async (zip: Blob): Promise<Map<string, ZipItem>> => {
  if (zip.size < 22) throw new ZipFout('Dit is geen zip-bestand.');
  const staartLengte = Math.min(zip.size, 22 + 0xffff);
  const staart = await bytes(zip, zip.size - staartLengte, zip.size);
  let eind = -1;
  for (let i = staart.length - 22; i >= 0; i--) {
    if (u32(staart, i) === 0x06054b50) {
      eind = i;
      break;
    }
  }
  if (eind < 0) throw new ZipFout('Dit is geen zip-bestand.');

  const aantal = u16(staart, eind + 10);
  const opgaveGrootte = u32(staart, eind + 12);
  const opgaveStart = u32(staart, eind + 16);
  if (opgaveStart + opgaveGrootte > zip.size) throw new ZipFout('De zip is niet compleet.');
  const opgave = await bytes(zip, opgaveStart, opgaveStart + opgaveGrootte);

  const items = new Map<string, ZipItem>();
  let p = 0;
  for (let i = 0; i < aantal; i++) {
    if (u32(opgave, p) !== 0x02014b50) throw new ZipFout('De inhoudsopgave van de zip is kapot.');
    const naamLengte = u16(opgave, p + 28);
    const naam = strFromU8(opgave.subarray(p + 46, p + 46 + naamLengte));
    items.set(naam, {
      naam,
      methode: u16(opgave, p + 10),
      gecomprimeerd: u32(opgave, p + 20),
      grootte: u32(opgave, p + 24),
      kop: u32(opgave, p + 42),
    });
    p += 46 + naamLengte + u16(opgave, p + 30) + u16(opgave, p + 32);
  }
  return items;
};

/** Eén bestand uit de zip, als Blob met het gevraagde type. */
export const blobUit = async (zip: Blob, item: ZipItem, type = ''): Promise<Blob> => {
  const kop = await bytes(zip, item.kop, item.kop + 30);
  if (u32(kop, 0) !== 0x04034b50) throw new ZipFout(`${item.naam} is beschadigd.`);
  const start = item.kop + 30 + u16(kop, 26) + u16(kop, 28);
  const ruw = zip.slice(start, start + item.gecomprimeerd, type);
  if (item.methode === 0) return ruw;
  if (item.methode === 8) {
    const uitgepakt = inflateSync(new Uint8Array(await ruw.arrayBuffer()));
    return new Blob([uitgepakt], { type });
  }
  throw new ZipFout(`${item.naam} is op een manier ingepakt die de app niet kent.`);
};

export const tekstUit = async (zip: Blob, item: ZipItem): Promise<string> =>
  strFromU8(new Uint8Array(await (await blobUit(zip, item)).arrayBuffer()));
