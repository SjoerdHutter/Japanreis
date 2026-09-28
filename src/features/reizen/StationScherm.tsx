import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DoorOpen, ExternalLink, Luggage, TrainFront } from 'lucide-react';
import type { Kaartgebied } from '@/domein/schema';
import { REISDAGEN, stadMet, stationMet } from '@/data/content';
import { zoekLink } from '@/domein/reizen/reisdagen';
import { alsDagLabel } from '@/features/jetlag/tekst';
import { Kaart, type KaartPunt } from '@/features/kaart/Kaart';
import { OfflineKnop } from '@/features/kaart/OfflineKnop';
import { useApp } from '@/state/useApp';
import { Kaartje, Label, Sectiekop, Terug } from '@/ui/basis';

/**
 * Eén station: welke uitgang waarvoor, waar de Shinkansen zit, en hoe je
 * overstapt.
 *
 * Bovenaan de kaart met de uitgangen, want op een station is de vraag altijd
 * welke kant je op moet. Daaronder de uitgangen met hun naam in het Japans,
 * zodat je ze op de borden herkent.
 */

/** Hoeveel ruimte er rond de uitgangen op de kaart blijft, in graden. */
const RAND = 0.003;

const gebiedRond = (punten: KaartPunt[]): Kaartgebied => {
  const lats = punten.map((p) => p.coordinaten.lat);
  const lons = punten.map((p) => p.coordinaten.lon);
  return {
    zuidwest: { lat: Math.min(...lats) - RAND, lon: Math.min(...lons) - RAND },
    noordoost: { lat: Math.max(...lats) + RAND, lon: Math.max(...lons) + RAND },
  };
};

export const StationScherm = () => {
  const { stationId = '' } = useParams();
  const station = stationMet(stationId);
  const { positie } = useApp();

  const punten = useMemo<KaartPunt[]>(() => {
    if (!station) return [];
    const uitgangen = station.uitgangen.flatMap((u, i) =>
      u.coordinaten
        ? [
            {
              id: `${station.id}-uitgang-${i}`,
              naam: u.naamLokaal ? `${u.naam} ${u.naamLokaal}` : u.naam,
              coordinaten: u.coordinaten,
              laag: 'uitgang' as const,
              toelichting: u.waarvoor,
            },
          ]
        : [],
    );
    // Zonder uitgangen met een plek staat het station zelf op de kaart.
    return uitgangen.length > 0
      ? uitgangen
      : [
          {
            id: station.id,
            naam: station.naam,
            coordinaten: station.coordinaten,
            laag: 'uitgang' as const,
          },
        ];
  }, [station]);

  const gebied = useMemo(() => (punten.length > 0 ? gebiedRond(punten) : null), [punten]);

  if (!station || !gebied) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-4 pb-16">
        <Terug naar="/stations" />
        <p className="mt-3">Dit station staat niet in de app.</p>
      </div>
    );
  }

  const stad = stadMet(station.stad);
  const reisdagen = REISDAGEN.filter((r) =>
    r.stappen.some((s) => s.vanStation === station.id || s.naarStation === station.id),
  );
  const geschat = station.uitgangen.some((u) => u.coordinaten);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
      <Terug naar="/stations" />
      <header className="mt-1 mb-4">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{station.naam}</h1>
          {station.naamLokaal && (
            <span className="text-lg text-inkt-zacht dark:text-papier/60">
              {station.naamLokaal}
            </span>
          )}
          {station.soort === 'bus' && <Label>busstation</Label>}
        </div>
        <p className="mt-2 leading-relaxed text-inkt-zacht dark:text-papier/70">
          {station.samenvatting}
        </p>
      </header>

      <div className="mb-2">
        <Kaart punten={punten} gebied={gebied} positie={positie} hoogte="16rem" clusteren={false} />
      </div>
      <p className="mb-3 text-xs leading-relaxed text-inkt-zacht dark:text-papier/50">
        {geschat
          ? 'De punten van de uitgangen zijn geschat en kunnen vijftig meter naast de trap zitten. '
          : ''}
        <a
          href={zoekLink(station.naam)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-zegel dark:text-zegel-licht"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          Open in Google Maps
        </a>
      </p>
      {stad && (
        <div className="mb-6">
          <OfflineKnop stad={stad} />
        </div>
      )}

      <section className="mb-6">
        <Sectiekop>Uitgangen</Sectiekop>
        <div className="grid gap-2">
          {station.uitgangen.map((uitgang) => (
            <Kaartje key={uitgang.naam} className="flex gap-3 p-3.5">
              <DoorOpen
                className="mt-0.5 size-5 shrink-0 text-indigo-reis dark:text-papier/70"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{uitgang.naam}</span>
                  {uitgang.naamLokaal && (
                    <span className="text-lg leading-tight">{uitgang.naamLokaal}</span>
                  )}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-inkt-zacht dark:text-papier/65">
                  {uitgang.waarvoor}
                </p>
              </div>
            </Kaartje>
          ))}
        </div>
      </section>

      {station.shinkansen && (
        <section className="mb-6">
          <Sectiekop>Shinkansen</Sectiekop>
          <Kaartje className="flex gap-3 p-3.5">
            <TrainFront
              className="mt-0.5 size-5 shrink-0 text-indigo-reis dark:text-papier/70"
              aria-hidden
            />
            <p className="text-sm leading-relaxed">{station.shinkansen}</p>
          </Kaartje>
        </section>
      )}

      {station.overstappen && station.overstappen.length > 0 && (
        <section className="mb-6">
          <Sectiekop>Verder reizen</Sectiekop>
          <div className="grid gap-2">
            {station.overstappen.map((overstap) => (
              <Kaartje key={overstap.naar} className="p-3.5">
                <p className="font-medium">{overstap.naar}</p>
                <p className="mt-1 text-sm leading-relaxed text-inkt-zacht dark:text-papier/65">
                  {overstap.hoe}
                </p>
              </Kaartje>
            ))}
          </div>
        </section>
      )}

      {station.bagage && (
        <section className="mb-6">
          <Sectiekop>Bagage</Sectiekop>
          <Kaartje className="flex gap-3 p-3.5">
            <Luggage
              className="mt-0.5 size-5 shrink-0 text-indigo-reis dark:text-papier/70"
              aria-hidden
            />
            <p className="text-sm leading-relaxed">{station.bagage}</p>
          </Kaartje>
        </section>
      )}

      {station.tips && station.tips.length > 0 && (
        <section className="mb-6">
          <Sectiekop>Goed om te weten</Sectiekop>
          <ul className="grid gap-2">
            {station.tips.map((tip) => (
              <li
                key={tip}
                className="rounded-xl bg-papier-diep p-3 text-sm leading-relaxed dark:bg-nacht-diep"
              >
                {tip}
              </li>
            ))}
          </ul>
        </section>
      )}

      {reisdagen.length > 0 && (
        <section className="mb-6">
          <Sectiekop>Op je reis</Sectiekop>
          <div className="grid gap-2">
            {reisdagen.map((reisdag) => (
              <Link
                key={reisdag.id}
                to={`/reisdagen?dag=${reisdag.id}`}
                className="rounded-xl border border-black/5 bg-white/60 px-3.5 py-3 transition hover:bg-white dark:border-white/10 dark:bg-nacht-diep/60 dark:hover:bg-nacht-diep"
              >
                <span className="block font-medium">{reisdag.titel}</span>
                <span className="block text-sm text-inkt-zacht dark:text-papier/60">
                  {reisdag.datum ? alsDagLabel(reisdag.datum) : reisdag.wanneer}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs leading-relaxed text-inkt-zacht dark:text-papier/50">
        Niet ter plaatse gecontroleerd, en grote stations worden geregeld verbouwd. Bij twijfel
        hebben de borden op het station gelijk.
      </p>
    </div>
  );
};
