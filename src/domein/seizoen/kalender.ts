import type { Regio, Weerwaarschuwing } from '@/domein/schema';

/**
 * Wat er in dit seizoen speelt.
 *
 * Alles rekent met dagen in het jaar (MM-DD), want seizoenen herhalen zich en
 * een jaartal zou alleen maar in de weg zitten. Perioden die over de jaarwisseling
 * heen lopen worden expliciet afgehandeld; die zitten er in deze content niet in,
 * maar een tyfoonseizoen dat in december zou beginnen mag de logica niet breken.
 *
 * Het woord "typisch" staat overal in de content en in de teksten. Dat is geen
 * slag om de arm maar de waarheid: de kersenbloei schuift elk jaar met de winter
 * mee, soms tien dagen. Een app die een datum als voorspelling presenteert laat
 * je een vliegticket kopen voor kale takken.
 */

/** MM-DD naar een getal dat je kunt vergelijken, van 101 tot 1231. */
export const alsDagnummer = (mmdd: string): number => Number(mmdd.replace('-', ''));

export const dagnummerVan = (moment: Date): number => {
  const maand = String(moment.getUTCMonth() + 1).padStart(2, '0');
  const dag = String(moment.getUTCDate()).padStart(2, '0');
  return alsDagnummer(`${maand}-${dag}`);
};

/** Valt deze dag binnen de periode? Ook als die over de jaarwisseling loopt. */
export const binnenPeriode = (dag: number, vanaf: string, tot: string): boolean => {
  const van = alsDagnummer(vanaf);
  const tt = alsDagnummer(tot);
  return van <= tt ? dag >= van && dag <= tt : dag >= van || dag <= tt;
};

/** De waarschuwingen die op dit moment gelden, voor dit land. */
export const geldendeWaarschuwingen = (
  waarschuwingen: Weerwaarschuwing[],
  land: 'japan' | 'vietnam',
  moment: Date = new Date(),
): Weerwaarschuwing[] => {
  const dag = dagnummerVan(moment);
  return waarschuwingen.filter((w) => w.land === land && binnenPeriode(dag, w.vanaf, w.tot));
};

export type BloeiStand = 'ruim-voor' | 'binnenkort' | 'nu' | 'voorbij';

/**
 * Waar zit je ten opzichte van de bloei of het herfstblad?
 *
 * "Binnenkort" is de twee weken ervoor, want dat is het venster waarin je nog
 * iets aan je plannen kunt veranderen. "Nu" loopt van het begin tot een paar
 * dagen na het hoogtepunt; kersenbloesem houdt ongeveer tien dagen, herfstblad
 * langer.
 */
export const bloeiStand = (
  bloei: { begintTypisch: string; hoogtepuntTypisch: string; duurDagen?: number },
  moment: Date = new Date(),
): BloeiStand => {
  const dag = dagnummerVan(moment);
  const begin = alsDagnummer(bloei.begintTypisch);
  const duur = bloei.duurDagen ?? 21;

  // Ruw omrekenen naar dagen: het gaat om weken, niet om precisie.
  const einde = alsDagnummer(verschuif(bloei.begintTypisch, duur));
  const aanloop = alsDagnummer(verschuif(bloei.begintTypisch, -14));

  if (binnenPeriode(dag, bloei.begintTypisch, verschuif(bloei.begintTypisch, duur))) return 'nu';
  if (binnenPeriode(dag, verschuif(bloei.begintTypisch, -14), bloei.begintTypisch)) {
    return 'binnenkort';
  }
  return dag > einde && dag > begin && dag > aanloop ? 'voorbij' : 'ruim-voor';
};

/** MM-DD een aantal dagen verschuiven, met een schrikkeljaar als rekenbasis. */
export const verschuif = (mmdd: string, dagen: number): string => {
  const [maand, dag] = mmdd.split('-').map(Number);
  // 2024 is een schrikkeljaar, zodat 29 februari niet stilletjes wegvalt.
  const moment = new Date(Date.UTC(2024, maand - 1, dag + dagen));
  return `${String(moment.getUTCMonth() + 1).padStart(2, '0')}-${String(moment.getUTCDate()).padStart(2, '0')}`;
};

/** De regio waar een stad in valt. */
export const regioVoorStad = (regios: Regio[], stadId: string): Regio | undefined =>
  regios.find((r) => r.steden.includes(stadId));

/** MM-DD leesbaar maken: "24 maart". */
const MAANDEN = [
  'januari',
  'februari',
  'maart',
  'april',
  'mei',
  'juni',
  'juli',
  'augustus',
  'september',
  'oktober',
  'november',
  'december',
];

export const alsDatumtekst = (mmdd: string): string => {
  const [maand, dag] = mmdd.split('-').map(Number);
  return `${dag} ${MAANDEN[maand - 1]}`;
};
