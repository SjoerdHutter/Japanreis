import { useEffect, useRef, useState } from 'react';
import { NotebookPen } from 'lucide-react';
import {
  bewaarConcept,
  bewaarDagnotitie,
  isLeeg,
  leesConcept,
  leesDagnotitie,
  vergeetConcept,
} from '@/data/dagnotities';
import { Invoer, Tekstvak } from '@/ui/formulier';

/**
 * De notitie bij een dag, en een kort hoogtepunt.
 *
 * Er is geen knop om te bewaren: wat je typt staat er een tel later in, en ook
 * als je het scherm verlaat voordat die tel voorbij is. Onderweg schrijf je in
 * een trein die een tunnel in rijdt of bij een kassa waar je weg moet; een
 * vergeten "opslaan" kost dan je hele avond.
 */

const WACHT_MS = 800;

type Stand = 'rust' | 'typt' | 'bewaard' | 'mislukt';

export const DagNotitie = ({
  datum,
  altijdOpen = false,
  autoFocus = false,
}: {
  datum: string;
  /** Meteen de velden tonen, ook als er nog niets staat. */
  altijdOpen?: boolean;
  autoFocus?: boolean;
}) => {
  const [geladen, setGeladen] = useState(false);
  const [open, setOpen] = useState(altijdOpen);
  const [notitie, setNotitie] = useState('');
  const [hoogtepunt, setHoogtepunt] = useState('');
  const [stand, setStand] = useState<Stand>('rust');

  // Wat er nog bewaard moet worden, en de klok die dat straks doet. In refs,
  // zodat het opruimen bij het verlaten van het scherm er nog bij kan.
  const wachtend = useRef<{ notitie: string; hoogtepunt: string } | null>(null);
  const klok = useRef<number | undefined>(undefined);

  useEffect(() => {
    let levend = true;
    void leesDagnotitie(datum).then((bewaard) => {
      if (!levend) return;
      const concept = leesConcept(datum);
      const inhoud = concept ?? {
        notitie: bewaard?.notitie ?? '',
        hoogtepunt: bewaard?.hoogtepunt ?? '',
      };
      setNotitie(inhoud.notitie);
      setHoogtepunt(inhoud.hoogtepunt);
      if (!isLeeg(inhoud)) setOpen(true);
      setGeladen(true);
    });
    return () => {
      levend = false;
    };
  }, [datum]);

  // Weg van het scherm, of de app naar de achtergrond, met iets dat nog niet
  // bewaard is: nu bewaren. Een iPhone bevriest een app op de achtergrond, en
  // dan loopt de klok hieronder niet meer af.
  useEffect(() => {
    const bewaarNu = () => {
      window.clearTimeout(klok.current);
      const nu = wachtend.current;
      wachtend.current = null;
      if (!nu) return;
      // Eerst synchroon, voor het geval de pagina verdwijnt voordat de database
      // klaar is; lukt het bewaren wel, dan is het concept niet meer nodig.
      bewaarConcept({ datum, ...nu });
      void bewaarDagnotitie(datum, nu).then((gelukt) => {
        if (gelukt) vergeetConcept(datum);
        setStand(gelukt ? 'bewaard' : 'mislukt');
      });
    };
    const bijVerbergen = () => {
      if (document.visibilityState === 'hidden') bewaarNu();
    };
    document.addEventListener('visibilitychange', bijVerbergen);
    window.addEventListener('pagehide', bewaarNu);
    return () => {
      document.removeEventListener('visibilitychange', bijVerbergen);
      window.removeEventListener('pagehide', bewaarNu);
      bewaarNu();
    };
  }, [datum]);

  const plan = (inhoud: { notitie: string; hoogtepunt: string }) => {
    wachtend.current = inhoud;
    setStand('typt');
    window.clearTimeout(klok.current);
    klok.current = window.setTimeout(() => {
      const nu = wachtend.current;
      wachtend.current = null;
      if (!nu) return;
      void bewaarDagnotitie(datum, nu).then((gelukt) => setStand(gelukt ? 'bewaard' : 'mislukt'));
    }, WACHT_MS);
  };

  if (!geladen) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-zegel underline-offset-2 hover:underline dark:text-zegel-licht"
      >
        <NotebookPen className="size-4" aria-hidden />
        Schrijf een notitie
      </button>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={`notitie-${datum}`} className="text-sm font-medium">
          Notitie
        </label>
        <span
          className={`text-xs ${stand === 'mislukt' ? 'text-zegel' : 'text-inkt-zacht dark:text-papier/55'}`}
          aria-live="polite"
        >
          {
            {
              rust: '',
              typt: 'bezig',
              bewaard: 'bewaard',
              mislukt: 'niet bewaard, is je toestel vol?',
            }[stand]
          }
        </span>
      </div>
      <Tekstvak
        id={`notitie-${datum}`}
        rows={4}
        value={notitie}
        autoFocus={autoFocus && !notitie}
        maxLength={20_000}
        placeholder="Wat deed je, wat at je, wat wil je onthouden?"
        onChange={(e) => {
          setNotitie(e.target.value);
          plan({ notitie: e.target.value, hoogtepunt });
        }}
      />
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Hoogtepunt van de dag</span>
        <Invoer
          value={hoogtepunt}
          maxLength={200}
          placeholder="In een paar woorden"
          onChange={(e) => {
            setHoogtepunt(e.target.value);
            plan({ notitie, hoogtepunt: e.target.value });
          }}
        />
      </label>
    </div>
  );
};
