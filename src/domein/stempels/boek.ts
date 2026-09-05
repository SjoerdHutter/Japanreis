import type { Plaats, Stad } from '@/domein/schema';

/**
 * Het stempelboek: wat er te halen valt en wat je al hebt.
 *
 * Twee soorten die niet door elkaar mogen lopen. Een eki stamp is gratis en
 * staat op een station of bij een attractie; een goshuin is kalligrafie die ter
 * plekke geschreven wordt, kost een paar honderd yen en hoort in een eigen
 * boekje. Bij een tempel die allebei aanbiedt zijn dat twee aparte regels.
 */

export type StempelType = 'eki' | 'goshuin';

/** Een stempel die er volgens de content te halen valt. */
export interface TeHalen {
  id: string;
  plaatsId: string;
  stadId: string;
  type: StempelType;
  plaatsNaam: string;
  /** Waar de tafel of het kantoor precies staat. */
  waar: string;
  /** De openingstijden van het stempelkantoor, los van die van de tempel. */
  openingstijden?: string;
}

export const stempelId = (plaatsId: string, type: StempelType): string => `${plaatsId}:${type}`;

/** Alle stempels die er in deze verzameling plaatsen te halen zijn. */
export const teHalenUit = (plaatsen: Plaats[]): TeHalen[] => {
  const uitkomst: TeHalen[] = [];
  for (const plaats of plaatsen) {
    if (plaats.ekiStempel) {
      uitkomst.push({
        id: stempelId(plaats.id, 'eki'),
        plaatsId: plaats.id,
        stadId: plaats.stad,
        type: 'eki',
        plaatsNaam: plaats.naam,
        waar: plaats.ekiStempel.waar,
        openingstijden: plaats.ekiStempel.openingstijden?.standaard,
      });
    }
    if (plaats.goshuin) {
      uitkomst.push({
        id: stempelId(plaats.id, 'goshuin'),
        plaatsId: plaats.id,
        stadId: plaats.stad,
        type: 'goshuin',
        plaatsNaam: plaats.naam,
        waar: plaats.goshuin.waar,
        openingstijden: plaats.goshuin.openingstijden?.standaard,
      });
    }
  }
  return uitkomst;
};

export interface Teller {
  eki: { gehaald: number; totaal: number };
  goshuin: { gehaald: number; totaal: number };
  gehaald: number;
  totaal: number;
}

const leegTellertje = (): Teller => ({
  eki: { gehaald: 0, totaal: 0 },
  goshuin: { gehaald: 0, totaal: 0 },
  gehaald: 0,
  totaal: 0,
});

/**
 * De tellers, per stad en over de hele reis.
 *
 * De totalen tellen alleen wat er in de app staat. Onderweg kom je stempels
 * tegen die er niet in staan; die kun je toevoegen en dan telt het aantal
 * gehaalde hoger dan het totaal. Dat is geen fout maar een goede dag, dus de
 * teller draait dat niet stiekem terug.
 */
export const tellers = (
  teHalen: TeHalen[],
  gehaaldeIds: Set<string>,
  steden: Stad[],
): { totaal: Teller; perStad: Map<string, Teller> } => {
  const totaal = leegTellertje();
  const perStad = new Map<string, Teller>();
  for (const stad of steden) perStad.set(stad.id, leegTellertje());

  for (const stempel of teHalen) {
    const stad = perStad.get(stempel.stadId);
    totaal[stempel.type].totaal++;
    totaal.totaal++;
    if (stad) {
      stad[stempel.type].totaal++;
      stad.totaal++;
    }
    if (gehaaldeIds.has(stempel.id)) {
      totaal[stempel.type].gehaald++;
      totaal.gehaald++;
      if (stad) {
        stad[stempel.type].gehaald++;
        stad.gehaald++;
      }
    }
  }

  return { totaal, perStad };
};

/**
 * De tip over het goshuincho.
 *
 * Alleen bij het eerste bezoek en alleen zolang je er nog geen hebt gehaald,
 * want daarna is hij vervelend. Het punt van de tip is de timing: een
 * goshuincho koop je vooraf, en wie erachter komt als hij voor het loket staat
 * krijgt een los vel dat later nergens meer in past.
 */
export const toonGoshuinTip = (gehaaldeIds: Set<string>, tipGetoond: boolean): boolean =>
  !tipGetoond && ![...gehaaldeIds].some((id) => id.endsWith(':goshuin'));
