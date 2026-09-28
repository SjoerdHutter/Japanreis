import werkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * Pdf's tonen met pdf.js.
 *
 * Safari toont een pdf in een iframe op een iPhone als één plaatje van de eerste
 * pagina, en een bevestiging van een hotel of een e-ticket heeft er vaak meer.
 * pdf.js tekent elke pagina zelf, zonder bereik.
 *
 * De bibliotheek is groot, dus hij wordt pas geladen als je voor het eerst een
 * pdf opent of toevoegt. De service worker heeft hem al bij de installatie
 * binnengehaald, zodat dat ook offline lukt. De legacy build, omdat die ook op
 * een iPhone met een iets oudere iOS draait.
 */

type Pdfjs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let bibliotheek: Promise<Pdfjs> | null = null;

const laadPdfjs = (): Promise<Pdfjs> =>
  (bibliotheek ??= import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = werkerUrl;
    return pdfjs;
  }));

export interface OpenPdf {
  pdf: PDFDocumentProxy;
  /** Geeft het geheugen en de worker weer vrij. */
  sluit: () => void;
}

export const openPdf = async (bestand: Blob): Promise<OpenPdf> => {
  const pdfjs = await laadPdfjs();
  const data = new Uint8Array(await bestand.arrayBuffer());
  const taak = pdfjs.getDocument({ data });
  const pdf = await taak.promise;
  return { pdf, sluit: () => void taak.destroy() };
};

/** Tekent één pagina op de gegeven breedte in css-pixels, scherp op het scherm. */
export const tekenPagina = async (
  pdf: PDFDocumentProxy,
  nummer: number,
  breedte: number,
  doek: HTMLCanvasElement,
): Promise<void> => {
  const pagina = await pdf.getPage(nummer);
  const basis = pagina.getViewport({ scale: 1 });
  const dichtheid = Math.min(window.devicePixelRatio || 1, 3);
  const beeld = pagina.getViewport({ scale: (breedte / basis.width) * dichtheid });
  doek.width = Math.floor(beeld.width);
  doek.height = Math.floor(beeld.height);
  doek.style.width = `${breedte}px`;
  doek.style.height = `${Math.floor(beeld.height / dichtheid)}px`;
  await pagina.render({ canvas: doek, viewport: beeld }).promise;
};

/** De eerste pagina als klein JPEG-plaatje, voor in de lijst. */
export const pdfMiniatuur = async (bestand: Blob, breedte = 240): Promise<Blob> => {
  const { pdf, sluit } = await openPdf(bestand);
  try {
    const pagina = await pdf.getPage(1);
    const basis = pagina.getViewport({ scale: 1 });
    const beeld = pagina.getViewport({ scale: breedte / basis.width });
    const doek = document.createElement('canvas');
    doek.width = Math.floor(beeld.width);
    doek.height = Math.floor(beeld.height);
    await pagina.render({ canvas: doek, viewport: beeld }).promise;
    return await new Promise<Blob>((klaar, mis) =>
      doek.toBlob(
        (blob) => (blob ? klaar(blob) : mis(new Error('geen plaatje'))),
        'image/jpeg',
        0.8,
      ),
    );
  } finally {
    sluit();
  }
};
