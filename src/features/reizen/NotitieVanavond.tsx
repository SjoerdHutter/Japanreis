import { useCallback, useState } from 'react';
import { NotebookPen } from 'lucide-react';
import { REISDAGEN, REISSCHEMA, STEDEN } from '@/data/content';
import { isLeeg, leesDagnotitie } from '@/data/dagnotities';
import { useOpslag } from '@/data/db/useOpslag';
import { avondVoorNotitie } from '@/domein/reizen/notitie';
import { Kaartje } from '@/ui/basis';
import { DagNotitie } from './DagNotitie';

/**
 * 's Avonds, als de notitie van vandaag nog leeg is: een zacht zetje. Na
 * acht uur in de tijdzone van de stad waar je bent, alleen op reisdagen, en
 * met het veld er meteen onder als je erop tikt.
 */
export const NotitieVanavond = () => {
  const [nu] = useState(() => new Date());
  const datum = avondVoorNotitie(nu, STEDEN, REISSCHEMA, REISDAGEN);

  const lader = useCallback(
    () => (datum ? leesDagnotitie(datum) : Promise.resolve(undefined)),
    [datum],
  );
  const { waarde: notitie, geladen } = useOpslag(lader, undefined, ['dagnotities']);
  const [schrijven, setSchrijven] = useState(false);

  if (!datum || !geladen) return null;
  // Eenmaal aan het schrijven blijft het veld staan, ook als het niet meer leeg is.
  if (!schrijven && !isLeeg(notitie)) return null;

  return (
    <section className="mb-6">
      <Kaartje className="p-3.5">
        {schrijven ? (
          <DagNotitie datum={datum} altijdOpen autoFocus />
        ) : (
          <button
            type="button"
            onClick={() => setSchrijven(true)}
            className="flex w-full items-start gap-3 text-left"
          >
            <NotebookPen
              className="mt-0.5 size-5 shrink-0 text-indigo-reis dark:text-papier/70"
              aria-hidden
            />
            <span className="min-w-0 flex-1 text-sm leading-relaxed">
              <span className="block font-medium">Hoe was je dag?</span>
              <span className="text-inkt-zacht dark:text-papier/65">
                Een paar regels nu zijn later je reisverslag. Tik om te schrijven.
              </span>
            </span>
          </button>
        )}
      </Kaartje>
    </section>
  );
};
