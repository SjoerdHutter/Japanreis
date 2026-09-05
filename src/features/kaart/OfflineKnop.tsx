import { useEffect, useRef, useState } from 'react';
import type { Stad } from '@/domein/schema';
import { Knop } from '@/ui/basis';
import { slaGebiedOp, tegelsVoorGebied, wisGebied } from '@/kaart/offline';
import { leesCachestatus, schrijfCachestatus } from '@/data/db/idb';

/**
 * "Stad offline opslaan": de kaarttegels van deze stad vooraf ophalen.
 *
 * De teksten en de content van de app reizen al mee, dus dit gaat alleen over
 * de kaart. Dat is met opzet de enige handeling die de gebruiker moet doen om
 * een stad volledig offline te hebben, en hij mag hem overslaan: zonder tegels
 * werkt alles behalve het plaatje onder de spelden.
 */
export const OfflineKnop = ({ stad }: { stad: Stad }) => {
  const [bezig, setBezig] = useState(false);
  const [klaar, setKlaar] = useState(0);
  const [opgeslagen, setOpgeslagen] = useState<number | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const afbreken = useRef<AbortController | null>(null);

  const totaal = tegelsVoorGebied(stad.kaartgebied).length;
  const schatting = Math.round((totaal * 18) / 1024);

  useEffect(() => {
    let levend = true;
    void leesCachestatus().then((statussen) => {
      if (!levend) return;
      setOpgeslagen(statussen.find((s) => s.stadId === stad.id)?.tegels ?? 0);
    });
    return () => {
      levend = false;
    };
  }, [stad.id]);

  useEffect(() => () => afbreken.current?.abort(), []);

  const start = async () => {
    setFout(null);
    setBezig(true);
    setKlaar(0);
    afbreken.current = new AbortController();
    try {
      const uitkomst = await slaGebiedOp(stad.kaartgebied, {
        signaal: afbreken.current.signal,
        opVoortgang: (v) => setKlaar(v.klaar),
      });
      const gelukt = uitkomst.klaar - uitkomst.mislukt;
      setOpgeslagen(gelukt);
      await schrijfCachestatus({
        stadId: stad.id,
        tegels: gelukt,
        opgeslagenOp: new Date().toISOString(),
      });
      if (uitkomst.mislukt > 0 && !uitkomst.afgebroken) {
        setFout(
          `${uitkomst.mislukt} tegels lukten niet. Probeer het nog een keer op een betere verbinding; wat al binnen is wordt overgeslagen.`,
        );
      }
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Opslaan lukte niet.');
    } finally {
      setBezig(false);
      afbreken.current = null;
    }
  };

  const wissen = async () => {
    await wisGebied(stad.kaartgebied);
    await schrijfCachestatus({ stadId: stad.id, tegels: 0, opgeslagenOp: null });
    setOpgeslagen(0);
  };

  const compleet = opgeslagen !== null && opgeslagen >= totaal * 0.95;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {bezig ? (
        <>
          <span className="text-sm text-inkt-zacht dark:text-papier/60">
            Kaart opslaan: {klaar} van {totaal}
          </span>
          <Knop klein soort="stil" onClick={() => afbreken.current?.abort()}>
            Stop
          </Knop>
        </>
      ) : (
        <>
          <Knop klein soort={compleet ? 'gewoon' : 'nadruk'} onClick={() => void start()}>
            {compleet ? 'Kaart staat offline' : 'Kaart offline opslaan'}
          </Knop>
          <span className="text-xs text-inkt-zacht dark:text-papier/50">
            {compleet
              ? `${opgeslagen} tegels op dit toestel`
              : `${totaal} tegels, ruwweg ${schatting} MB`}
          </span>
          {compleet && (
            <Knop klein soort="stil" onClick={() => void wissen()}>
              Wissen
            </Knop>
          )}
        </>
      )}
      {fout && <p className="w-full text-xs text-zegel">{fout}</p>}
    </div>
  );
};
