import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Plaats } from '@/domein/schema';
import { laadPlaatsen, stadMet } from '@/data/content';
import { alsKlok, maakDagplan } from '@/domein/planning/dagplanner';
import { Kaartje, Knop, Label, Sectiekop } from '@/ui/basis';
import {
  RIT_MINUTEN,
  alsDuur,
  alsTijd,
  berekenOverstap,
  stelDagdeelVoor,
  type Richting,
} from '@/domein/planning/overstap';
import { bewaarOverstap, leesOverstappen, type OpgeslagenOverstap } from '@/data/db/idb';

/**
 * De Hanoi overstapplanner uit hoofdstuk 14.
 *
 * Twee tijden invullen en de app zegt wat er haalbaar is. Werkt maanden vooraf
 * vanaf de bank en hangt nergens van je locatie af; dat is met opzet, want dit
 * is precies de vraag die je thuis stelt terwijl je de vlucht boekt.
 *
 * Heenreis en terugreis zijn twee losse plannen met elk hun eigen punten. Op de
 * heenreis ben je fris en wil je de oude wijk in; op de terugreis ben je moe en
 * is een koffie aan het meer genoeg.
 */
export const OverstapScherm = () => {
  const [richting, setRichting] = useState<Richting>('heenreis');
  const [landing, setLanding] = useState('06:00');
  const [vertrek, setVertrek] = useState('22:00');
  const [bagage, setBagage] = useState(false);
  /**
   * De datum van de overstap. Optioneel, want vaak plan je dit voordat de
   * vlucht vaststaat. Vul je hem in, dan gaat het voorstel door de dagplanner
   * en houdt het rekening met openingstijden en sluitingsdagen; het Ho Chi Minh
   * mausoleum sluit om 10:30 en is op maandag en vrijdag dicht, en dat wil je
   * weten voordat je ervoor staat.
   */
  const [datum, setDatum] = useState('');
  const [plaatsen, setPlaatsen] = useState<Plaats[]>([]);
  const [bewaard, setBewaard] = useState<OpgeslagenOverstap[]>([]);
  const [gemeld, setGemeld] = useState(false);

  const haalOp = useCallback(() => leesOverstappen(), []);

  /**
   * Het opgeslagen plan van een richting in het formulier zetten.
   *
   * Een handeling en geen effect: wisselen van richting is iets wat jij doet, en
   * dat als afgeleide toestand modelleren maakt het alleen maar lastiger te
   * volgen wanneer het formulier overschreven wordt.
   */
  const laadPlan = useCallback((plannen: OpgeslagenOverstap[], voor: Richting) => {
    const plan = plannen.find((b) => b.id === voor);
    if (!plan) return;
    setLanding(plan.landing);
    setVertrek(plan.vertrek);
    setBagage(plan.bagageOphalen);
  }, []);

  const kiesRichting = (nieuw: Richting) => {
    setRichting(nieuw);
    laadPlan(bewaard, nieuw);
  };

  useEffect(() => {
    void laadPlaatsen('hanoi').then(setPlaatsen);
    void haalOp().then((plannen) => {
      setBewaard(plannen);
      laadPlan(plannen, 'heenreis');
    });
  }, [haalOp, laadPlan]);

  const uitkomst = useMemo(
    () => berekenOverstap({ richting, landing, vertrek, bagageOphalen: bagage }),
    [richting, landing, vertrek, bagage],
  );

  const grofVoorstel = useMemo(
    () => (uitkomst?.haalbaar ? stelDagdeelVoor(plaatsen, uitkomst.tijdInStadMinuten) : []),
    [uitkomst, plaatsen],
  );

  const hanoiStad = stadMet('hanoi');

  /**
   * Met een datum erbij het grove voorstel door de dagplanner halen. Die kent de
   * openingstijden en de sluitingsdagen, en haalt eruit wat die dag niet kan.
   */
  const plan = useMemo(() => {
    if (!datum || !hanoiStad || !uitkomst?.haalbaar || grofVoorstel.length === 0) return null;
    return maakDagplan({
      plaatsen: grofVoorstel.map((v) => v.plaats),
      stad: hanoiStad,
      datum,
      startMinuten: uitkomst.inStadVanaf % 1440,
      eindMinuten: uitkomst.uitStadVoor % 1440,
    });
  }, [datum, hanoiStad, uitkomst, grofVoorstel]);

  const bewaarPlan = async () => {
    await bewaarOverstap({
      id: richting,
      landing,
      vertrek,
      bagageOphalen: bagage,
      plaatsIds: (plan ? plan.stops.map((s) => s.plaats) : grofVoorstel.map((v) => v.plaats)).map(
        (p) => p.id,
      ),
      bewaardOp: new Date().toISOString(),
    });
    setBewaard(await haalOp());
    setGemeld(true);
    window.setTimeout(() => setGemeld(false), 2500);
  };

  const hanoi = stadMet('hanoi');

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
      <Link to="/" className="text-sm text-zegel underline underline-offset-2">
        Alle steden
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Overstap in Hanoi</h1>
      <p className="mt-2 mb-5 leading-relaxed text-inkt-zacht dark:text-papier/70">
        Vul je landings- en vertrektijd in. De app rekent met {RIT_MINUTEN} minuten tussen Noi Bai
        en het centrum, elke kant op, en zegt wat er overblijft.
      </p>

      <div className="mb-4 flex gap-1.5">
        {(['heenreis', 'terugreis'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => kiesRichting(r)}
            aria-pressed={richting === r}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${
              richting === r
                ? 'border-zegel bg-zegel text-white'
                : 'border-black/10 bg-white/70 dark:border-white/15 dark:bg-nacht-diep/70'
            }`}
          >
            {r}
            {bewaard.some((b) => b.id === r) && <span className="ml-1 opacity-70">bewaard</span>}
          </button>
        ))}
      </div>

      <Kaartje className="mb-5 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Landing in Hanoi</span>
            <input
              type="time"
              value={landing}
              onChange={(e) => setLanding(e.target.value)}
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 dark:border-white/15 dark:bg-nacht"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Vertrek volgende vlucht</span>
            <input
              type="time"
              value={vertrek}
              onChange={(e) => setVertrek(e.target.value)}
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 dark:border-white/15 dark:bg-nacht"
            />
          </label>
        </div>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium">
            Datum{' '}
            <span className="font-normal text-inkt-zacht dark:text-papier/55">(optioneel)</span>
          </span>
          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 dark:border-white/15 dark:bg-nacht"
          />
          <span className="mt-1 block text-xs text-inkt-zacht dark:text-papier/55">
            Vul je hem in, dan houdt het voorstel rekening met openingstijden en sluitingsdagen.
          </span>
        </label>

        <label className="mt-3 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={bagage}
            onChange={(e) => setBagage(e.target.checked)}
            className="mt-1"
          />
          <span>
            Ik moet mijn bagage ophalen en opnieuw inchecken
            <span className="block text-xs text-inkt-zacht dark:text-papier/55">
              Dit bepaalt of de stadstrip überhaupt kan. Vraag het na bij je maatschappij.
            </span>
          </span>
        </label>
      </Kaartje>

      {!uitkomst ? (
        <p className="text-sm text-inkt-zacht dark:text-papier/60">Vul twee geldige tijden in.</p>
      ) : (
        <>
          <Kaartje className={`mb-4 p-4 ${uitkomst.haalbaar ? '' : 'ring-1 ring-amber-500/40'}`}>
            <p className="text-sm text-inkt-zacht dark:text-papier/70">
              Overstap van {alsDuur(uitkomst.overstapMinuten)}
            </p>
            {uitkomst.haalbaar ? (
              <>
                <p className="mt-0.5 text-2xl font-semibold">
                  {alsDuur(uitkomst.tijdInStadMinuten)} in de stad
                </p>
                <p className="mt-1.5 text-sm text-inkt-zacht dark:text-papier/65">
                  In het centrum vanaf <strong>{alsTijd(uitkomst.inStadVanaf)}</strong>, weer weg om{' '}
                  <strong>{alsTijd(uitkomst.uitStadVoor)}</strong>.
                </p>
              </>
            ) : (
              <p className="mt-0.5 text-xl font-semibold">Deze overstap is te kort voor de stad</p>
            )}
          </Kaartje>

          {uitkomst.waarschuwingen.length > 0 && (
            <div className="mb-5 grid gap-2">
              {uitkomst.waarschuwingen.map((waarschuwing) => (
                <p
                  key={waarschuwing}
                  className="rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
                >
                  {waarschuwing}
                </p>
              ))}
            </div>
          )}

          {uitkomst.haalbaar && (
            <section className="mb-5">
              <Sectiekop
                extra={
                  <span className="text-xs text-inkt-zacht dark:text-papier/50">
                    {plan ? plan.stops.length : grofVoorstel.length} punten
                  </span>
                }
              >
                Wat past er in
              </Sectiekop>
              {grofVoorstel.length === 0 ? (
                <p className="text-sm text-inkt-zacht dark:text-papier/60">
                  Er staan nog geen punten voor Hanoi in de app, of ze passen geen van alle in deze
                  tijd.
                </p>
              ) : plan ? (
                <>
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
                      <Kaartje key={stop.plaats.id} className="p-3">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="font-medium tabular-nums">
                            {alsKlok(stop.aankomst)} tot {alsKlok(stop.vertrek)}
                          </span>
                          <span className="font-medium">{stop.plaats.naam}</span>
                          {stop.looptijd > 0 && <Label>{stop.looptijd} min lopen</Label>}
                        </div>
                        {stop.waarschuwingen.map((w) => (
                          <p key={w} className="mt-1.5 text-sm text-zegel">
                            {w}
                          </p>
                        ))}
                      </Kaartje>
                    ))}
                  </div>
                  {plan.nietGepland.length > 0 && (
                    <p className="mt-3 flex flex-wrap items-baseline gap-1.5 text-sm">
                      <span className="text-inkt-zacht dark:text-papier/65">Paste er niet in:</span>
                      {plan.nietGepland.map((p) => (
                        <Label key={p.id} toon="let-op">
                          {p.naam}
                        </Label>
                      ))}
                    </p>
                  )}
                </>
              ) : (
                <div className="grid gap-2">
                  {grofVoorstel.map((v, i) => (
                    <Kaartje key={v.plaats.id} className="p-3">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-sm text-inkt-zacht tabular-nums dark:text-papier/50">
                          {i + 1}.
                        </span>
                        <span className="font-medium">{v.plaats.naam}</span>
                        <Label>{alsDuur(v.minuten)}</Label>
                        {v.plaats.categorie === 'eten' && <Label>eten</Label>}
                      </div>
                      {v.plaats.beschrijving && (
                        <p className="mt-1 text-sm leading-relaxed text-inkt-zacht dark:text-papier/65">
                          {v.plaats.beschrijving}
                        </p>
                      )}
                    </Kaartje>
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs leading-relaxed text-inkt-zacht dark:text-papier/50">
                {plan
                  ? 'Met de datum erbij zijn de openingstijden en sluitingsdagen meegerekend.'
                  : 'Zonder datum zijn openingstijden en sluitingsdagen niet meegerekend. Vul er een in en het voorstel wordt een dagplan met tijden.'}{' '}
                Alle punten liggen binnen een halfuur lopen van het Hoan Kiem-meer, dus er wordt met
                een vaste vijftien minuten tussen de stops gerekend.
              </p>
            </section>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Knop soort="nadruk" onClick={() => void bewaarPlan()}>
              Bewaar dit plan voor de {richting}
            </Knop>
            {gemeld && (
              <span className="text-sm text-emerald-700 dark:text-emerald-300">Bewaard.</span>
            )}
          </div>

          {hanoi && (
            <p className="mt-4 text-sm">
              <Link to="/stad/hanoi" className="text-zegel underline underline-offset-2">
                Alles over Hanoi
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  );
};
