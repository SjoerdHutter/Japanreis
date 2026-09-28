import { Link } from 'react-router-dom';
import { Luggage } from 'lucide-react';
import { REISDAGEN, REISSCHEMA, STEDEN } from '@/data/content';
import { vandaagOpReis } from '@/domein/highlight/vandaag';
import {
  hoofdroute,
  reisdagenRondom,
  reserveringNodig,
  type ReisdagRondom,
} from '@/domein/reizen/reisdagen';
import { Kaartje, Label, Sectiekop } from '@/ui/basis';
import { RESERVEREN_TEKST, VERVOER_ICOON, alsReistijd } from './weergave';

/**
 * De reisdagen in het hoofdmenu: die van vandaag, en die van morgen alvast.
 *
 * Kort, met alleen de treinen en de tijden. De rest, de stations, de
 * alternatieven en de kofferregel, staat één tik verder.
 */
export const ReisdagVandaag = () => {
  const rondom = reisdagenRondom(REISDAGEN, vandaagOpReis(STEDEN, REISSCHEMA));
  if (rondom.length === 0) return null;
  return (
    <>
      {rondom.map((item) => (
        <ReisdagSamenvatting key={item.reisdag.id} {...item} />
      ))}
    </>
  );
};

const ReisdagSamenvatting = ({ reisdag, wanneer }: ReisdagRondom) => {
  const reserveren = reserveringNodig(reisdag);
  const naar = `/reisdagen?dag=${reisdag.id}`;

  return (
    <section className="mb-6">
      <Sectiekop
        extra={
          <Link
            to={naar}
            className="text-xs font-medium text-zegel underline underline-offset-2 dark:text-zegel-licht"
          >
            alles over deze dag
          </Link>
        }
      >
        {wanneer === 'vandaag' ? 'Vandaag reis je' : 'Morgen reis je'}
      </Sectiekop>
      <Link to={naar} className="block">
        <Kaartje className="p-4 transition hover:bg-white dark:hover:bg-nacht-diep">
          <p className="font-semibold">{reisdag.titel}</p>
          <ol className="mt-2 grid gap-1.5 text-sm">
            {hoofdroute(reisdag).map((stap, i) => {
              const Icoon = VERVOER_ICOON[stap.vervoer];
              return (
                <li key={`${stap.naam}-${i}`} className="flex items-center gap-2">
                  <Icoon
                    className="size-4 shrink-0 text-indigo-reis dark:text-papier/70"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">{stap.naam}</span>
                  <span className="shrink-0 text-inkt-zacht tabular-nums dark:text-papier/60">
                    {alsReistijd(stap.minuten)}
                  </span>
                </li>
              );
            })}
          </ol>
          {(reserveren || reisdag.bagage) && (
            <p className="mt-3 flex flex-wrap items-center gap-1.5">
              {reserveren && (
                <Label toon={reserveren === 'verplicht' ? 'let-op' : 'gewoon'}>
                  {RESERVEREN_TEKST[reserveren]}
                </Label>
              )}
              {reisdag.bagage && (
                <Label toon="let-op">
                  <Luggage className="-mt-0.5 mr-1 inline size-3.5" aria-hidden />
                  let op je koffer
                </Label>
              )}
            </p>
          )}
        </Kaartje>
      </Link>
    </section>
  );
};
