import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Plaats, Stad, Tijdvak } from '@/domein/schema';
import { STEDEN, TIJDLIJNEN, laadPlaatsen } from '@/data/content';
import { Kaartje, Label, Sectiekop } from '@/ui/basis';

/**
 * De tijdlijn van een land: Japan van Nara tot naoorlogs, Hanoi van Thang Long
 * tot nu.
 *
 * Het punt van dit scherm is niet de jaartallen maar de terugweg. Bij elk
 * tijdvak staat welke punten uit de app eruit stammen, per stad gegroepeerd, en
 * elk daarvan is één tik weg. Samen met de knop op een plaats levert dat de
 * twee tikken op die hoofdstuk 4 in beide richtingen vraagt.
 */
export const TijdlijnScherm = () => {
  const { tijdlijnId = '' } = useParams();
  const tijdlijn = TIJDLIJNEN.find((t) => t.id === tijdlijnId);
  const [plaatsen, setPlaatsen] = useState<Plaats[] | null>(null);

  const steden = STEDEN.filter((s) => s.tijdlijn === tijdlijnId);

  useEffect(() => {
    let levend = true;
    void Promise.all(steden.map((s) => laadPlaatsen(s.id))).then((per) => {
      if (levend) setPlaatsen(per.flat());
    });
    return () => {
      levend = false;
    };
    // De stedenlijst is afgeleid van de content en verandert alleen met de
    // tijdlijn mee; die als afhankelijkheid nemen zou elke render opnieuw laden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tijdlijnId]);

  // Bij binnenkomst via een link met een anker naar het tijdvak springen. Dat
  // gebeurt pas als de punten geladen zijn, anders staat het blok nog niet op
  // zijn uiteindelijke plek en scrol je naar het verkeerde stuk.
  useEffect(() => {
    if (plaatsen === null) return;
    const anker = window.location.hash.replace('#', '');
    if (!anker) return;
    document.getElementById(anker)?.scrollIntoView({ block: 'start' });
  }, [plaatsen]);

  if (!tijdlijn) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="mb-4">Deze tijdlijn staat niet in de app.</p>
        <Link to="/" className="text-zegel underline">
          Terug naar het overzicht
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
      <Link to="/" className="text-sm text-zegel underline underline-offset-2">
        Alle steden
      </Link>

      <header className="mt-3 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Tijdlijn {tijdlijn.naam}</h1>
        <p className="mt-2 leading-relaxed text-inkt-zacht dark:text-papier/70">
          Van elk tijdvak staat eronder wat je er in deze reis van terugziet.
        </p>
      </header>

      <div className="grid gap-3">
        {tijdlijn.tijdvakken.map((tijdvak) => (
          <TijdvakBlok
            key={tijdvak.id}
            tijdvak={tijdvak}
            steden={steden}
            plaatsen={plaatsen ?? []}
            ladend={plaatsen === null}
          />
        ))}
      </div>
    </div>
  );
};

const TijdvakBlok = ({
  tijdvak,
  steden,
  plaatsen,
  ladend,
}: {
  tijdvak: Tijdvak;
  steden: Stad[];
  plaatsen: Plaats[];
  ladend: boolean;
}) => {
  const uitDitTijdvak = plaatsen.filter((p) => p.tijdvakken?.includes(tijdvak.id));

  return (
    // `scroll-mt` houdt de kop vrij als je hiernaartoe springt vanaf een plaats.
    <Kaartje className="scroll-mt-4 p-4">
      <div id={tijdvak.id} className="scroll-mt-4">
        <div className="mb-1 flex flex-wrap items-baseline gap-x-2">
          <h2 className="text-lg font-semibold">{tijdvak.naam}</h2>
          <span className="text-sm text-inkt-zacht dark:text-papier/55">
            {tijdvak.van}
            {tijdvak.tot ? ` tot ${tijdvak.tot}` : ' tot nu'}
          </span>
        </div>

        <p className="leading-relaxed">{tijdvak.samenvatting}</p>

        {tijdvak.herkenbaarAan && (
          <p className="mt-2 text-sm text-inkt-zacht dark:text-papier/65">
            <strong className="font-medium text-inkt dark:text-papier">Herkenbaar aan:</strong>{' '}
            {tijdvak.herkenbaarAan}
          </p>
        )}

        {ladend ? null : uitDitTijdvak.length === 0 ? (
          <p className="mt-3 text-sm text-inkt-zacht/80 dark:text-papier/45">
            Nog geen punten uit dit tijdvak in de app.
          </p>
        ) : (
          <div className="mt-3 grid gap-2">
            {steden.map((stad) => {
              const hier = uitDitTijdvak.filter((p) => p.stad === stad.id);
              if (hier.length === 0) return null;
              return (
                <div key={stad.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <Link
                    to={`/stad/${stad.id}?tijdvak=${tijdvak.id}`}
                    className="text-sm font-medium text-zegel underline underline-offset-2"
                  >
                    {stad.naam}
                  </Link>
                  <span className="text-sm text-inkt-zacht dark:text-papier/60">
                    {hier.map((p) => p.naam).join(', ')}
                  </span>
                  <Label>{hier.length}</Label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Kaartje>
  );
};

/**
 * De geschiedenis van één stad, het tweede niveau uit hoofdstuk 4. Kort en
 * leesbaar, met vanaf hier de doorstap naar de landtijdlijn en naar de punten
 * op de kaart die erbij horen.
 */
export const StadGeschiedenisScherm = () => {
  const { stadId = '' } = useParams();
  const stad = STEDEN.find((s) => s.id === stadId);
  const tijdlijn = TIJDLIJNEN.find((t) => t.id === stad?.tijdlijn);

  if (!stad) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="mb-4">Deze stad staat niet in de app.</p>
        <Link to="/" className="text-zegel underline">
          Terug naar het overzicht
        </Link>
      </div>
    );
  }

  const tijdvakken = (tijdlijn?.tijdvakken ?? []).filter((v) => stad.tijdvakken.includes(v.id));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
      <Link to={`/stad/${stad.id}`} className="text-sm text-zegel underline underline-offset-2">
        Terug naar {stad.naam}
      </Link>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Geschiedenis van {stad.naam}</h1>

      <Kaartje className="mt-4 p-4">
        <p className="leading-relaxed whitespace-pre-line">
          {stad.geschiedenis ?? stad.korteBeschrijving}
        </p>
      </Kaartje>

      {tijdvakken.length > 0 && tijdlijn && (
        <section className="mt-6">
          <Sectiekop
            extra={
              <Link
                to={`/tijdlijn/${tijdlijn.id}`}
                className="text-xs text-zegel underline underline-offset-2"
              >
                hele tijdlijn
              </Link>
            }
          >
            Wat je hier van welk tijdvak ziet
          </Sectiekop>
          <div className="grid gap-2">
            {tijdvakken.map((v) => (
              <Kaartje key={v.id} className="p-3.5">
                <div className="mb-1 flex flex-wrap items-baseline gap-x-2">
                  <Link
                    to={`/tijdlijn/${tijdlijn.id}#${v.id}`}
                    className="font-medium text-zegel underline underline-offset-2"
                  >
                    {v.naam}
                  </Link>
                  <span className="text-sm text-inkt-zacht dark:text-papier/55">
                    {v.van}
                    {v.tot ? ` tot ${v.tot}` : ' tot nu'}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-inkt-zacht dark:text-papier/70">
                  {v.samenvatting}
                </p>
                <Link
                  to={`/stad/${stad.id}?tijdvak=${v.id}`}
                  className="mt-2 inline-block text-sm text-zegel underline underline-offset-2"
                >
                  Toon de punten uit dit tijdvak in {stad.naam}
                </Link>
              </Kaartje>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
