import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { stadMet } from '@/data/content';
import type { Reisdagkaart } from '@/domein/reizen/dagen';
import { alsDagLabel } from '@/features/jetlag/tekst';
import { WeerRegel } from '@/features/weer/WeerRegel';
import { WindWaarschuwing } from '@/features/weer/WindWaarschuwing';
import { Kaartje, Label } from '@/ui/basis';
import { ReisdagKaart } from './ReisdagKaart';
import { VerblijfKaart } from '@/features/verblijf/VerblijfKaart';
import { VerhuisHerinnering } from '@/features/verblijf/VerhuisHerinnering';

/**
 * Eén dag van de reis: waar je bent, het weer, de trein als je verkast, en een
 * knop naar de dagplanner voor die dag.
 */
export const DagKaart = ({
  dag,
  vandaag,
  gekozenReisdag,
}: {
  dag: Reisdagkaart;
  vandaag: boolean;
  /** De reisdag uit de link, om naartoe te scrollen en te markeren. */
  gekozenReisdag?: string | null;
}) => {
  const hoofdstad = dag.nachtStadId ?? dag.steden[dag.steden.length - 1];
  const steden = dag.steden.map((id) => stadMet(id)).filter((s) => s !== undefined);
  const planLink = hoofdstad
    ? `/dagplanner?${new URLSearchParams({ datum: dag.datum, stad: hoofdstad }).toString()}`
    : null;

  return (
    <Kaartje className={`grid scroll-mt-4 gap-3 p-4 ${vandaag ? 'ring-2 ring-zegel' : ''}`}>
      <div>
        <p className="flex items-center gap-2 text-sm text-inkt-zacht dark:text-papier/60">
          {alsDagLabel(dag.datum)}
          {vandaag && <Label toon="let-op">vandaag</Label>}
        </p>
        <h2 className="text-lg font-semibold tracking-tight">
          {steden.length === 0
            ? 'Onderweg'
            : steden.map((stad, i) => (
                <span key={stad.id}>
                  {i > 0 && <span className="font-normal text-inkt-zacht"> en </span>}
                  <Link to={`/stad/${stad.id}`} className="underline-offset-2 hover:underline">
                    {stad.naam}
                  </Link>
                </span>
              ))}
        </h2>
      </div>

      {steden.length > 0 && (
        <div className="grid gap-1">
          {steden.map((stad) => (
            <WeerRegel
              key={stad.id}
              stadId={stad.id}
              datum={dag.datum}
              metStad={steden.length > 1}
            />
          ))}
        </div>
      )}
      <WindWaarschuwing dagen={steden.map((s) => ({ stadId: s.id, datum: dag.datum }))} />

      {dag.reisdagen.map((reisdag) => (
        <div key={reisdag.id} id={`reisdag-${reisdag.id}`} className="scroll-mt-4">
          <ReisdagKaart reisdag={reisdag} ingebed gemarkeerd={reisdag.id === gekozenReisdag} />
        </div>
      ))}

      <VerblijfKaart datum={dag.datum} nachtStadId={dag.nachtStadId} />
      <VerhuisHerinnering datum={dag.datum} />

      {planLink && (
        <Link
          to={planLink}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-zegel underline-offset-2 hover:underline dark:text-zegel-licht"
        >
          <CalendarDays className="size-4" aria-hidden />
          Plan deze dag
        </Link>
      )}
    </Kaartje>
  );
};
