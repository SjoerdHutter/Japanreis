import type { Bedrag, Traject, Treinpas } from '@/domein/schema';

/**
 * Verdient de JR Pass zich terug?
 *
 * De rekensom is simpel: tel op wat de losse kaartjes kosten en leg dat naast
 * de prijs van de pas. Wat hem lastig maakt is dat mensen de pas kopen op gevoel
 * ("iedereen doet het") terwijl hij sinds de prijsverhoging van 2023 op een
 * gewone route van twee weken vaak niet meer uit kan.
 *
 * Deze module rekent en oordeelt niet: hij geeft het verschil, en het scherm
 * zegt erbij dat het een indicatie is met de prijzen die in de app staan.
 */

export interface GekozenRit {
  traject: Traject;
  /** Heen en terug telt als twee ritten. */
  aantal: number;
}

export interface Uitkomst {
  pas: Treinpas;
  /** Wat de losse kaartjes samen kosten. */
  losseKaartjes: Bedrag;
  /** Positief betekent dat de pas goedkoper is. */
  verschil: Bedrag;
  loont: boolean;
  /** Hoeveel je nog aan ritten tekortkomt om quitte te draaien. */
  tekort: Bedrag | null;
}

const valutaVan = (ritten: GekozenRit[], pas: Treinpas): Bedrag['valuta'] =>
  ritten[0]?.traject.enkeleReis.valuta ?? pas.prijs.valuta;

/** Wat de gekozen ritten samen kosten zonder pas. */
export const kostenZonderPas = (ritten: GekozenRit[], valuta: Bedrag['valuta']): Bedrag => ({
  bedrag: ritten.reduce((totaal, rit) => totaal + rit.traject.enkeleReis.bedrag * rit.aantal, 0),
  valuta,
});

/**
 * Rekent één pas door.
 *
 * Gooit als de prijzen in verschillende valuta staan. Dat is met opzet: stil
 * doorrekenen met yen en dong door elkaar levert een getal op dat er goed
 * uitziet en nergens op slaat.
 */
export const reken = (ritten: GekozenRit[], pas: Treinpas): Uitkomst => {
  const valuta = valutaVan(ritten, pas);
  if (ritten.some((r) => r.traject.enkeleReis.valuta !== valuta) || pas.prijs.valuta !== valuta) {
    throw new Error('De ritten en de pas staan niet in dezelfde valuta.');
  }

  const losseKaartjes = kostenZonderPas(ritten, valuta);
  const verschilBedrag = losseKaartjes.bedrag - pas.prijs.bedrag;

  return {
    pas,
    losseKaartjes,
    verschil: { bedrag: Math.abs(verschilBedrag), valuta },
    loont: verschilBedrag > 0,
    tekort: verschilBedrag >= 0 ? null : { bedrag: -verschilBedrag, valuta },
  };
};

/**
 * Alle passen doorgerekend, de voordeligste eerst.
 *
 * Sorteert op wat je werkelijk kwijt bent: bij een pas die loont is dat de prijs
 * van de pas, en anders die van de losse kaartjes. Zo staat bovenaan altijd de
 * keuze die het minste kost, ook als geen enkele pas uit kan.
 */
export const rekenAlles = (ritten: GekozenRit[], passen: Treinpas[]): Uitkomst[] =>
  passen
    .map((pas) => reken(ritten, pas))
    .sort((a, b) => {
      const kostA = a.loont ? a.pas.prijs.bedrag : a.losseKaartjes.bedrag;
      const kostB = b.loont ? b.pas.prijs.bedrag : b.losseKaartjes.bedrag;
      return kostA - kostB;
    });

/** Hoeveel reistijd de gekozen ritten samen kosten, in minuten. */
export const reistijdMinuten = (ritten: GekozenRit[]): number =>
  ritten.reduce((totaal, rit) => totaal + rit.traject.minuten * rit.aantal, 0);

/** Een traject opzoeken, ongeacht in welke richting het in de content staat. */
export const zoekTraject = (trajecten: Traject[], van: string, naar: string): Traject | undefined =>
  trajecten.find((t) => (t.van === van && t.naar === naar) || (t.van === naar && t.naar === van));
