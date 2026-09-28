import type { Bijlage, BijlageEigenaar } from '@/domein/schema';
import { maakMiniatuur } from '@/domein/fotos/miniatuur';
import { pdfMiniatuur } from './pdf';

/**
 * Een gekozen bestand omzetten in een bijlage: soort herkennen, een miniatuur
 * maken, en een HEIC-foto omzetten naar JPEG.
 *
 * Over HEIC. Kies je een foto uit Foto's, dan maakt iOS er zelf al een JPEG
 * van. Kies je hem uit Bestanden, dan blijft het HEIC. Safari kan dat tekenen,
 * andere browsers niet; daarom wordt er naast het origineel een JPEG bewaard om
 * te tonen. Eerst met wat de browser zelf kan, en lukt dat niet met heic2any.
 * Die bibliotheek is groot en wordt pas geladen als hij nodig is.
 */

/** Boven deze grootte vraagt de app of je het bestand echt wilt bewaren. */
export const GROOT_BESTAND = 10 * 1024 * 1024;

/** Wat de bestandskiezer aanbiedt. Met image/* biedt iOS Foto's, Camera en Bestanden. */
export const BIJLAGE_ACCEPT = 'image/*,application/pdf';

const naamVan = (bestand: Blob): string => (bestand instanceof File ? bestand.name : '');

export const isPdf = (type: string, naam: string): boolean =>
  type === 'application/pdf' || /\.pdf$/i.test(naam);

export const isHeic = (type: string, naam: string): boolean =>
  /^image\/hei[cf]/i.test(type) || /\.hei[cf]$/i.test(naam);

export const isAfbeelding = (type: string, naam: string): boolean =>
  type.startsWith('image/') || isHeic(type, naam) || /\.(jpe?g|png|webp|gif)$/i.test(naam);

/** De langste zijde van de JPEG om te tonen. Scherp genoeg voor een QR-code op een pagina. */
const MAX_ZIJDE = 3000;

const viaCanvas = async (bestand: Blob): Promise<Blob> => {
  const bitmap = await createImageBitmap(bestand);
  try {
    const schaal = Math.min(1, MAX_ZIJDE / Math.max(bitmap.width, bitmap.height));
    const doek = new OffscreenCanvas(
      Math.max(1, Math.round(bitmap.width * schaal)),
      Math.max(1, Math.round(bitmap.height * schaal)),
    );
    const tekenvlak = doek.getContext('2d');
    if (!tekenvlak) throw new Error('Geen tekenvlak.');
    tekenvlak.drawImage(bitmap, 0, 0, doek.width, doek.height);
    return await doek.convertToBlob({ type: 'image/jpeg', quality: 0.88 });
  } finally {
    bitmap.close();
  }
};

export const naarJpeg = async (bestand: Blob): Promise<Blob> => {
  try {
    return await viaCanvas(bestand);
  } catch {
    const { default: heic2any } = await import('heic2any');
    const uit = await heic2any({ blob: bestand, toType: 'image/jpeg', quality: 0.88 });
    return Array.isArray(uit) ? uit[0] : uit;
  }
};

const nieuweId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `bijlage-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Maakt een bijlage klaar om te bewaren. Een miniatuur die niet lukt is geen
 * reden om het bestand te weigeren: dan komt er een icoon in de lijst.
 */
export const maakBijlage = async (
  bestand: Blob,
  eigenaar: BijlageEigenaar,
  label?: string,
): Promise<Bijlage> => {
  const naam = naamVan(bestand) || 'bestand';
  const pdf = isPdf(bestand.type, naam);
  const heic = isHeic(bestand.type, naam);
  const type =
    bestand.type || (pdf ? 'application/pdf' : heic ? 'image/heic' : 'application/octet-stream');

  let weergave: Blob | undefined;
  let miniatuur: Blob | undefined;
  if (pdf) {
    miniatuur = await pdfMiniatuur(bestand).catch(() => undefined);
  } else if (isAfbeelding(type, naam)) {
    if (heic) weergave = await naarJpeg(bestand).catch(() => undefined);
    miniatuur = await maakMiniatuur(weergave ?? bestand)
      .then((m) => m.blob)
      .catch(() => undefined);
  }

  const nu = new Date().toISOString();
  return {
    id: nieuweId(),
    eigenaar,
    naam,
    label: label?.trim() || undefined,
    type,
    grootte: bestand.size,
    bestand,
    weergave,
    miniatuur,
    toegevoegdOp: nu,
    gewijzigdOp: nu,
  };
};
