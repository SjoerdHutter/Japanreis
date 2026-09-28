import { useEffect, useMemo, useState } from 'react';
import type { Plaats } from '@/domein/schema';
import { pasToe, type Overschrijving } from '@/domein/overschrijven/samenvoegen';
import { laadPlaatsen } from './content';
import { useOverschrijvingen } from './overschrijvingen';

/**
 * De plaatsen van een stad, met je eigen waarden eroverheen: "alleen contant",
 * het beste moment voor een drukke tempel. Het stadsscherm en de dagplanner
 * rekenen zo met wat jij weet, en niet alleen met wat de app meebracht.
 *
 * Null zolang de plaatsen nog laden.
 */
export const usePlaatsen = (stadId: string | undefined): Plaats[] | null => {
  const [ruw, setRuw] = useState<{ stadId: string; plaatsen: Plaats[] } | null>(null);
  const overschrijvingen = useOverschrijvingen();

  useEffect(() => {
    if (!stadId) return;
    let levend = true;
    void laadPlaatsen(stadId).then((plaatsen) => {
      if (levend) setRuw({ stadId, plaatsen });
    });
    return () => {
      levend = false;
    };
  }, [stadId]);

  return useMemo(() => {
    if (!ruw || ruw.stadId !== stadId) return null;
    return ruw.plaatsen.map((p) => pasToe(p, overschrijvingen, 'plaats', p.id).waarde);
  }, [ruw, stadId, overschrijvingen]);
};

/** Welke velden van deze plaats een eigen waarde hebben. */
export const eigenVelden = (overschrijvingen: Overschrijving[], plaatsId: string): Set<string> =>
  new Set(
    overschrijvingen.filter((o) => o.doel === 'plaats' && o.doelId === plaatsId).map((o) => o.veld),
  );
