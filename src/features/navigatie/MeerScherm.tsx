import { Link } from 'react-router-dom';
import { Sectiekop } from '@/ui/basis';
import { GROEPEN } from './hulpmiddelen';
import { OpslagStatus } from '@/features/backup/OpslagStatus';

/**
 * Meer: alles wat de app kan, als tegels met een icoon en een regel uitleg.
 *
 * Een tegel en geen tekstlink, omdat je dit scherm onderweg met één duim
 * gebruikt. Een vlak van een paar centimeter raak je ook in een schommelende
 * trein; een onderstreept woord niet.
 */
export const MeerScherm = () => (
  <div className="mx-auto w-full max-w-2xl px-4 pt-5 pb-16">
    <h1 className="text-2xl font-semibold tracking-tight">Meer</h1>
    <p className="mt-1 text-sm text-inkt-zacht dark:text-papier/60">
      Alles wat de app kan, ook zonder bereik.
    </p>

    {GROEPEN.map((groep) => (
      <section key={groep.naam} className="mt-6">
        <Sectiekop>{groep.naam}</Sectiekop>
        <div className="grid grid-cols-2 gap-2">
          {groep.middelen.map(({ pad, naam, uitleg, icoon: Icoon }) => (
            <Link
              key={pad}
              to={pad}
              className="flex min-h-24 min-w-0 flex-col gap-1.5 rounded-2xl border border-black/5 bg-white/70 p-3.5 shadow-sm transition hover:bg-white active:scale-[0.98] dark:border-white/10 dark:bg-nacht-diep/70 dark:hover:bg-nacht-diep"
            >
              <Icoon className="size-6 text-zegel dark:text-zegel-licht" aria-hidden />
              <span className="leading-tight font-medium">{naam}</span>
              <span className="text-xs leading-snug text-inkt-zacht dark:text-papier/60">
                {uitleg}
              </span>
            </Link>
          ))}
        </div>
      </section>
    ))}

    <section className="mt-6">
      <OpslagStatus />
    </section>

    <p className="mt-10 text-center text-xs text-inkt-zacht dark:text-papier/40">
      Versie {__APP_VERSIE__}
    </p>
  </div>
);
