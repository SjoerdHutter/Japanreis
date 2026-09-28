import {
  CalendarDays,
  Camera,
  Import,
  Landmark,
  Languages,
  Lightbulb,
  Moon,
  Plane,
  Route,
  ScrollText,
  Signpost,
  Smartphone,
  Stamp,
  TrainFront,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/**
 * Alles wat de app kan, op één plek.
 *
 * Eerst stond dit als een rij tekstlinkjes helemaal onderaan het hoofdmenu,
 * onder alle steden en de geschiedenis. Wie onderweg snel het budget of een
 * zin wilde, moest eerst langs elf steden scrollen. Nu voedt deze lijst het
 * scherm Meer, en de vier die je het vaakst nodig hebt staan ook in de balk
 * onderaan.
 */

export interface Hulpmiddel {
  pad: string;
  naam: string;
  /** Eén regel over wat je er vindt, zodat een tegel meer zegt dan zijn naam. */
  uitleg: string;
  icoon: LucideIcon;
}

export interface Groep {
  naam: string;
  middelen: Hulpmiddel[];
}

export const GROEPEN: Groep[] = [
  {
    naam: 'Plannen',
    middelen: [
      {
        pad: '/reisdagen',
        naam: 'Reisdagen',
        uitleg: 'Welke trein of bus, en je koffer',
        icoon: Route,
      },
      {
        pad: '/stations',
        naam: 'Stations',
        uitleg: 'Uitgangen, Shinkansen en overstappen',
        icoon: Signpost,
      },
      {
        pad: '/dagplanner',
        naam: 'Dagplanner',
        uitleg: 'Een route met tijden, en je reserveringen',
        icoon: CalendarDays,
      },
      {
        pad: '/jetlag',
        naam: 'Jetlag',
        uitleg: 'Wanneer slapen, wanneer licht',
        icoon: Moon,
      },
      {
        pad: '/overstap',
        naam: 'Overstap Hanoi',
        uitleg: 'Wat past er in je overstap',
        icoon: Plane,
      },
      {
        pad: '/vervoer',
        naam: 'Vervoer en JR Pass',
        uitleg: 'Treinen, kaartjes en de rekentool',
        icoon: TrainFront,
      },
    ],
  },
  {
    naam: 'Onderweg',
    middelen: [
      {
        pad: '/budget',
        naam: 'Budget',
        uitleg: 'Uitgaven en je contante geld',
        icoon: Wallet,
      },
      {
        pad: '/context',
        naam: 'Etiquette en taal',
        uitleg: 'Zinnen om te laten zien, en het seizoen',
        icoon: Languages,
      },
      {
        pad: '/apps',
        naam: 'Handige apps',
        uitleg: 'Wat je vooraf installeert',
        icoon: Smartphone,
      },
      {
        pad: '/tips',
        naam: 'Tips',
        uitleg: 'Uit je Instagram collectie',
        icoon: Lightbulb,
      },
    ],
  },
  {
    naam: 'Bewaren',
    middelen: [
      {
        pad: '/fotos',
        naam: 'Fotokaart',
        uitleg: 'Je reis als lijn op de kaart',
        icoon: Camera,
      },
      {
        pad: '/stempels',
        naam: 'Stempelboek',
        uitleg: 'Eki stamps en goshuin',
        icoon: Stamp,
      },
      {
        pad: '/import',
        naam: 'Eigen punten',
        uitleg: 'Je Google Maps lijsten inlezen',
        icoon: Import,
      },
    ],
  },
  {
    naam: 'Geschiedenis',
    middelen: [
      {
        pad: '/tijdlijn/japan',
        naam: 'Tijdlijn Japan',
        uitleg: 'Van Nara tot nu',
        icoon: Landmark,
      },
      {
        pad: '/tijdlijn/hanoi',
        naam: 'Tijdlijn Hanoi',
        uitleg: 'Van Thang Long tot nu',
        icoon: ScrollText,
      },
    ],
  },
];
