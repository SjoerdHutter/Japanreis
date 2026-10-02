import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, TrainFront } from 'lucide-react';
import { LAATSTE_TREINEN } from '@/data/content';
import { treinFeitId } from '@/data/content/feiten';
import { useOverschrijvingen, zetOverschrijving } from '@/data/overschrijvingen';
import { verblijfVanNacht } from '@/domein/gegevens/orden';
import { pasToe } from '@/domein/overschrijven/samenvoegen';
import { laatsteTreinVoor } from '@/domein/planning/laatsteTrein';
import { alsKlok, type Stop } from '@/domein/planning/dagplanner';
import { routeLink } from '@/domein/reizen/reisdagen';
import { useMijnGegevens } from '@/features/gegevens/gedeeld';
import { Knop } from '@/ui/basis';
import { Controleren } from '@/ui/Controleren';
import { EigenWaarde } from '@/ui/EigenWaarde';
import { Invoer } from '@/ui/formulier';

/**
 * De laatste trein, bij de laatste stop van je dag.
 *
 * Alleen 's avonds: een dag die om vijf uur eindigt heeft geen laatste trein
 * nodig. Knelt het, dan een waarschuwing met de tijd en een knop naar Google
 * Maps voor de echte vertrektijden. Weet de app het niet, dan zegt hij dat en
 * kun je de tijd zelf invullen.
 */

/** Vanaf hier is de laatste trein iets om aan te denken. */
const AVOND = 19 * 60;

export const LaatsteTreinMelding = ({
  stadId,
  datum,
  stop,
}: {
  stadId: string;
  datum: string;
  stop: Stop;
}) => {
  const { gegevens } = useMijnGegevens();
  const overschrijvingen = useOverschrijvingen();
  const [bewerken, setBewerken] = useState(false);
  const [tijd, setTijd] = useState('');

  const verblijf = verblijfVanNacht(datum, gegevens.accommodaties);
  const treinen = useMemo(
    () => LAATSTE_TREINEN.map((t) => pasToe(t, overschrijvingen, 'laatste-trein', t.id).waarde),
    [overschrijvingen],
  );
  const eigenTijd = verblijf
    ? (overschrijvingen.find(
        (o) =>
          o.doel === 'verblijf-trein' && o.doelId === verblijf.id && o.veld === 'laatsteVertrek',
      )?.waarde as string | undefined)
    : undefined;

  // Zonder plek op de kaart valt er geen afstand naar het station te rekenen.
  const vanaf = stop.plaats.coordinaten;
  if (!vanaf) return null;

  const uitkomst = laatsteTreinVoor({
    stadId,
    laatsteStop: { coordinaten: vanaf, vertrek: stop.vertrek },
    verblijf,
    treinen,
    eigenTijd,
  });

  if (stop.vertrek < AVOND || uitkomst.soort === 'loopafstand') return null;

  const bewaar = async () => {
    if (!/^\d{2}:\d{2}$/.test(tijd)) return;
    if (uitkomst.soort === 'bekend' && uitkomst.trein) {
      await zetOverschrijving('laatste-trein', uitkomst.trein.id, 'laatsteVertrek', tijd);
    } else if (verblijf) {
      await zetOverschrijving('verblijf-trein', verblijf.id, 'laatsteVertrek', tijd);
    }
    setBewerken(false);
  };

  const openMaps = () => {
    // De link wordt pas bij de tik gemaakt: het adres van je verblijf hoort
    // niet in een link die al op het scherm klaarstaat.
    const bestemming = verblijf?.coordinaten
      ? `${verblijf.coordinaten.lat},${verblijf.coordinaten.lon}`
      : (verblijf?.adresLatijn ?? verblijf?.terugstation ?? verblijf?.naam ?? '');
    window.open(
      routeLink({
        van: `${vanaf.lat},${vanaf.lon}`,
        naar: bestemming,
      }),
      '_blank',
      'noopener',
    );
  };

  const invoer = (
    <span className="mt-2 flex flex-wrap items-center gap-2">
      <Invoer
        type="time"
        value={tijd}
        onChange={(e) => setTijd(e.target.value)}
        aria-label="Laatste vertrektijd"
        className="w-32 px-2 py-1"
      />
      <Knop klein soort="nadruk" disabled={!tijd} onClick={() => void bewaar()}>
        Bewaar
      </Knop>
      <Knop klein soort="stil" onClick={() => setBewerken(false)}>
        Annuleer
      </Knop>
    </span>
  );

  if (uitkomst.soort === 'onbekend') {
    return (
      <div className="mt-2 rounded-lg bg-papier-diep p-2.5 text-sm dark:bg-nacht">
        <p className="flex items-center gap-1.5 font-medium">
          <TrainFront className="size-4" aria-hidden />
          Laatste trein onbekend
        </p>
        {uitkomst.reden === 'geen-verblijf' ? (
          <p className="mt-1">
            Voor deze nacht staat er geen verblijf in Mijn gegevens.{' '}
            <Link
              to="/gegevens?sectie=accommodaties"
              className="text-zegel underline dark:text-zegel-licht"
            >
              Vul het in
            </Link>
          </p>
        ) : (
          <>
            <p className="mt-1 text-inkt-zacht dark:text-papier/65">
              {uitkomst.reden === 'geen-terugstation'
                ? 'Bij je verblijf staat nog geen terugstation.'
                : `De app kent geen laatste trein van hier naar ${verblijf?.terugstation}.`}
            </p>
            {bewerken ? (
              invoer
            ) : (
              <span className="mt-1.5 flex flex-wrap gap-2">
                <Knop klein onClick={() => setBewerken(true)}>
                  Tijd invullen
                </Knop>
                <Knop klein soort="stil" onClick={openMaps}>
                  <ExternalLink className="size-3.5" aria-hidden />
                  Zoek op in Google Maps
                </Knop>
              </span>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className={`mt-2 rounded-lg p-2.5 text-sm leading-relaxed ${
        uitkomst.knelt
          ? 'bg-red-50 text-red-950 dark:bg-red-950/40 dark:text-red-100'
          : 'bg-papier-diep dark:bg-nacht'
      }`}
    >
      <p className="flex items-start gap-1.5">
        <TrainFront className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span className="min-w-0">
          <span className="mr-1.5 font-medium">
            Laatste trein naar {uitkomst.naar} rond {uitkomst.laatsteVertrek}
          </span>
          {uitkomst.trein ? (
            overschrijvingen.some(
              (o) => o.doel === 'laatste-trein' && o.doelId === uitkomst.trein!.id,
            ) ? (
              <EigenWaarde doel="laatste-trein" doelId={uitkomst.trein.id} veld="laatsteVertrek" />
            ) : (
              <Controleren
                id={treinFeitId(uitkomst.trein.id)}
                gecontroleerd={uitkomst.trein.gecontroleerd}
              />
            )
          ) : (
            verblijf && (
              <EigenWaarde doel="verblijf-trein" doelId={verblijf.id} veld="laatsteVertrek" />
            )
          )}
        </span>
      </p>
      <p className="mt-0.5">
        Vanaf {uitkomst.van}
        {uitkomst.lijn && `, ${uitkomst.lijn}`}.{' '}
        {uitkomst.knelt &&
          `Je laatste stop eindigt om ${alsKlok(stop.vertrek)}; dat is minder dan een half uur ervoor.`}
        {uitkomst.opmerking && ` ${uitkomst.opmerking}`}
      </p>
      {bewerken ? (
        invoer
      ) : (
        <span className="mt-1.5 flex flex-wrap gap-2">
          <Knop klein soort="stil" onClick={openMaps}>
            <ExternalLink className="size-3.5" aria-hidden />
            Controleer in Google Maps
          </Knop>
          <Knop klein soort="stil" onClick={() => setBewerken(true)}>
            Tijd aanpassen
          </Knop>
        </span>
      )}
    </div>
  );
};
