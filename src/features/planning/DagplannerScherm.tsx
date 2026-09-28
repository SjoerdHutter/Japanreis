import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CloudRain } from 'lucide-react';
import type { Plaats } from '@/domein/schema';
import { STEDEN, stadMet } from '@/data/content';
import { usePlaatsen } from '@/data/usePlaatsen';
import { bewaarIn, leesEen } from '@/data/db/idb';
import { THUIS_TIJDZONE, datumIn } from '@/domein/tijd/zones';
import { Kaartje, Knop, Label, Sectiekop } from '@/ui/basis';
import { alsKlok, maakDagplan } from '@/domein/planning/dagplanner';
import { alsMinuten } from '@/domein/planning/overstap';
import { splitsBijRegen } from '@/domein/planning/regen';
import { isRegendag } from '@/domein/weer/verwachting';
import { WeerRegel, weerVan } from '@/features/weer/WeerRegel';
import { WindWaarschuwing } from '@/features/weer/WindWaarschuwing';
import { useApp } from '@/state/useApp';
import { Reserveringen } from './Reserveringen';
import { LaatsteTreinMelding } from './LaatsteTreinMelding';

/**
 * De dagplanner en de reserveringsagenda uit hoofdstuk 12.
 *
 * Je vinkt punten aan, kiest een dag en een begintijd, en de app zet er een
 * route van met tijden erbij. Wat die dag gesloten is gaat eruit met de reden
 * erbij, en wat niet meer past komt apart te staan in plaats van stilletjes te
 * verdwijnen.
 *
 * Je keuze wordt per dag en per stad bewaard, zodat je thuis een dag in Kyoto
 * kunt plannen en hem daar weer terugvindt. Is het een regendag volgens de
 * verwachting, dan houdt het voorstel alleen wat bij regen kan, met een knop om
 * dat uit te zetten.
 */

const GEEN_PLAATSEN: Plaats[] = [];
const STANDAARD_START = '09:00';
const STANDAARD_EIND = '18:00';

/**
 * Een link met een andere datum of stad bouwt de planner opnieuw op, ook als
 * je er al op stond; anders bleef de vorige stad staan.
 */
export const DagplannerScherm = () => {
  const [zoekparams] = useSearchParams();
  return <Dagplanner key={`${zoekparams.get('datum')}_${zoekparams.get('stad')}`} />;
};

const Dagplanner = () => {
  const [zoekparams] = useSearchParams();
  const naarSectie = zoekparams.get('sectie');
  const { weer, highlight } = useApp();

  const [stadId, setStadId] = useState(() => {
    const uitLink = zoekparams.get('stad');
    if (uitLink && stadMet(uitLink)) return uitLink;
    return highlight.stadId ?? STEDEN[0]?.id ?? '';
  });
  const [gekozen, setGekozen] = useState<Set<string>>(new Set());
  const [gekozenDatum, setGekozenDatum] = useState<string | null>(() => zoekparams.get('datum'));
  const [start, setStart] = useState(STANDAARD_START);
  const [eind, setEind] = useState(STANDAARD_EIND);
  const [regenUit, setRegenUit] = useState(false);

  const stad = stadMet(stadId);
  /**
   * De dag van het plan: tot je er zelf een kiest, vandaag in de stad die je
   * plant. Eerst was dat de datum in UTC, en die loopt in Japan negen uur
   * achter. Wie op een maandag voor negen uur 's ochtends een dag in Kyoto
   * plande, kreeg de sluitingsdagen van zondag, terwijl veel musea juist op
   * maandag dicht zijn.
   */
  const datum = gekozenDatum ?? datumIn(stad?.tijdzone ?? THUIS_TIJDZONE, new Date());
  const planId = `${datum}_${stadId}`;

  // De plaatsen van de stad, met je eigen waarden eroverheen (zoals een ander
  // rustig moment), en wat je eerder voor deze dag koos.
  const plaatsen = usePlaatsen(stadId) ?? GEEN_PLAATSEN;
  useEffect(() => {
    if (!stadId) return;
    let levend = true;
    void leesEen('dagplannen', planId).then((bewaard) => {
      if (!levend) return;
      setGekozen(new Set(bewaard?.plaatsIds ?? []));
      setStart(bewaard?.start ?? STANDAARD_START);
      setEind(bewaard?.eind ?? STANDAARD_EIND);
      setRegenUit(bewaard?.regenUit ?? false);
    });
    return () => {
      levend = false;
    };
  }, [stadId, planId]);

  /** Bewaart je keuze voor deze dag, direct bij elke wijziging. */
  const bewaar = (wijziging: {
    gekozen?: Set<string>;
    start?: string;
    eind?: string;
    regenUit?: boolean;
  }) =>
    void bewaarIn('dagplannen', {
      id: planId,
      datum,
      stadId,
      plaatsIds: [...(wijziging.gekozen ?? gekozen)],
      start: wijziging.start ?? start,
      eind: wijziging.eind ?? eind,
      regenUit: wijziging.regenUit ?? regenUit,
      gewijzigdOp: new Date().toISOString(),
    });

  // Vanuit het hoofdmenu of Mijn gegevens kom je hier voor de reserveringen.
  useEffect(() => {
    if (naarSectie === 'reserveringen') {
      document.getElementById('reserveringen')?.scrollIntoView({ block: 'start' });
    }
  }, [naarSectie]);

  const dagweer = weerVan(weer, stadId, datum);
  const regendag = isRegendag(dagweer);
  const regenActief = regendag && !regenUit;

  const kiesbaar = useMemo(
    () => plaatsen.filter((p) => p.categorie === 'attractie' || p.categorie === 'eten'),
    [plaatsen],
  );
  const bijRegen = useMemo(
    () => (stad ? splitsBijRegen(kiesbaar, stad) : { binnen: kiesbaar, buiten: [] }),
    [kiesbaar, stad],
  );
  const zichtbaar = regenActief ? bijRegen.binnen : kiesbaar;
  const overgeslagen = regenActief ? bijRegen.buiten.filter((p) => gekozen.has(p.id)) : [];

  const plan = useMemo(() => {
    if (!stad) return null;
    const startMinuten = alsMinuten(start);
    const eindMinuten = alsMinuten(eind);
    if (startMinuten === null || eindMinuten === null) return null;
    const selectie = zichtbaar.filter((p) => gekozen.has(p.id));
    if (selectie.length === 0) return null;
    return maakDagplan({ plaatsen: selectie, stad, datum, startMinuten, eindMinuten });
  }, [stad, zichtbaar, gekozen, datum, start, eind]);

  const wisselen = (id: string) => {
    const nieuw = new Set(gekozen);
    if (nieuw.has(id)) nieuw.delete(id);
    else nieuw.add(id);
    setGekozen(nieuw);
    bewaar({ gekozen: nieuw });
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Dagplanner</h1>
      <p className="mt-2 mb-5 leading-relaxed text-inkt-zacht dark:text-papier/70">
        Vink punten aan; de app zet er een looproute van met tijden, en haalt eruit wat die dag
        gesloten is.
      </p>

      <Kaartje className="mb-5 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Stad</span>
            <select
              value={stadId}
              onChange={(e) => setStadId(e.target.value)}
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 dark:border-white/15 dark:bg-nacht"
            >
              {STEDEN.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.naam}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Dag</span>
            <input
              type="date"
              value={datum}
              onChange={(e) => setGekozenDatum(e.target.value || null)}
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 dark:border-white/15 dark:bg-nacht"
            />
          </label>
          <div className="flex gap-2">
            <label className="block min-w-0 flex-1">
              <span className="mb-1 block text-sm font-medium">Van</span>
              <input
                type="time"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  bewaar({ start: e.target.value });
                }}
                className="w-full rounded-lg border border-black/10 bg-white px-2 py-2 dark:border-white/15 dark:bg-nacht"
              />
            </label>
            <label className="block min-w-0 flex-1">
              <span className="mb-1 block text-sm font-medium">Tot</span>
              <input
                type="time"
                value={eind}
                onChange={(e) => {
                  setEind(e.target.value);
                  bewaar({ eind: e.target.value });
                }}
                className="w-full rounded-lg border border-black/10 bg-white px-2 py-2 dark:border-white/15 dark:bg-nacht"
              />
            </label>
          </div>
        </div>
      </Kaartje>

      {stad && (
        <div className="mb-5 grid gap-2">
          <WeerRegel stadId={stad.id} datum={datum} />
          <WindWaarschuwing dagen={[{ stadId: stad.id, datum }]} />
          {regendag && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-sky-50 p-3 text-sm leading-relaxed text-sky-950 dark:bg-sky-950/40 dark:text-sky-100">
              <CloudRain className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                {regenActief
                  ? 'Regendag verwacht. Het voorstel houdt alleen wat bij regen kan: musea, overdekte plekken en eten.'
                  : 'Regendag verwacht, maar het regenvoorstel staat uit: alles staat erin.'}
              </span>
              <Knop
                klein
                onClick={() => {
                  setRegenUit(regenActief);
                  bewaar({ regenUit: regenActief });
                }}
              >
                {regenActief ? 'Toch alles' : 'Alleen bij regen'}
              </Knop>
            </div>
          )}
        </div>
      )}

      <section className="mb-6">
        <Sectiekop
          extra={
            gekozen.size > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setGekozen(new Set());
                  bewaar({ gekozen: new Set() });
                }}
                className="text-xs text-zegel underline underline-offset-2"
              >
                selectie wissen
              </button>
            ) : null
          }
        >
          Kies je punten
        </Sectiekop>
        {plaatsen.length === 0 ? (
          <p className="text-sm text-inkt-zacht dark:text-papier/60">
            Voor deze stad staan er nog geen punten in de app.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {zichtbaar.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => wisselen(p.id)}
                aria-pressed={gekozen.has(p.id)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  gekozen.has(p.id)
                    ? 'border-zegel bg-zegel text-white'
                    : 'border-black/10 bg-white/70 dark:border-white/15 dark:bg-nacht-diep/70'
                }`}
              >
                {p.naam}
              </button>
            ))}
          </div>
        )}
        {overgeslagen.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-sm font-medium">Bij regen overgeslagen</p>
            <p className="flex flex-wrap gap-1.5">
              {overgeslagen.map((p) => (
                <Label key={p.id} toon="let-op">
                  {p.naam}
                </Label>
              ))}
            </p>
          </div>
        )}
      </section>

      {plan && (
        <section className="mb-8">
          <Sectiekop
            extra={
              <span className="text-xs text-inkt-zacht dark:text-papier/50">
                {plan.looptijdTotaal} min lopen
              </span>
            }
          >
            Je dag
          </Sectiekop>

          {plan.waarschuwingen.length > 0 && (
            <div className="mb-3 grid gap-2">
              {plan.waarschuwingen.map((w) => (
                <p
                  key={w}
                  className="rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
                >
                  {w}
                </p>
              ))}
            </div>
          )}

          <div className="grid gap-2">
            {plan.stops.map((stop) => (
              <Kaartje key={stop.plaats.id} className="p-3.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-medium tabular-nums">
                    {alsKlok(stop.aankomst)} tot {alsKlok(stop.vertrek)}
                  </span>
                  <span className="font-medium">{stop.plaats.naam}</span>
                  {stop.looptijd > 0 && <Label>{stop.looptijd} min lopen</Label>}
                </div>
                {stop.uitleg && (
                  <p className="mt-1.5 text-sm text-sky-800 dark:text-sky-200">{stop.uitleg}</p>
                )}
                {stop.waarschuwingen.map((w) => (
                  <p key={w} className="mt-1.5 text-sm text-zegel">
                    {w}
                  </p>
                ))}
                {stop === plan.stops[plan.stops.length - 1] && (
                  <LaatsteTreinMelding stadId={stadId} datum={datum} stop={stop} />
                )}
              </Kaartje>
            ))}
          </div>

          {plan.nietGepland.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-sm font-medium">Paste er niet in</p>
              <p className="flex flex-wrap gap-1.5">
                {plan.nietGepland.map((p) => (
                  <Label key={p.id} toon="let-op">
                    {p.naam}
                  </Label>
                ))}
              </p>
            </div>
          )}
        </section>
      )}

      <Reserveringen stadId={stadId} />
    </div>
  );
};
