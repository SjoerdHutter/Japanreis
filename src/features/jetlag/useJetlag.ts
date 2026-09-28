import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { REISSCHEMA, STEDEN } from '@/data/content';
import { lees, schrijf } from '@/data/db/idb';
import {
  STANDAARD_INSTELLINGEN,
  maakJetlagplan,
  type JetlagInstellingen,
  type Jetlagplan,
} from '@/domein/jetlag/protocol';

/**
 * Je slaaptijden en het plan dat eruit volgt, gedeeld door het jetlagscherm en
 * het hoofdmenu.
 *
 * De instellingen staan op het toestel en niet in de YAML: hoe laat jij naar bed
 * gaat is geen reiscontent, en wie de app op een tweede toestel opent begint
 * gewoon met de standaard.
 */
export const useJetlag = (): {
  instellingen: JetlagInstellingen;
  wijzig: (nieuw: JetlagInstellingen) => void;
  /** Of de bewaarde instellingen binnen zijn. Tot dan rekent het plan met de standaard. */
  geladen: boolean;
  plan: Jetlagplan | null;
} => {
  const [instellingen, setInstellingen] = useState<JetlagInstellingen>(STANDAARD_INSTELLINGEN);
  const [geladen, setGeladen] = useState(false);
  // Wie al iets wijzigt voordat IndexedDB antwoordt, wil niet dat het oude
  // antwoord zijn wijziging daarna overschrijft.
  const gewijzigd = useRef(false);

  useEffect(() => {
    let levend = true;
    void lees('jetlag.instellingen').then((bewaard) => {
      if (!levend) return;
      if (bewaard && !gewijzigd.current) {
        setInstellingen({ ...STANDAARD_INSTELLINGEN, ...bewaard });
      }
      setGeladen(true);
    });
    return () => {
      levend = false;
    };
  }, []);

  const wijzig = useCallback((nieuw: JetlagInstellingen) => {
    gewijzigd.current = true;
    setInstellingen(nieuw);
    void schrijf('jetlag.instellingen', nieuw);
  }, []);

  const plan = useMemo(
    () => maakJetlagplan({ reisschema: REISSCHEMA, steden: STEDEN, instellingen }),
    [instellingen],
  );

  return { instellingen, wijzig, geladen, plan };
};
