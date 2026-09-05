import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Plaats } from '@/domein/schema';
import { STEDEN, laadPlaatsen, stadMet } from '@/data/content';
import { Kaartje, Knop, Label, Sectiekop } from '@/ui/basis';
import { alsKlok, maakDagplan } from '@/domein/planning/dagplanner';
import { alsMinuten } from '@/domein/planning/overstap';
import {
  bewaarReservering,
  leesReserveringen,
  verwijderReservering,
  type Reservering,
} from '@/data/db/idb';

/**
 * De dagplanner en de reserveringsagenda uit hoofdstuk 12.
 *
 * Je vinkt punten aan, kiest een dag en een begintijd, en de app zet er een
 * route van met tijden erbij. Wat die dag gesloten is gaat eruit met de reden
 * erbij, en wat niet meer past komt apart te staan in plaats van stilletjes te
 * verdwijnen.
 */

const NIEUWE_ID = () =>
  globalThis.crypto?.randomUUID?.() ?? `res-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const VANDAAG = () => new Date().toISOString().slice(0, 10);

export const DagplannerScherm = () => {
  const [stadId, setStadId] = useState(STEDEN[0]?.id ?? '');
  const [plaatsen, setPlaatsen] = useState<Plaats[]>([]);
  const [gekozen, setGekozen] = useState<Set<string>>(new Set());
  const [datum, setDatum] = useState(VANDAAG());
  const [start, setStart] = useState('09:00');
  const [eind, setEind] = useState('18:00');

  const [reserveringen, setReserveringen] = useState<Reservering[]>([]);
  const [wat, setWat] = useState('');
  const [resDatum, setResDatum] = useState('');
  const [verkoopVanaf, setVerkoopVanaf] = useState('');

  const stad = stadMet(stadId);
  const haalRes = useCallback(() => leesReserveringen(), []);

  useEffect(() => {
    if (!stadId) return;
    let levend = true;
    void laadPlaatsen(stadId).then((p) => {
      if (levend) {
        setPlaatsen(p);
        setGekozen(new Set());
      }
    });
    return () => {
      levend = false;
    };
  }, [stadId]);

  useEffect(() => {
    void haalRes().then(setReserveringen);
  }, [haalRes]);

  const plan = useMemo(() => {
    if (!stad) return null;
    const startMinuten = alsMinuten(start);
    const eindMinuten = alsMinuten(eind);
    if (startMinuten === null || eindMinuten === null) return null;
    const selectie = plaatsen.filter((p) => gekozen.has(p.id));
    if (selectie.length === 0) return null;
    return maakDagplan({ plaatsen: selectie, stad, datum, startMinuten, eindMinuten });
  }, [stad, plaatsen, gekozen, datum, start, eind]);

  const wisselen = (id: string) =>
    setGekozen((oud) => {
      const nieuw = new Set(oud);
      if (nieuw.has(id)) nieuw.delete(id);
      else nieuw.add(id);
      return nieuw;
    });

  const voegReserveringToe = async () => {
    if (!wat.trim()) return;
    await bewaarReservering({
      id: NIEUWE_ID(),
      wat: wat.trim(),
      datum: resDatum || undefined,
      verkoopVanaf: verkoopVanaf || undefined,
      stadId: stadId || undefined,
      status: 'te-regelen',
    });
    setWat('');
    setResDatum('');
    setVerkoopVanaf('');
    setReserveringen(await haalRes());
  };

  const wisselStatus = async (reservering: Reservering) => {
    await bewaarReservering({
      ...reservering,
      status: reservering.status === 'geboekt' ? 'te-regelen' : 'geboekt',
    });
    setReserveringen(await haalRes());
  };

  const teRegelen = reserveringen
    .filter((r) => r.status === 'te-regelen')
    .sort((a, b) =>
      (a.verkoopVanaf ?? a.datum ?? '9').localeCompare(b.verkoopVanaf ?? b.datum ?? '9'),
    );
  const geboekt = reserveringen.filter((r) => r.status === 'geboekt');

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
      <Link to="/" className="text-sm text-zegel underline underline-offset-2">
        Alle steden
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Dagplanner</h1>
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
              onChange={(e) => setDatum(e.target.value)}
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 dark:border-white/15 dark:bg-nacht"
            />
          </label>
          <div className="flex gap-2">
            <label className="block min-w-0 flex-1">
              <span className="mb-1 block text-sm font-medium">Van</span>
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-lg border border-black/10 bg-white px-2 py-2 dark:border-white/15 dark:bg-nacht"
              />
            </label>
            <label className="block min-w-0 flex-1">
              <span className="mb-1 block text-sm font-medium">Tot</span>
              <input
                type="time"
                value={eind}
                onChange={(e) => setEind(e.target.value)}
                className="w-full rounded-lg border border-black/10 bg-white px-2 py-2 dark:border-white/15 dark:bg-nacht"
              />
            </label>
          </div>
        </div>
      </Kaartje>

      <section className="mb-6">
        <Sectiekop
          extra={
            gekozen.size > 0 ? (
              <button
                type="button"
                onClick={() => setGekozen(new Set())}
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
            {plaatsen
              .filter((p) => p.categorie === 'attractie' || p.categorie === 'eten')
              .map((p) => (
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
                {stop.waarschuwingen.map((w) => (
                  <p key={w} className="mt-1.5 text-sm text-zegel">
                    {w}
                  </p>
                ))}
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

      <section>
        <Sectiekop>Reserveringen</Sectiekop>
        <p className="mb-3 text-sm leading-relaxed text-inkt-zacht dark:text-papier/65">
          Eén plek voor restaurants, ryokan, het Ghibli Museum en teamLab. Vul in wanneer de
          kaartverkoop opengaat: het Ghibli Museum verkoopt op de tiende van de maand ervoor en is
          binnen minuten weg.
        </p>

        <Kaartje className="mb-4 p-4">
          <div className="grid gap-3">
            <input
              value={wat}
              onChange={(e) => setWat(e.target.value)}
              placeholder="Wat, bijvoorbeeld Ghibli Museum"
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 dark:border-white/15 dark:bg-nacht"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-inkt-zacht dark:text-papier/55">
                  Datum van het bezoek
                </span>
                <input
                  type="date"
                  value={resDatum}
                  onChange={(e) => setResDatum(e.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 dark:border-white/15 dark:bg-nacht"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-inkt-zacht dark:text-papier/55">
                  Kaartverkoop opent
                </span>
                <input
                  type="date"
                  value={verkoopVanaf}
                  onChange={(e) => setVerkoopVanaf(e.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 dark:border-white/15 dark:bg-nacht"
                />
              </label>
            </div>
            <div>
              <Knop soort="nadruk" disabled={!wat.trim()} onClick={() => void voegReserveringToe()}>
                Toevoegen
              </Knop>
            </div>
          </div>
        </Kaartje>

        {teRegelen.length > 0 && (
          <div className="mb-4">
            <p className="mb-1.5 text-sm font-medium">Nog te regelen</p>
            <div className="grid gap-2">
              {teRegelen.map((r) => (
                <ReserveringRegel
                  key={r.id}
                  reservering={r}
                  onWissel={() => void wisselStatus(r)}
                  onWeg={() => void verwijderReservering(r.id).then(haalRes).then(setReserveringen)}
                />
              ))}
            </div>
          </div>
        )}

        {geboekt.length > 0 && (
          <div>
            <p className="mb-1.5 text-sm font-medium">Geboekt</p>
            <div className="grid gap-2">
              {geboekt.map((r) => (
                <ReserveringRegel
                  key={r.id}
                  reservering={r}
                  onWissel={() => void wisselStatus(r)}
                  onWeg={() => void verwijderReservering(r.id).then(haalRes).then(setReserveringen)}
                />
              ))}
            </div>
          </div>
        )}

        {reserveringen.length === 0 && (
          <p className="text-sm text-inkt-zacht dark:text-papier/60">Nog niets in de agenda.</p>
        )}
      </section>
    </div>
  );
};

const ReserveringRegel = ({
  reservering,
  onWissel,
  onWeg,
}: {
  reservering: Reservering;
  onWissel: () => void;
  onWeg: () => void;
}) => {
  const vandaag = VANDAAG();
  const verkoopOpen = reservering.verkoopVanaf !== undefined && reservering.verkoopVanaf <= vandaag;

  return (
    <Kaartje className="p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-medium">{reservering.wat}</span>
            {reservering.datum && <Label>{reservering.datum}</Label>}
            {reservering.status === 'geboekt' && <Label toon="gratis">geboekt</Label>}
            {reservering.verkoopVanaf && reservering.status === 'te-regelen' && (
              <Label toon={verkoopOpen ? 'let-op' : 'gewoon'}>
                {verkoopOpen
                  ? `verkoop staat open sinds ${reservering.verkoopVanaf}`
                  : `verkoop opent ${reservering.verkoopVanaf}`}
              </Label>
            )}
          </div>
          {reservering.stadId && (
            <p className="mt-1 text-xs text-inkt-zacht dark:text-papier/50">
              {stadMet(reservering.stadId)?.naam ?? reservering.stadId}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Knop
            klein
            soort={reservering.status === 'geboekt' ? 'gewoon' : 'nadruk'}
            onClick={onWissel}
          >
            {reservering.status === 'geboekt' ? 'Terugzetten' : 'Geboekt'}
          </Knop>
          <button
            type="button"
            onClick={onWeg}
            className="text-xs text-zegel underline underline-offset-2"
          >
            weg
          </button>
        </div>
      </div>
    </Kaartje>
  );
};
