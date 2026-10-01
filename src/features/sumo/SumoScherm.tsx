import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Ban, Ear, Eye, Footprints, Grab, Hand, HandFist } from 'lucide-react';
import type { Plaats, SumoPunt, SumoSectie, SumoVerbod } from '@/domein/schema';
import { pasToe } from '@/domein/overschrijven/samenvoegen';
import { STEDEN, SUMO, laadAllePlaatsen } from '@/data/content';
import { useOverschrijvingen } from '@/data/overschrijvingen';
import { PlaatsRegel } from '@/features/stad/PlaatsRegel';
import { useApp } from '@/state/useApp';
import { Kaartje, Sectiekop, Terug } from '@/ui/basis';
import { Tekening } from './tekeningen';

/**
 * Sumo: waar je zelf de ring in kunt, en wat je moet weten voor je dat doet.
 *
 * Bovenaan de shows langs je route, omdat dat de vraag is waarmee je hier komt.
 * Daaronder de regels, de technieken en de tips, elk met een tekening: hoe je
 * wint zie je sneller dan je het leest. De tekst staat in data/sumo.yaml.
 */

type Icoon = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

/** De gordel met het kruisstuk, in de stijl van de andere tekentjes. */
const MawashiIcoon: Icoon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <path d="M3 7h18v5H3z" />
    <path d="M10 12v8h4v-8" />
  </svg>
);

/** Hoofd, hals en schouders. */
const KeelIcoon: Icoon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <circle cx="12" cy="6" r="3.5" />
    <path d="M10 9.5v4M14 9.5v4" />
    <path d="M5 21c0-4 3-7.5 7-7.5s7 3.5 7 7.5" />
  </svg>
);

const VERBOD_ICOON: Record<SumoVerbod, Icoon> = {
  vuist: HandFist,
  haar: Grab,
  ogen: Eye,
  oren: Ear,
  mawashi: MawashiIcoon,
  keel: KeelIcoon,
  trappen: Footprints,
  vingers: Hand,
};

const Kop = ({ punt }: { punt: SumoPunt }) => (
  <p className="flex flex-wrap items-baseline gap-x-2">
    <span className="font-medium">{punt.titel}</span>
    {punt.lokaal && (
      <span className="text-sm text-inkt-zacht dark:text-papier/60">{punt.lokaal}</span>
    )}
  </p>
);

const Uitleg = ({ children }: { children: string }) => (
  <p className="mt-1 text-sm leading-relaxed text-inkt-zacht dark:text-papier/70">{children}</p>
);

const Punten = ({ sectie }: { sectie: SumoSectie }) => {
  const punten = sectie.punten ?? [];
  if (punten.length === 0) return null;

  if (punten.some((p) => p.tekening)) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {punten.map((punt) => (
          <Kaartje key={punt.titel} className="p-2.5">
            {punt.tekening && <Tekening id={punt.tekening} />}
            <div className="px-1 pt-2.5 pb-1">
              <Kop punt={punt} />
              <Uitleg>{punt.tekst}</Uitleg>
            </div>
          </Kaartje>
        ))}
      </div>
    );
  }

  if (punten.some((p) => p.verbod)) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {punten.map((punt) => {
          const Teken = punt.verbod ? VERBOD_ICOON[punt.verbod] : null;
          return (
            <Kaartje key={punt.titel} className="flex gap-3 p-3.5">
              {Teken && (
                <span className="relative grid size-11 shrink-0 place-items-center text-inkt dark:text-papier">
                  <Teken className="size-5" aria-hidden />
                  <Ban
                    className="absolute inset-0 size-11 text-zegel/85 dark:text-zegel-licht/85"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </span>
              )}
              <div className="min-w-0">
                <Kop punt={punt} />
                <Uitleg>{punt.tekst}</Uitleg>
              </div>
            </Kaartje>
          );
        })}
      </div>
    );
  }

  if (sectie.stappen) {
    return (
      <ol className="grid gap-3">
        {punten.map((punt, i) => (
          <li key={punt.titel} className="flex gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-zegel text-sm font-semibold text-white dark:bg-zegel-licht dark:text-nacht">
              {i + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <Kop punt={punt} />
              <Uitleg>{punt.tekst}</Uitleg>
            </div>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <Kaartje className="divide-y divide-black/5 dark:divide-white/10">
      {punten.map((punt) => (
        <div key={punt.titel} className="p-3.5">
          <Kop punt={punt} />
          <Uitleg>{punt.tekst}</Uitleg>
        </div>
      ))}
    </Kaartje>
  );
};

const springNaar = (id: string) =>
  document.getElementById(`sumo-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export const SumoScherm = () => {
  const { positie } = useApp();
  const overschrijvingen = useOverschrijvingen();
  const [ruw, setRuw] = useState<Plaats[] | null>(null);

  useEffect(() => {
    let levend = true;
    void laadAllePlaatsen().then((alle) => {
      if (levend) setRuw(alle.filter((p) => p.tags?.includes('sumo')));
    });
    return () => {
      levend = false;
    };
  }, []);

  const plaatsen = useMemo(
    () => ruw?.map((p) => pasToe(p, overschrijvingen, 'plaats', p.id).waarde) ?? null,
    [ruw, overschrijvingen],
  );

  const metSumo = STEDEN.filter((s) => plaatsen?.some((p) => p.stad === s.id));
  const zonder = STEDEN.filter(
    (s) => s.land === 'japan' && !plaatsen?.some((p) => p.stad === s.id),
  ).map((s) => s.naam);

  const knoppen = [
    { id: 'waar', kort: 'Waar' },
    ...SUMO.secties,
    { id: 'woorden', kort: 'Woorden' },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
      <Terug naar="/meer" />
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Sumo</h1>
      <p className="mt-2 mb-4 leading-relaxed text-inkt-zacht dark:text-papier/70">{SUMO.intro}</p>

      <nav aria-label="Naar een onderdeel" className="mb-6 flex flex-wrap gap-1.5">
        {knoppen.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => springNaar(k.id)}
            className="rounded-full bg-papier-diep px-3 py-1.5 text-sm font-medium text-inkt hover:bg-[#e6dfd2] dark:bg-nacht-diep dark:text-papier dark:hover:bg-[#2c2820]"
          >
            {k.kort}
          </button>
        ))}
      </nav>

      <section id="sumo-waar" className="mb-8 scroll-mt-4">
        <Sectiekop>Waar je zelf de ring in kunt</Sectiekop>
        <p className="mb-4 leading-relaxed">
          Shows met oud-worstelaars, met eten erbij, waar je aan het eind zelf in een sumopak of
          mawashi tegen een van hen mag. Allemaal vooraf reserveren.
        </p>
        {plaatsen === null ? (
          <p className="text-sm text-inkt-zacht dark:text-papier/60">Laden…</p>
        ) : (
          <div className="grid gap-5">
            {metSumo.map((stad) => (
              <div key={stad.id}>
                <h3 className="mb-2 font-semibold">{stad.naam}</h3>
                <div className="grid gap-2">
                  {plaatsen
                    .filter((p) => p.stad === stad.id)
                    .map((plaats) => (
                      <PlaatsRegel
                        key={plaats.id}
                        plaats={plaats}
                        stad={stad}
                        vanaf={positie}
                        metGids={false}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {zonder.length > 0 && (
          <p className="mt-4 text-sm leading-relaxed text-inkt-zacht dark:text-papier/65">
            In {zonder.slice(0, -1).join(', ')} en {zonder.at(-1)} zijn geen shows waar je zelf
            meedoet. Prijzen en tijden wisselen; kijk ze na als je reserveert.
          </p>
        )}
      </section>

      {SUMO.secties.map((sectie) => (
        <section key={sectie.id} id={`sumo-${sectie.id}`} className="mb-8 scroll-mt-4">
          <Sectiekop>{sectie.titel}</Sectiekop>
          {sectie.tekst?.map((alinea) => (
            <p key={alinea.slice(0, 24)} className="mb-3 leading-relaxed">
              {alinea}
            </p>
          ))}
          {sectie.tekeningen && (
            <div
              className={`mb-4 grid gap-3 ${sectie.tekeningen.length > 1 ? 'sm:grid-cols-2' : 'max-w-md'}`}
            >
              {sectie.tekeningen.map((id) => (
                <Tekening key={id} id={id} />
              ))}
            </div>
          )}
          <Punten sectie={sectie} />
        </section>
      ))}

      <section id="sumo-woorden" className="mb-6 scroll-mt-4">
        <Sectiekop>Woorden die je hoort</Sectiekop>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {SUMO.woorden.map((w) => (
            <div key={w.woord}>
              <dt className="flex items-baseline gap-2">
                <span className="font-medium">{w.woord}</span>
                <span className="text-sm text-inkt-zacht dark:text-papier/60">{w.lokaal}</span>
              </dt>
              <dd className="text-sm leading-relaxed text-inkt-zacht dark:text-papier/70">
                {w.uitleg}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
};
