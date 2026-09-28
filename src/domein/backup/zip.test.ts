import { describe, expect, it } from 'vitest';
import { unzipSync, strToU8 } from 'fflate';
import { ZipFout, blobUit, leesInhoud, schrijfZip, tekstUit } from './zip';

const foto = Uint8Array.from({ length: 5000 }, (_, i) => (i * 37) % 256);

const maak = () =>
  schrijfZip([
    {
      naam: 'manifest.json',
      data: strToU8(JSON.stringify({ hallo: 'wereld', é: 'ü' })),
      comprimeer: true,
    },
    { naam: 'blobs/fotos/0_volledig', data: foto, comprimeer: false },
    { naam: 'leeg.txt', data: new Uint8Array(0), comprimeer: true },
  ]);

describe('zip', () => {
  it('leest terug wat hij schreef, tekst en bestanden', async () => {
    const zip = await maak();
    const inhoud = await leesInhoud(zip);
    expect([...inhoud.keys()]).toEqual(['manifest.json', 'blobs/fotos/0_volledig', 'leeg.txt']);
    expect(JSON.parse(await tekstUit(zip, inhoud.get('manifest.json')!))).toEqual({
      hallo: 'wereld',
      é: 'ü',
    });
    const blob = await blobUit(zip, inhoud.get('blobs/fotos/0_volledig')!, 'image/jpeg');
    expect(blob.type).toBe('image/jpeg');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(foto);
    expect((await blobUit(zip, inhoud.get('leeg.txt')!)).size).toBe(0);
  });

  it('schrijft een gewone zip die andere programma’s ook openen', async () => {
    const zip = await maak();
    const uitgepakt = unzipSync(new Uint8Array(await zip.arrayBuffer()));
    expect(uitgepakt['blobs/fotos/0_volledig']).toEqual(foto);
  });

  it('weigert iets wat geen zip is', async () => {
    await expect(
      leesInhoud(new Blob(['geen zip, maar een tekst die lang genoeg is'])),
    ).rejects.toThrow(ZipFout);
  });

  it('merkt het als de zip halverwege is afgebroken', async () => {
    const zip = await maak();
    await expect(leesInhoud(zip.slice(0, zip.size - 10))).rejects.toThrow(ZipFout);
  });
});
