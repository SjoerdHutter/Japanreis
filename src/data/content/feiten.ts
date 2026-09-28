import { ALLERGEEN_NAAM } from '@/domein/schema';
import { ALLERGEEN_VERTALINGEN, APPS, NOOD, ZINNEN } from './index';

/**
 * Alle meegeleverde feiten die je voor vertrek nog moet nakijken, per groep.
 *
 * Het scherm Controleren leest deze lijst. Elk feit heeft dezelfde id als het
 * label "controleren" op de plek waar het in de app staat, zodat een vinkje op
 * de ene plek ook op de andere telt.
 */

export interface Feit {
  id: string;
  titel: string;
  detail?: string;
  gecontroleerd: boolean;
}

export interface Feitengroep {
  id: string;
  naam: string;
  /** Waar je het in de app terugvindt. */
  pad: string;
  feiten: Feit[];
}

export const noodFeitId = (id: string) => `nood:${id}`;
export const allergeenFeitId = (id: string) => `allergeen:${id}`;
export const zinFeitId = (id: string) => `zin:${id}`;
export const appFeitId = (id: string) => `app:${id}`;

const vasteGroepen = (): Feitengroep[] => [
  {
    id: 'nood',
    naam: 'Noodnummers en ambassades',
    pad: '/nood',
    feiten: [
      ...NOOD.landen.flatMap((land) => [
        ...land.nummers.map((n) => ({
          id: noodFeitId(n.id),
          titel: `${land.naam}, ${n.naam.toLowerCase()}`,
          detail: n.nummer,
          gecontroleerd: n.gecontroleerd,
        })),
        {
          id: noodFeitId(land.ambassade.id),
          titel: land.ambassade.naam,
          detail: `${land.ambassade.adres}, ${land.ambassade.telefoon}`,
          gecontroleerd: land.ambassade.gecontroleerd,
        },
      ]),
      ...NOOD.algemeen.map((n) => ({
        id: noodFeitId(n.id),
        titel: n.naam,
        detail: n.nummer,
        gecontroleerd: n.gecontroleerd,
      })),
      ...NOOD.rampen.map((r) => ({
        id: noodFeitId(r.id),
        titel: `Wat te doen bij een ${r.titel.toLowerCase()}`,
        gecontroleerd: r.gecontroleerd,
      })),
    ],
  },
  {
    id: 'allergenen',
    naam: 'Allergenen in het Japans en Vietnamees',
    pad: '/nood',
    feiten: ALLERGEEN_VERTALINGEN.map((a) => ({
      id: allergeenFeitId(a.id),
      titel: ALLERGEEN_NAAM[a.id],
      detail: `${a.japans}, ${a.vietnamees}`,
      gecontroleerd: a.gecontroleerd,
    })),
  },
  {
    id: 'zinnen',
    naam: 'Zinnen om te tonen',
    pad: '/context',
    feiten: ZINNEN.filter((z) => z.gecontroleerd !== undefined).map((z) => ({
      id: zinFeitId(z.id),
      titel: z.nederlands,
      detail: z.lokaal,
      gecontroleerd: z.gecontroleerd ?? true,
    })),
  },
  {
    id: 'apps',
    naam: 'Apps',
    pad: '/apps',
    feiten: APPS.filter((a) => a.gecontroleerd !== undefined).map((a) => ({
      id: appFeitId(a.id),
      titel: a.naam,
      detail: a.waarvoor,
      gecontroleerd: a.gecontroleerd ?? true,
    })),
  },
];

/**
 * Alle groepen. Asynchroon, omdat sommige content (de menukaart, de plaatsen)
 * pas wordt geladen als je hem opent.
 */
export const laadFeitgroepen = async (): Promise<Feitengroep[]> =>
  vasteGroepen().filter((g) => g.feiten.length > 0);
