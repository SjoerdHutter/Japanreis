import type { Kaartlagen, Laagpunt, Stad } from '@/domein/schema';
import type { KaartOverlay } from './Kaart';

/**
 * Van de meegeleverde kaartlagen naar lagen voor de lagenknop. Een eigen kleur
 * en teken per laag, zodat je ze ook door elkaar heen uit elkaar houdt.
 */

const alsUren = (uren: string): string => (uren.trim() === '24/7' ? 'dag en nacht' : uren);

const punten = (lijst: Laagpunt[], standaard: string): KaartOverlay['punten'] =>
  lijst.map(([lat, lon, naam = '', uitbater = '', uren = '']) => ({
    lat,
    lon,
    titel: naam || uitbater || standaard,
    regels: [naam && uitbater ? uitbater : '', uren ? `Open: ${alsUren(uren)}` : ''].filter(
      Boolean,
    ),
  }));

export const alsOverlays = (lagen: Kaartlagen, stad: Stad): KaartOverlay[] => [
  {
    id: 'geld',
    naam: stad.land === 'japan' ? 'Geldautomaten (7-Eleven, post)' : 'Geldautomaten',
    kleur: '#15803d',
    teken: stad.valuta === 'VND' ? '₫' : '¥',
    punten: punten(lagen.geld, 'Geldautomaat'),
  },
  {
    id: 'kluisjes',
    naam: 'Kluisjes',
    kleur: '#7c3aed',
    teken: 'K',
    punten: punten(lagen.kluisjes, 'Kluisjes'),
  },
  {
    id: 'toiletten',
    naam: 'Toiletten',
    kleur: '#0369a1',
    teken: 'WC',
    punten: punten(lagen.toiletten, 'Toilet'),
  },
];
