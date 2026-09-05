import type { Plaats } from '@/domein/schema';

/**
 * De Hanoi overstapplanner uit hoofdstuk 14.
 *
 * Je vult je landingstijd en je vertrektijd in, en de app rekent uit wat er
 * haalbaar is. Werkt maanden vooraf vanaf de bank en hangt nergens van je
 * locatie af; dat is met opzet, want dit is precies de vraag die je thuis stelt
 * terwijl je de vlucht boekt.
 *
 * Alles rekent in minuten na middernacht op de dag van landing. Zo blijft een
 * overstap die over middernacht heen loopt gewoon een getal boven de 1440, en
 * hoeft er nergens met datums gegoocheld te worden.
 */

/** Reistijd tussen Noi Bai en het centrum, één kant op. */
export const RIT_MINUTEN = 45;

/**
 * Hoe lang je op de luchthaven kwijt bent voordat je de stad in kunt.
 *
 * Uitstappen, immigratie, eventueel bagage, en de weg naar de taxi vinden. Bij
 * een drukke aankomst loopt dat op; deze schatting is aan de ruime kant, want
 * een planner die te optimistisch is laat je een vlucht missen.
 */
export const AANKOMST_MINUTEN = 60;

/**
 * Hoe lang voor vertrek je terug moet zijn op de luchthaven.
 *
 * Drie uur voor een internationale vlucht is de gangbare aanbeveling en die
 * houden we aan. Wie krapper wil plannen kan dat zelf, maar de app moedigt het
 * niet aan.
 */
export const TERUG_VOOR_VERTREK_MINUTEN = 180;

export type Richting = 'heenreis' | 'terugreis';

export interface Invoer {
  richting: Richting;
  /** Landingstijd als "HH:MM". */
  landing: string;
  /** Vertrektijd van de volgende vlucht als "HH:MM". */
  vertrek: string;
  /**
   * Of je bagage moet ophalen en opnieuw inchecken. Dat bepaalt of de stadstrip
   * überhaupt kan: met je koffers aan de hand ga je de stad niet in.
   */
  bagageOphalen: boolean;
}

export interface Uitkomst {
  /** Minuten tussen landing en vertrek. Kan over middernacht heen lopen. */
  overstapMinuten: number;
  /** Wanneer je in het centrum kunt zijn, in minuten na middernacht. */
  inStadVanaf: number;
  /** Wanneer je uiterlijk uit het centrum moet vertrekken. */
  uitStadVoor: number;
  /** Hoeveel tijd je werkelijk in de stad hebt. Negatief betekent: niet haalbaar. */
  tijdInStadMinuten: number;
  haalbaar: boolean;
  /** Wat er in de weg zit, als het niet haalbaar is of op het randje. */
  waarschuwingen: string[];
}

/** "HH:MM" naar minuten na middernacht. Null bij iets dat geen tijd is. */
export const alsMinuten = (tijd: string): number | null => {
  const delen = /^(\d{1,2}):(\d{2})$/.exec(tijd.trim());
  if (!delen) return null;
  const uur = Number(delen[1]);
  const minuut = Number(delen[2]);
  if (uur > 23 || minuut > 59) return null;
  return uur * 60 + minuut;
};

/** Minuten na middernacht terug naar "HH:MM", ook voorbij de 1440. */
export const alsTijd = (minuten: number): string => {
  const genormaliseerd = ((minuten % 1440) + 1440) % 1440;
  const uur = Math.floor(genormaliseerd / 60);
  const minuut = genormaliseerd % 60;
  return `${String(uur).padStart(2, '0')}:${String(minuut).padStart(2, '0')}`;
};

/** "4 uur en 20 minuten", of "35 minuten". Voor op het scherm. */
export const alsDuur = (minuten: number): string => {
  const heel = Math.max(0, Math.round(minuten));
  const uur = Math.floor(heel / 60);
  const rest = heel % 60;
  if (uur === 0) return `${rest} ${rest === 1 ? 'minuut' : 'minuten'}`;
  if (rest === 0) return `${uur} uur`;
  return `${uur} uur en ${rest} ${rest === 1 ? 'minuut' : 'minuten'}`;
};

/**
 * De rekensom.
 *
 * Gooit niet bij onzin maar geeft null: het scherm vult dit bij elke toetsaanslag
 * opnieuw in, en halverwege het typen van "09:30" is de invoer nu eenmaal even
 * onvolledig.
 */
export const berekenOverstap = (invoer: Invoer): Uitkomst | null => {
  const landing = alsMinuten(invoer.landing);
  const vertrek = alsMinuten(invoer.vertrek);
  if (landing === null || vertrek === null) return null;

  // Vertrek voor de landing betekent de volgende dag; dat is bij een lange
  // overstap of een nachtvlucht de normale situatie.
  const vertrekAbsoluut = vertrek <= landing ? vertrek + 1440 : vertrek;
  const overstapMinuten = vertrekAbsoluut - landing;

  const waarschuwingen: string[] = [];

  const uitLuchthaven = landing + AANKOMST_MINUTEN + (invoer.bagageOphalen ? 30 : 0);
  const inStadVanaf = uitLuchthaven + RIT_MINUTEN;
  const uitStadVoor = vertrekAbsoluut - TERUG_VOOR_VERTREK_MINUTEN - RIT_MINUTEN;
  const tijdInStadMinuten = uitStadVoor - inStadVanaf;

  if (invoer.bagageOphalen) {
    waarschuwingen.push(
      'Je moet je bagage ophalen en opnieuw inchecken. Zet hem in een locker bij Noi Bai voordat je de stad in gaat, anders sleep je hem de hele dag mee.',
    );
  } else {
    waarschuwingen.push(
      'Controleer bij je maatschappij of je bagage is doorgecheckt. Zo niet, dan bepaalt dat of deze stadstrip überhaupt kan.',
    );
  }

  if (tijdInStadMinuten <= 0) {
    waarschuwingen.push(
      `Deze overstap is te kort voor de stad. Je hebt heen en terug al ${alsDuur(2 * RIT_MINUTEN)} aan reistijd nodig, plus de tijd op de luchthaven.`,
    );
  } else if (tijdInStadMinuten < 90) {
    waarschuwingen.push(
      'Dit is krap. Bij tegenvallend verkeer of een vertraagde landing houd je niets over.',
    );
  }

  if (inStadVanaf % 1440 >= 22 * 60 || inStadVanaf % 1440 < 5 * 60) {
    waarschuwingen.push(
      'Je komt midden in de nacht in de stad aan. De meeste plekken zijn dan dicht; een nachtelijke wandeling om het meer kan wel.',
    );
  }

  return {
    overstapMinuten,
    inStadVanaf,
    uitStadVoor,
    tijdInStadMinuten,
    haalbaar: tijdInStadMinuten > 0,
    waarschuwingen,
  };
};

export interface Voorstel {
  plaats: Plaats;
  /** Hoeveel minuten je hier kwijt bent, inclusief de tijd om er te komen. */
  minuten: number;
}

/** Hoeveel minuten je binnen het centrum tussen twee punten kwijt bent. */
const VERPLAATSING_MINUTEN = 15;

/**
 * Een haalbaar dagdeel voorstellen.
 *
 * Vult de beschikbare tijd met punten uit Hanoi, kortste bezoeken eerst zodat
 * er zoveel mogelijk in past, en houdt rekening met de tijd om ertussen te
 * komen. Punten zonder opgegeven bezoekduur krijgen een uur; dat is een
 * schatting, en beter dan ze overslaan.
 *
 * Geen looproute-optimalisatie: alle punten in dit voorstel liggen binnen een
 * halfuur lopen van het meer, en doen alsof er meer precisie is dan dat zou een
 * nauwkeurigheid suggereren die er niet is.
 */
export const stelDagdeelVoor = (plaatsen: Plaats[], beschikbareMinuten: number): Voorstel[] => {
  if (beschikbareMinuten <= 0) return [];

  const kandidaten = plaatsen
    .filter((p) => p.categorie === 'attractie' || p.categorie === 'eten')
    .map((plaats) => ({
      plaats,
      duur: plaats.attractie?.bezoekduurMinuten ?? (plaats.categorie === 'eten' ? 45 : 60),
    }))
    .sort((a, b) => a.duur - b.duur);

  const voorstel: Voorstel[] = [];
  let gebruikt = 0;

  for (const kandidaat of kandidaten) {
    // Voor het eerste punt reken je geen verplaatsing: daar begin je.
    const extra = voorstel.length === 0 ? 0 : VERPLAATSING_MINUTEN;
    if (gebruikt + extra + kandidaat.duur > beschikbareMinuten) continue;
    gebruikt += extra + kandidaat.duur;
    voorstel.push({ plaats: kandidaat.plaats, minuten: extra + kandidaat.duur });
  }

  return voorstel;
};
