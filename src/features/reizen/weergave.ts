import { Bus, Ship, TrainFront, TrainFrontTunnel, type LucideIcon } from 'lucide-react';
import type { VervoerSoort } from '@/domein/schema';

/** Een icoon per soort vervoer, zodat je een reisdag in één blik leest. */
export const VERVOER_ICOON: Record<VervoerSoort, LucideIcon> = {
  shinkansen: TrainFront,
  'limited-express': TrainFront,
  trein: TrainFront,
  metro: TrainFrontTunnel,
  bus: Bus,
  boot: Ship,
};

/**
 * Een reistijd kort genoeg voor naast een trein: "20 min", "1 uur 25 min".
 * Afgerond op vijf minuten, want preciezer zijn de tijden in het bestand niet.
 */
export const alsReistijd = (minuten: number): string => {
  const afgerond = Math.max(5, Math.round(minuten / 5) * 5);
  const uren = Math.floor(afgerond / 60);
  const rest = afgerond % 60;
  if (uren === 0) return `${rest} min`;
  return rest === 0 ? `${uren} uur` : `${uren} uur ${rest} min`;
};

export const RESERVEREN_TEKST = {
  verplicht: 'reserveren verplicht',
  aanbevolen: 'reserveren aanbevolen',
} as const;
