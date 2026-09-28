import type {
  Accommodatie,
  Gegeven,
  Medisch,
  Noodcontact,
  Verzekering,
  Vlucht,
} from '@/domein/schema';
import { utcVan } from '@/domein/schema';

/**
 * Mijn gegevens staan als losse regels in één store. Dit zet ze op volgorde:
 * vluchten op vertrek, verblijven op de incheck, en de twee vaste secties los.
 */
export interface MijnGegevens {
  verzekering?: Verzekering;
  medisch?: Medisch;
  noodcontacten: Noodcontact[];
  vluchten: Vlucht[];
  accommodaties: Accommodatie[];
}

export const LEGE_GEGEVENS: MijnGegevens = {
  noodcontacten: [],
  vluchten: [],
  accommodaties: [],
};

const vertrekSleutel = (v: Vlucht): string => {
  const utc = utcVan(v.vertrek);
  return utc === null ? `${v.vertrek.datum}T99` : new Date(utc).toISOString();
};

export const orden = (gegevens: Gegeven[]): MijnGegevens => {
  const uit: MijnGegevens = { noodcontacten: [], vluchten: [], accommodaties: [] };
  for (const g of gegevens) {
    switch (g.soort) {
      case 'verzekering':
        uit.verzekering = g;
        break;
      case 'medisch':
        uit.medisch = g;
        break;
      case 'noodcontact':
        uit.noodcontacten.push(g);
        break;
      case 'vlucht':
        uit.vluchten.push(g);
        break;
      case 'accommodatie':
        uit.accommodaties.push(g);
        break;
    }
  }
  uit.noodcontacten.sort((a, b) => a.gewijzigdOp.localeCompare(b.gewijzigdOp));
  uit.vluchten.sort((a, b) => vertrekSleutel(a).localeCompare(vertrekSleutel(b)));
  uit.accommodaties.sort((a, b) => a.incheck.datum.localeCompare(b.incheck.datum));
  return uit;
};

/**
 * Waar je de nacht van deze datum slaapt: het verblijf waar je op of voor die
 * dag incheckt en na die dag uitcheckt. De nacht van 8 oktober is dus die van
 * 8 op 9 oktober, en de dag van de uitcheck telt niet meer mee.
 */
export const verblijfVanNacht = (
  datum: string,
  accommodaties: Accommodatie[],
): Accommodatie | undefined =>
  accommodaties.find((a) => a.incheck.datum <= datum && datum < a.uitcheck.datum);
