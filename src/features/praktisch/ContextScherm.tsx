import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Zin } from '@/domein/schema';
import { ETIQUETTE, SEIZOEN, STEDEN, ZINNEN } from '@/data/content';
import { Kaartje, Label, Sectiekop } from '@/ui/basis';
import {
  alsDatumtekst,
  bloeiStand,
  geldendeWaarschuwingen,
  type BloeiStand,
} from '@/domein/seizoen/kalender';

/**
 * Etiquette, zinnen, seizoen en de Hanoi visumcheck, uit hoofdstuk 13.
 *
 * Dit is het scherm dat je opent terwijl je ergens staat: voor een badhuis, aan
 * een tafel, in een trein. Daarom kort, met per situatie alleen wat je werkelijk
 * anders doet dan thuis, en met het schrift groot genoeg om te tonen aan iemand
 * die geen Engels spreekt. Dat laatste is het hele punt van de zinnenlijst:
 * wijzen werkt, uitspreken vaak niet.
 */

const CATEGORIE_NAAM: Record<Zin['categorie'], string> = {
  basis: 'Basis',
  eten: 'Eten en drinken',
  allergie: 'Allergieën',
  onderweg: 'Onderweg',
  nood: 'Nood',
};

const CATEGORIE_VOLGORDE: Zin['categorie'][] = ['basis', 'eten', 'allergie', 'onderweg', 'nood'];

const BLOEI_TEKST: Record<BloeiStand, string> = {
  nu: 'nu, ongeveer',
  binnenkort: 'binnenkort',
  voorbij: 'dit jaar geweest',
  'ruim-voor': 'later dit jaar',
};

export const ContextScherm = () => {
  const [land, setLand] = useState<'japan' | 'vietnam'>('japan');
  const nu = useMemo(() => new Date(), []);

  const zinnen = useMemo(() => ZINNEN.filter((z) => z.land === land), [land]);
  const etiquette = useMemo(() => ETIQUETTE.filter((e) => e.land.includes(land)), [land]);
  const waarschuwingen = useMemo(
    () => geldendeWaarschuwingen(SEIZOEN.waarschuwingen, land, nu),
    [land, nu],
  );
  const regios = useMemo(
    () =>
      SEIZOEN.regios.filter((r) =>
        r.steden.some((id) => STEDEN.find((s) => s.id === id)?.land === land),
      ),
    [land],
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
      <Link to="/" className="text-sm text-zegel underline underline-offset-2">
        Alle steden
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Etiquette, taal en seizoen</h1>

      <div className="mt-4 mb-5 flex gap-1.5">
        {(
          [
            ['japan', 'Japan'],
            ['vietnam', 'Vietnam'],
          ] as const
        ).map(([id, naam]) => (
          <button
            key={id}
            type="button"
            onClick={() => setLand(id)}
            aria-pressed={land === id}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${
              land === id
                ? 'border-zegel bg-zegel text-white'
                : 'border-black/10 bg-white/70 dark:border-white/15 dark:bg-nacht-diep/70'
            }`}
          >
            {naam}
          </button>
        ))}
      </div>

      {waarschuwingen.length > 0 && (
        <section className="mb-6">
          <Sectiekop>Wat er nu speelt</Sectiekop>
          <div className="grid gap-2">
            {waarschuwingen.map((w) => (
              <Kaartje key={w.id} className="p-3.5">
                <p className="font-medium">{w.naam}</p>
                <p className="mt-1 text-sm leading-relaxed text-inkt-zacht dark:text-papier/70">
                  {w.wat}
                </p>
                <p className="mt-1.5 text-xs text-inkt-zacht dark:text-papier/50">
                  Loopt van {alsDatumtekst(w.vanaf)} tot {alsDatumtekst(w.tot)}.
                </p>
              </Kaartje>
            ))}
          </div>
        </section>
      )}

      <section className="mb-6">
        <Sectiekop>Zinnen om te tonen</Sectiekop>
        <p className="mb-3 text-sm leading-relaxed text-inkt-zacht dark:text-papier/65">
          Het schrift staat er groot bij, zodat je het kunt laten zien. Wijzen werkt beter dan
          uitspreken. De uitspraak is in Nederlandse spelling en niet in officiële romaji.
        </p>
        {CATEGORIE_VOLGORDE.map((categorie) => {
          const inCategorie = zinnen.filter((z) => z.categorie === categorie);
          if (inCategorie.length === 0) return null;
          return (
            <div key={categorie} className="mb-4">
              <p className="mb-1.5 text-sm font-medium">{CATEGORIE_NAAM[categorie]}</p>
              <div className="grid gap-2">
                {inCategorie.map((zin) => (
                  <Kaartje key={zin.id} className="p-3.5">
                    <p className="text-sm text-inkt-zacht dark:text-papier/65">{zin.nederlands}</p>
                    <p className="mt-1 text-xl leading-snug font-medium">{zin.lokaal}</p>
                    <p className="mt-1 text-sm text-inkt-zacht dark:text-papier/55">
                      {zin.uitspraak}
                    </p>
                    {zin.wanneer && (
                      <p className="mt-2 text-sm leading-relaxed text-zegel">{zin.wanneer}</p>
                    )}
                  </Kaartje>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="mb-6">
        <Sectiekop>Etiquette</Sectiekop>
        <div className="grid gap-2">
          {etiquette.map((kaart) => (
            <Kaartje key={kaart.id} className="p-4">
              <p className="font-medium">{kaart.situatie}</p>
              <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-sm leading-relaxed">
                {kaart.regels.map((regel) => (
                  <li key={regel}>{regel}</li>
                ))}
              </ul>
              {kaart.letOp && (
                <p className="mt-2.5 rounded-lg bg-amber-50 p-2.5 text-sm leading-relaxed text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
                  {kaart.letOp}
                </p>
              )}
            </Kaartje>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <Sectiekop>Seizoen per regio</Sectiekop>
        <div className="grid gap-2">
          {regios.map((regio) => (
            <Kaartje key={regio.id} className="p-4">
              <p className="font-medium">{regio.naam}</p>
              <div className="mt-2 grid gap-1.5 text-sm">
                {regio.kersenbloesem && (
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span>Kersenbloesem</span>
                    <Label
                      toon={bloeiStand(regio.kersenbloesem, nu) === 'nu' ? 'gratis' : 'gewoon'}
                    >
                      {BLOEI_TEKST[bloeiStand(regio.kersenbloesem, nu)]}
                    </Label>
                    <span className="text-inkt-zacht dark:text-papier/60">
                      vanaf {alsDatumtekst(regio.kersenbloesem.begintTypisch)}, hoogtepunt rond{' '}
                      {alsDatumtekst(regio.kersenbloesem.hoogtepuntTypisch)}
                    </span>
                  </p>
                )}
                {regio.herfstblad && (
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span>Herfstblad</span>
                    <Label toon={bloeiStand(regio.herfstblad, nu) === 'nu' ? 'gratis' : 'gewoon'}>
                      {BLOEI_TEKST[bloeiStand(regio.herfstblad, nu)]}
                    </Label>
                    <span className="text-inkt-zacht dark:text-papier/60">
                      vanaf {alsDatumtekst(regio.herfstblad.begintTypisch)}, hoogtepunt rond{' '}
                      {alsDatumtekst(regio.herfstblad.hoogtepuntTypisch)}
                    </span>
                  </p>
                )}
              </div>
              {regio.opmerking && (
                <p className="mt-2 text-sm leading-relaxed text-inkt-zacht dark:text-papier/70">
                  {regio.opmerking}
                </p>
              )}
            </Kaartje>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-inkt-zacht dark:text-papier/50">
          Dit zijn langjarige gemiddelden en geen voorspelling. De bloei schuift elk jaar met de
          winter mee, soms tien dagen. De officiële voorspelling verschijnt in januari en wordt tot
          in maart bijgesteld; die haalt deze app niet op, want offline werken gaat voor.
        </p>
      </section>

      {land === 'vietnam' && (
        <section>
          <Sectiekop>Hanoi: voor je gaat</Sectiekop>
          <Kaartje className="p-4 text-sm leading-relaxed">
            <p>
              <strong className="font-medium">Visum.</strong> Nederlanders zijn voor een kort
              verblijf doorgaans vrijgesteld, maar die vrijstelling wordt periodiek verlengd of
              gewijzigd en geldt niet altijd voor elke reisvorm. Blijf je langer of val je er
              buiten, dan is er het e-visum. Controleer dit bij de Vietnamese ambassade of via
              nederlandwereldwijd.nl, en doe dat opnieuw vlak voor vertrek: dit is precies het soort
              regel dat tussen boeken en vliegen verandert.
            </p>
            <p className="mt-2">
              <strong className="font-medium">Blijf je in transit?</strong> Wie de luchthaven niet
              verlaat heeft meestal geen visum nodig. Zodra je de stad in gaat, wel. Dat is de vraag
              die je moet stellen voordat je een overstap inplant.
            </p>
            <p className="mt-2">
              <strong className="font-medium">Bagage.</strong> Of je koffers zijn doorgechecked
              bepaalt of de stadstrip überhaupt kan. Vraag het na bij je maatschappij; met je bagage
              aan de hand ga je de stad niet in. Bij Noi Bai zijn lockers, maar reken erop dat je
              opnieuw door de incheck moet.
            </p>
            <p className="mt-3">
              <Link to="/overstap" className="text-zegel underline underline-offset-2">
                Naar de overstapplanner
              </Link>
            </p>
          </Kaartje>
        </section>
      )}
    </div>
  );
};
