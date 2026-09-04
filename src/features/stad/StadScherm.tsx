import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Plaats, Stad } from '@/domein/schema';
import { laadPlaatsen, stadMet, tijdlijnVan } from '@/data/content';
import { useApp } from '@/state/useApp';
import { Kaartje, Knop, Label, Sectiekop } from '@/ui/basis';
import { Kaart, laagVan, type KaartPunt } from '@/features/kaart/Kaart';
import { OfflineKnop } from '@/features/kaart/OfflineKnop';
import { VastzetKnop } from '@/features/steden/Hoofdmenu';
import { formatteerPrijs } from '@/domein/valuta/formatteer';
import { WEEKDAGEN } from '@/domein/schema';

/**
 * Het scherm van één stad.
 *
 * Bereikbaar voor elke stad, altijd, ongeacht waar je bent. Dat is niet een
 * detail maar het uitgangspunt: de highlight bepaalt alleen wat er bovenaan het
 * hoofdmenu staat, nooit wat je mag openen.
 *
 * In deze fase toont het scherm de punten, de kaart en de geschiedenis. De
 * filters uit hoofdstuk 2 en 3 komen in fase 2 en hangen aan dezelfde lijst.
 */
export const StadScherm = () => {
  const { stadId = '' } = useParams();
  const stad = stadMet(stadId);
  const { koersen, positie, onthoudBezoek } = useApp();
  const [plaatsen, setPlaatsen] = useState<Plaats[] | null>(null);

  useEffect(() => {
    if (!stad) return;
    onthoudBezoek(stad.id);
    let levend = true;
    void laadPlaatsen(stad.id).then((p) => {
      if (levend) setPlaatsen(p);
    });
    return () => {
      levend = false;
    };
  }, [stad, onthoudBezoek]);

  const punten = useMemo<KaartPunt[]>(
    () =>
      (plaatsen ?? []).map((p) => ({
        id: p.id,
        naam: p.naam,
        coordinaten: p.coordinaten,
        laag: laagVan(p),
        toelichting: p.prijs ? formatteerPrijs(p.prijs, koersen) : undefined,
      })),
    [plaatsen, koersen],
  );

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

  const tijdlijn = tijdlijnVan(stad);
  const tijdvakken = (tijdlijn?.tijdvakken ?? []).filter((v) => stad.tijdvakken.includes(v.id));

  const attracties = (plaatsen ?? []).filter((p) => p.categorie === 'attractie');
  const eten = (plaatsen ?? []).filter((p) => p.categorie === 'eten');
  const stempels = (plaatsen ?? []).filter((p) => p.ekiStempel || p.goshuin);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
      <Link to="/" className="text-sm text-zegel underline underline-offset-2">
        Alle steden
      </Link>

      <header className="mt-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{stad.naam}</h1>
          {stad.naamLokaal && (
            <span className="text-inkt-zacht dark:text-papier/50">{stad.naamLokaal}</span>
          )}
          <span className="ml-auto">
            <VastzetKnop stadId={stad.id} />
          </span>
        </div>
        <p className="mt-2 leading-relaxed text-inkt-zacht dark:text-papier/70">
          {stad.korteBeschrijving}
        </p>
      </header>

      <div className="mb-3">
        <Kaart punten={punten} gebied={stad.kaartgebied} positie={positie} />
      </div>
      <div className="mb-7">
        <OfflineKnop stad={stad} />
      </div>

      {plaatsen === null ? (
        <p className="text-sm text-inkt-zacht">Bezig met laden.</p>
      ) : plaatsen.length === 0 ? (
        <p className="text-sm text-inkt-zacht dark:text-papier/60">
          Voor deze stad staan er nog geen punten in de app. Voeg ze toe in{' '}
          <code>data/plaatsen/{stad.id}.yaml</code>.
        </p>
      ) : (
        <>
          <PlaatsLijst titel="Attracties" plaatsen={attracties} stad={stad} />
          <PlaatsLijst titel="Eten" plaatsen={eten} stad={stad} />
          <PlaatsLijst titel="Stempels" plaatsen={stempels} stad={stad} />
        </>
      )}

      {stad.geschiedenis && (
        <section className="mt-8">
          <Sectiekop>Geschiedenis</Sectiekop>
          <Kaartje className="p-4">
            <p className="leading-relaxed whitespace-pre-line">{stad.geschiedenis}</p>
            {tijdvakken.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {tijdvakken.map((v) => (
                  <Label key={v.id}>
                    {v.naam} {v.van}
                    {v.tot ? ` tot ${v.tot}` : ' tot nu'}
                  </Label>
                ))}
              </div>
            )}
          </Kaartje>
        </section>
      )}
    </div>
  );
};

const PlaatsLijst = ({
  titel,
  plaatsen,
  stad,
}: {
  titel: string;
  plaatsen: Plaats[];
  stad: Stad;
}) => {
  if (plaatsen.length === 0) return null;
  return (
    <section className="mb-7">
      <Sectiekop
        extra={
          <span className="text-xs text-inkt-zacht dark:text-papier/50">{plaatsen.length}</span>
        }
      >
        {titel}
      </Sectiekop>
      <div className="grid gap-2">
        {plaatsen.map((p) => (
          <PlaatsRegel key={p.id} plaats={p} stad={stad} />
        ))}
      </div>
    </section>
  );
};

/** De vaste sluitingsdagen, waar de waarschuwing uit hoofdstuk 2 aan hangt. */
const geslotenDagen = (plaats: Plaats): string[] =>
  WEEKDAGEN.filter((dag) => plaats.openingstijden?.perDag?.[dag]?.toLowerCase() === 'gesloten');

const PlaatsRegel = ({ plaats, stad }: { plaats: Plaats; stad: Stad }) => {
  const { koersen } = useApp();
  const [open, setOpen] = useState(false);
  const gesloten = geslotenDagen(plaats);

  return (
    <Kaartje className="p-3.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 text-left"
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium">{plaats.naam}</span>
            {plaats.naamLokaal && (
              <span className="text-xs text-inkt-zacht dark:text-papier/50">
                {plaats.naamLokaal}
              </span>
            )}
          </span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {plaats.attractie && <Label>{plaats.attractie.type}</Label>}
            {plaats.eten && <Label>{plaats.eten.keuken}</Label>}
            {plaats.prijs === 'gratis' ? (
              <Label toon="gratis">gratis</Label>
            ) : (
              plaats.prijs && <Label>{formatteerPrijs(plaats.prijs, koersen)}</Label>
            )}
            {plaats.attractie?.bezoekduurMinuten && (
              <Label>{plaats.attractie.bezoekduurMinuten} min</Label>
            )}
            {gesloten.length > 0 && <Label toon="let-op">dicht op {gesloten.join(' en ')}</Label>}
            {plaats.reservering === 'verplicht' && <Label toon="let-op">reserveren</Label>}
          </span>
        </span>
        <span aria-hidden className="pt-1 text-inkt-zacht">
          {open ? '–' : '+'}
        </span>
      </button>

      {open && (
        <div className="mt-3 border-t border-black/5 pt-3 text-sm leading-relaxed dark:border-white/10">
          {plaats.beschrijving && <p>{plaats.beschrijving}</p>}

          {plaats.openingstijden && (
            <p className="mt-2 text-inkt-zacht dark:text-papier/65">
              <strong className="font-medium text-inkt dark:text-papier">Open:</strong>{' '}
              {plaats.openingstijden.standaard ?? 'wisselend'}
              {plaats.openingstijden.laatsteToegang &&
                `, laatste toegang ${plaats.openingstijden.laatsteToegang}`}
              {plaats.openingstijden.opmerking && `. ${plaats.openingstijden.opmerking}`}
            </p>
          )}

          {plaats.geslotenOpmerking && (
            <p className="mt-2 text-inkt-zacht dark:text-papier/65">{plaats.geslotenOpmerking}</p>
          )}

          {plaats.attractie?.drukte?.besteMoment && (
            <p className="mt-2 text-inkt-zacht dark:text-papier/65">
              <strong className="font-medium text-inkt dark:text-papier">Beste moment:</strong>{' '}
              {plaats.attractie.drukte.besteMoment}
            </p>
          )}

          {plaats.ekiStempel && (
            <p className="mt-2 text-inkt-zacht dark:text-papier/65">
              <strong className="font-medium text-inkt dark:text-papier">Eki stamp:</strong>{' '}
              {plaats.ekiStempel.waar}
            </p>
          )}

          {plaats.goshuin && (
            <p className="mt-2 text-inkt-zacht dark:text-papier/65">
              <strong className="font-medium text-inkt dark:text-papier">Goshuin:</strong>{' '}
              {plaats.goshuin.waar}
              {plaats.goshuin.prijs && `, ${formatteerPrijs(plaats.goshuin.prijs, koersen)}`}
              {plaats.goshuin.openingstijden?.standaard &&
                `. Het stempelkantoor is open ${plaats.goshuin.openingstijden.standaard}, let op: dat is vaak korter dan de tempel zelf.`}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Knop
              klein
              soort="stil"
              onClick={() =>
                window.open(
                  `https://www.google.com/maps/search/?api=1&query=${plaats.coordinaten.lat},${plaats.coordinaten.lon}`,
                  '_blank',
                  'noopener',
                )
              }
            >
              Route in Google Maps
            </Knop>
            {plaats.bronnen?.map((bron) =>
              bron.url ? (
                <a
                  key={bron.naam}
                  href={bron.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-center text-xs text-zegel underline underline-offset-2"
                >
                  {bron.naam}
                </a>
              ) : null,
            )}
          </div>

          <p className="mt-3 text-xs text-inkt-zacht/70 dark:text-papier/40">
            {stad.naam} · {plaats.coordinaten.lat.toFixed(4)}, {plaats.coordinaten.lon.toFixed(4)}
          </p>
        </div>
      )}
    </Kaartje>
  );
};
