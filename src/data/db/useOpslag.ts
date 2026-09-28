import { useEffect, useRef, useState } from 'react';
import { opWijziging, type Onderwerp } from './wijzigingen';

/**
 * Leest iets uit de opslag en leest het opnieuw zodra een van de onderwerpen
 * verandert. `geladen` is onwaar tot het eerste antwoord er is, zodat een
 * scherm niet even "nog niets ingevuld" laat zien voordat IndexedDB antwoordt.
 */
export const useOpslag = <T>(
  lader: () => Promise<T>,
  beginwaarde: T,
  onderwerpen: Onderwerp[],
): { waarde: T; geladen: boolean; herlaad: () => void } => {
  const [waarde, setWaarde] = useState<T>(beginwaarde);
  const [geladen, setGeladen] = useState(false);
  const laderRef = useRef(lader);
  useEffect(() => {
    laderRef.current = lader;
  }, [lader]);
  const [teller, setTeller] = useState(0);
  const sleutel = onderwerpen.join(',');

  useEffect(() => {
    let levend = true;
    void laderRef.current().then((nieuw) => {
      if (!levend) return;
      setWaarde(nieuw);
      setGeladen(true);
    });
    return () => {
      levend = false;
    };
  }, [teller]);

  useEffect(
    () => opWijziging(sleutel.split(',') as Onderwerp[], () => setTeller((t) => t + 1)),
    [sleutel],
  );

  return { waarde, geladen, herlaad: () => setTeller((t) => t + 1) };
};
