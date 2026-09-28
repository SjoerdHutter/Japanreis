import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Luggage } from 'lucide-react';
import type { Reisdag, Reisstap } from '@/domein/schema';
import { stationMet } from '@/data/content';
import { alternatieven, hoofdroute, reistijd, routeLink } from '@/domein/reizen/reisdagen';
import { alsDagLabel } from '@/features/jetlag/tekst';
import { Kaartje, Label } from '@/ui/basis';
import { RESERVEREN_TEKST, VERVOER_ICOON, alsReistijd } from './weergave';

/**
 * Eén reisdag, van het eerste station tot het laatste.
 *
 * De alternatieven staan er apart onder, na "of". Door elkaar gelezen lijkt een
 * reisdag met een alternatief anders op een route met vier treinen.
 */

const StationNaam = ({ naam, stationId }: { naam: string; stationId?: string }) => {
  const station = stationId ? stationMet(stationId) : undefined;
  if (!station) return <>{naam}</>;
  return (
    <Link
      to={`/station/${station.id}`}
      className="font-medium text-zegel underline underline-offset-2 dark:text-zegel-licht"
    >
      {naam}
    </Link>
  );
};

const StapRegel = ({ stap }: { stap: Reisstap }) => {
  const Icoon = VERVOER_ICOON[stap.vervoer];
  return (
    <li className="flex gap-3">
      <Icoon className="mt-0.5 size-5 shrink-0 text-indigo-reis dark:text-papier/70" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-medium">{stap.naam}</span>
          <span className="text-sm text-inkt-zacht tabular-nums dark:text-papier/60">
            {alsReistijd(stap.minuten)}
          </span>
          {stap.reserveren === 'verplicht' && (
            <Label toon="let-op">{RESERVEREN_TEKST.verplicht}</Label>
          )}
          {stap.reserveren === 'aanbevolen' && <Label>{RESERVEREN_TEKST.aanbevolen}</Label>}
        </div>
        <p className="mt-0.5 text-sm text-inkt-zacht dark:text-papier/65">
          <StationNaam naam={stap.van} stationId={stap.vanStation} /> naar{' '}
          <StationNaam naam={stap.naar} stationId={stap.naarStation} />
        </p>
        {stap.opmerking && (
          <p className="mt-1 text-sm leading-relaxed text-inkt-zacht dark:text-papier/65">
            {stap.opmerking}
          </p>
        )}
        <a
          href={routeLink(stap)}
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 inline-flex min-h-8 items-center gap-1 text-xs font-medium text-zegel dark:text-zegel-licht"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          Vertrektijden en perron in Google Maps
        </a>
      </div>
    </li>
  );
};

export const ReisdagKaart = ({
  reisdag,
  gemarkeerd = false,
  ingebed = false,
}: {
  reisdag: Reisdag;
  gemarkeerd?: boolean;
  /** Binnen de kaart van een dag: zonder eigen rand en zonder datum erboven. */
  ingebed?: boolean;
}) => {
  const route = hoofdroute(reisdag);
  const anders = alternatieven(reisdag);
  const overstappen = route.length - 1;
  const Houder = ingebed ? IngebedHouder : Kaartje;
  return (
    <Houder
      className={`scroll-mt-4 ${ingebed ? '' : 'p-4'} ${gemarkeerd ? 'ring-2 ring-zegel' : ''}`}
    >
      {!ingebed && (
        <p className="text-sm text-inkt-zacht dark:text-papier/60">
          {reisdag.datum ? alsDagLabel(reisdag.datum) : reisdag.wanneer}
        </p>
      )}
      <h2 className={ingebed ? 'font-semibold' : 'text-lg font-semibold tracking-tight'}>
        {reisdag.titel}
      </h2>
      <p className="mt-0.5 text-sm text-inkt-zacht dark:text-papier/60">
        Ongeveer {alsReistijd(reistijd(reisdag))} onderweg
        {overstappen > 0 && `, ${overstappen} ${overstappen === 1 ? 'overstap' : 'overstappen'}`}.
      </p>

      <ol className="mt-4 grid gap-4">
        {route.map((stap, i) => (
          <StapRegel key={`${stap.naam}-${i}`} stap={stap} />
        ))}
      </ol>

      {anders.length > 0 && (
        <>
          <p className="mt-5 mb-2 text-xs font-semibold tracking-wide text-inkt-zacht uppercase dark:text-papier/55">
            Of
          </p>
          <ul className="grid gap-4">
            {anders.map((stap, i) => (
              <StapRegel key={`${stap.naam}-${i}`} stap={stap} />
            ))}
          </ul>
        </>
      )}

      {reisdag.bagage && (
        <p className="mt-5 flex gap-2.5 rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
          <Luggage className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{reisdag.bagage}</span>
        </p>
      )}
      {reisdag.opmerking && (
        <p className="mt-3 text-sm leading-relaxed text-inkt-zacht dark:text-papier/65">
          {reisdag.opmerking}
        </p>
      )}
    </Houder>
  );
};

const IngebedHouder = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={`border-t border-black/5 pt-3 dark:border-white/10 ${className ?? ''}`}>
    {children}
  </div>
);
