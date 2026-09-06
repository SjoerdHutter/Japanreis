import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TIPS, STEDEN } from '@/data/content';
import { stukkenVan } from '@/domein/tips/tekst';
import type { Tip } from '@/domein/schema';
import { useApp } from '@/state/useApp';
import { Kaartje, Label, Sectiekop } from '@/ui/basis';

/**
 * De reisadviezen uit de opgeslagen Instagram collectie.
 *
 * Twee dingen die dit scherm anders doen dan een lijstje tips.
 *
 * De bedragen lopen door de centrale valutahelper en staan niet uitgeschreven in
 * de tekst. Daardoor beweegt de euro tussen haakjes mee met de koers en is er
 * geen tweede waarheid in de app.
 *
 * En waar twee posts elkaar tegenspreken staat dat er gewoon bij, met de uitleg
 * erbij waarom. Doen alsof er consensus is die er niet is, is erger dan de
 * tegenspraak laten staan: dan neem je een beslissing voor de lezer zonder dat
 * die weet dat er iets te beslissen viel.
 */

export const TipsScherm = () => {
  const { koersen } = useApp();
  const [stad, setStad] = useState<string>('alles');

  const groepen = useMemo(() => {
    if (stad === 'alles') return TIPS.groepen;
    return TIPS.groepen
      .map((g) => ({ ...g, tips: g.tips.filter((t) => t.stad === stad) }))
      .filter((g) => g.tips.length > 0);
  }, [stad]);

  // Alleen steden aanbieden waar ook echt een tip aan hangt; een filter dat
  // gegarandeerd niets oplevert is erger dan geen filter.
  const stedenMetTips = useMemo(() => {
    const ids = new Set(TIPS.groepen.flatMap((g) => g.tips.map((t) => t.stad)));
    return STEDEN.filter((s) => ids.has(s.id));
  }, []);

  const totaal = TIPS.groepen.reduce((n, g) => n + g.tips.length, 0);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
      <Link to="/" className="text-sm text-zegel underline underline-offset-2">
        Alle steden
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Tips uit je collectie</h1>
      <p className="mt-2 mb-4 leading-relaxed text-inkt-zacht dark:text-papier/70">
        {totaal} adviezen uit {TIPS.herkomst.toLowerCase()}, geordend per thema. Bedragen staan in
        de lokale valuta met het euro equivalent erachter, omgerekend tegen de koers die de app nu
        heeft.
      </p>

      <div className="mb-5 flex flex-wrap gap-1.5">
        <Chip aan={stad === 'alles'} onClick={() => setStad('alles')}>
          alles
        </Chip>
        {stedenMetTips.map((s) => (
          <Chip key={s.id} aan={stad === s.id} onClick={() => setStad(s.id)}>
            {s.naam}
          </Chip>
        ))}
      </div>

      {groepen.length === 0 && (
        <p className="text-inkt-zacht dark:text-papier/70">Geen tips voor deze stad.</p>
      )}

      {groepen.map((groep) => (
        <section key={groep.id} className="mb-6">
          <Sectiekop>{groep.titel}</Sectiekop>
          {groep.inleiding && (
            <p className="mb-2 text-sm leading-relaxed text-inkt-zacht dark:text-papier/70">
              {groep.inleiding}
            </p>
          )}
          <div className="grid gap-2">
            {groep.tips.map((tip, i) => (
              <TipKaartje key={`${groep.id}-${i}`} tip={tip} koersen={koersen} />
            ))}
          </div>
        </section>
      ))}

      <p className="mt-6 text-xs leading-relaxed text-inkt-zacht dark:text-papier/50">
        Deze adviezen komen uit posts van anderen en zijn niet nagelopen. Prijzen, adressen en
        openingstijden verouderen; controleer wat belangrijk voor je is. Bij het merendeel van de
        reels staat de informatie in beeld of wordt die gesproken en niet in het bijschrift, dus wat
        hier staat is wat eruit te halen was.
      </p>
    </div>
  );
};

const TipKaartje = ({
  tip,
  koersen,
}: {
  tip: Tip;
  koersen: ReturnType<typeof useApp>['koersen'];
}) => {
  const stukken = stukkenVan(tip, koersen);
  const stad = tip.stad ? STEDEN.find((s) => s.id === tip.stad) : undefined;

  return (
    <Kaartje className="p-3.5">
      <p className="text-sm leading-relaxed">
        {stukken.map((stuk, i) =>
          stuk.soort === 'bedrag' ? (
            <span key={i} className="font-medium whitespace-nowrap">
              {stuk.inhoud}
            </span>
          ) : (
            <span key={i}>{stuk.inhoud}</span>
          ),
        )}
      </p>

      {tip.tegenspraak && (
        <p className="mt-2 border-l-2 border-zegel pl-3 text-sm leading-relaxed text-zegel">
          {tip.tegenspraak}
        </p>
      )}

      {(stad || tip.bron) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {stad && (
            <Link to={`/stad/${stad.id}`}>
              <Label>{stad.naam}</Label>
            </Link>
          )}
          {tip.bron && <Label>{tip.bron}</Label>}
        </div>
      )}
    </Kaartje>
  );
};

const Chip = ({
  aan,
  onClick,
  children,
}: {
  aan: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={aan}
    className={`rounded-full border px-3 py-1.5 text-sm transition ${
      aan
        ? 'border-zegel bg-zegel text-white'
        : 'border-black/10 bg-white/70 dark:border-white/15 dark:bg-nacht-diep/70'
    }`}
  >
    {children}
  </button>
);
