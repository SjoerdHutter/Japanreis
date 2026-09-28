/**
 * Een bestand van de app naar buiten: delen, of anders downloaden.
 *
 * Op een iPhone is het deelvenster de weg naar iCloud Drive, Bestanden,
 * Agenda en AirDrop. Een gewone download werkt in een app op het beginscherm
 * wisselend: soms opent er een voorbeeld zonder bewaarknop. Daarom eerst
 * delen, en alleen als de browser dat niet kan een download.
 *
 * Roep dit aan vanuit een tik. Safari staat delen alleen toe als direct gevolg
 * van een handeling; wie eerst seconden rekent en dan pas deelt, krijgt een
 * weigering. Bij iets zwaars: eerst klaarzetten, dan een knop tonen.
 */

export type DeelUitkomst = 'gedeeld' | 'geannuleerd' | 'gedownload';

export const download = (bestand: Blob, naam: string): void => {
  const url = URL.createObjectURL(bestand);
  const link = document.createElement('a');
  link.href = url;
  link.download = naam;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  // Niet meteen intrekken: sommige browsers beginnen pas na deze tik te lezen.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export const kanDelen = (bestand: File): boolean => {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [bestand] });
  } catch {
    return false;
  }
};

export const deelOfDownload = async (bestand: File): Promise<DeelUitkomst> => {
  if (kanDelen(bestand)) {
    try {
      await navigator.share({ files: [bestand], title: bestand.name });
      return 'gedeeld';
    } catch (fout) {
      if (fout instanceof DOMException && fout.name === 'AbortError') return 'geannuleerd';
      // Geweigerd of mislukt: dan alsnog downloaden, zodat je niet met lege handen staat.
    }
  }
  download(bestand, bestand.name);
  return 'gedownload';
};

/** YYYY_MM_DD van vandaag, voor in een bestandsnaam. */
export { alsBestandsdatum as datumVoorBestand } from '@/domein/tijd/datums';
