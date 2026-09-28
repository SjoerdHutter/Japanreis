import { Link } from 'react-router-dom';
import { Bus, TrainFront } from 'lucide-react';
import { STATIONS, STEDEN } from '@/data/content';
import { Sectiekop, Terug } from '@/ui/basis';

/**
 * De stationsgidsen, per stad in de volgorde van de reis.
 */
export const StationsScherm = () => (
  <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
    <Terug naar="/meer" />
    <h1 className="mt-1 text-2xl font-semibold tracking-tight">Stations</h1>
    <p className="mt-2 mb-5 leading-relaxed text-inkt-zacht dark:text-papier/70">
      Hoe je door de grote stations op je route komt: welke uitgang je wilt, waar de Shinkansen is
      en hoe je overstapt. Ook zonder bereik.
    </p>

    {STEDEN.map((stad) => {
      const stations = STATIONS.filter((s) => s.stad === stad.id);
      if (stations.length === 0) return null;
      return (
        <section key={stad.id} className="mb-6">
          <Sectiekop>{stad.naam}</Sectiekop>
          <div className="grid gap-2">
            {stations.map((station) => {
              const Icoon = station.soort === 'bus' ? Bus : TrainFront;
              return (
                <Link
                  key={station.id}
                  to={`/station/${station.id}`}
                  className="flex min-w-0 items-start gap-3 rounded-xl border border-black/5 bg-white/60 px-3.5 py-3 transition hover:bg-white dark:border-white/10 dark:bg-nacht-diep/60 dark:hover:bg-nacht-diep"
                >
                  <Icoon
                    className="mt-0.5 size-5 shrink-0 text-indigo-reis dark:text-papier/70"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium">{station.naam}</span>
                      {station.naamLokaal && (
                        <span className="text-sm text-inkt-zacht dark:text-papier/55">
                          {station.naamLokaal}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-sm text-inkt-zacht dark:text-papier/60">
                      {station.samenvatting}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      );
    })}
  </div>
);
