import exifr from 'exifr';
import type { Coordinaat } from '@/domein/schema';

/**
 * GPS en tijdstip uit een foto halen.
 *
 * Er zit een bibliotheek onder, en dat is een bewuste keuze. EXIF zelf is te
 * doen, maar de randgevallen zijn dat niet: de bytevolgorde verschilt per
 * fabrikant, GPS zit in een eigen deeltabel met breuken in plaats van getallen,
 * en de HEIC-bestanden van een iPhone hebben een heel andere containervorm dan
 * JPEG. Dat zelf schrijven levert precies op de foto's die je onderweg maakt de
 * fouten op die je pas thuis ontdekt.
 *
 * De foto zelf verlaat het toestel niet. Dit leest alleen de kop van het
 * bestand uit; de bytes blijven waar ze zijn.
 */

export interface FotoGegevens {
  /** Waar de foto genomen is, als de camera dat heeft vastgelegd. */
  coordinaten?: Coordinaat;
  /**
   * De tijd zoals hij op de camera stond, als "YYYY-MM-DDTHH:mm:ss" en zonder
   * zone. Dit is de lokale tijd op de plek waar je stond, en dus de tijd die je
   * bedoelt als je zegt "die foto van vrijdagavond".
   */
  wandklok?: string;
  /** Uit welk veld het tijdstip kwam; handig als er iets vreemds uitkomt. */
  tijdstipBron?: 'exif' | 'bestand';
}

/**
 * De tijdstempel uit EXIF als wandklok.
 *
 * Dit is het addertje van EXIF: de tijd staat er zonder zone in. Een foto van
 * 18:30 in Kyoto staat als 18:30, en elke lezer die daar een zone bij verzint
 * zit ernaast. exifr bouwt er een Date van alsof het UTC is; door hem weer als
 * UTC uit te lezen krijg je precies de oorspronkelijke cijfers terug, en dat is
 * wat we willen bewaren.
 *
 * Zou je die Date als een echt moment gebruiken, dan schuift een avondfoto in
 * Japan negen uur op en belandt hij een dag verderop in de tijdbalk.
 */
const alsWandklok = (waarde: unknown): string | undefined => {
  if (waarde instanceof Date && !Number.isNaN(waarde.getTime())) {
    return waarde.toISOString().slice(0, 19);
  }
  if (typeof waarde === 'string') {
    const genormaliseerd = waarde.trim().replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(genormaliseerd)) {
      return genormaliseerd.replace(' ', 'T').slice(0, 19);
    }
  }
  return undefined;
};

const geldigeCoordinaat = (lat: unknown, lon: unknown): Coordinaat | undefined => {
  if (typeof lat !== 'number' || typeof lon !== 'number') return undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return undefined;
  // 0,0 ligt in de Atlantische Oceaan en betekent in de praktijk een leeg veld.
  if (lat === 0 && lon === 0) return undefined;
  return { lat, lon };
};

/**
 * Leest één foto uit. Gooit nooit: een bestand zonder EXIF, een schermafbeelding
 * of een foto waar de gegevens uit gestript zijn is geen fout maar een foto
 * zonder plek, en die hoort gewoon binnen te komen om met de hand geplaatst te
 * worden.
 */
export const leesFoto = async (bestand: File): Promise<FotoGegevens> => {
  try {
    const gegevens = (await exifr.parse(bestand, {
      // Alleen wat nodig is. Dat scheelt werk per foto, en bij een paar honderd
      // vakantiefoto's tikt dat aan.
      pick: ['DateTimeOriginal', 'CreateDate', 'GPSLatitude', 'GPSLongitude'],
      gps: true,
    })) as Record<string, unknown> | undefined;

    const coordinaten = geldigeCoordinaat(gegevens?.latitude, gegevens?.longitude);
    const wandklok = alsWandklok(gegevens?.DateTimeOriginal) ?? alsWandklok(gegevens?.CreateDate);

    if (wandklok) return { coordinaten, wandklok, tijdstipBron: 'exif' };
  } catch {
    /* geen leesbare EXIF: dan de datum van het bestand zelf */
  }

  // Zonder EXIF blijft de wijzigingsdatum van het bestand over. Die is wél een
  // echt moment, dus hij wordt naar de wandklok van dit toestel omgerekend; dat
  // is de beste schatting die er dan nog is. De bron staat erbij zodat het
  // scherm kan zeggen dat het een schatting is.
  if (!bestand.lastModified) return {};
  const moment = new Date(bestand.lastModified);
  const tweeCijfers = (n: number) => String(n).padStart(2, '0');
  const wandklok =
    `${moment.getFullYear()}-${tweeCijfers(moment.getMonth() + 1)}-${tweeCijfers(moment.getDate())}` +
    `T${tweeCijfers(moment.getHours())}:${tweeCijfers(moment.getMinutes())}:${tweeCijfers(moment.getSeconds())}`;
  return { wandklok, tijdstipBron: 'bestand' };
};
