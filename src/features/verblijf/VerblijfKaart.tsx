import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BedDouble, Car, Copy, ExternalLink, Phone } from 'lucide-react';
import { REISSCHEMA, stadMet } from '@/data/content';
import { useOverschrijvingen, zetOverschrijving } from '@/data/overschrijvingen';
import { eigenaarVan } from '@/data/gegevens';
import { verblijfVanNacht } from '@/domein/gegevens/orden';
import { VERBLIJF_NAAM } from '@/domein/highlight/verblijf';
import { pasToe } from '@/domein/overschrijven/samenvoegen';
import { telLink, type Accommodatie, type Reissegment, type Verblijf } from '@/domein/schema';
import { alsKorteDatum, plusDagen } from '@/domein/tijd/datums';
import { Bijlagen } from '@/features/gegevens/Bijlagen';
import { useMijnGegevens } from '@/features/gegevens/gedeeld';
import { Knop } from '@/ui/basis';
import { EigenWaarde } from '@/ui/EigenWaarde';
import { Keuze } from '@/ui/formulier';
import { Verborgen } from '@/ui/Verborgen';
import { TaxiScherm, verblijfAlsDoel } from './TaxiScherm';

/**
 * Waar je vannacht slaapt, met alles wat je onderweg nodig hebt: het adres in
 * lokaal schrift, in- en uitchecken, het station en de uitgang, het nummer,
 * de bevestiging. En een knop voor de taxichauffeur.
 *
 * Staat het verblijf nog niet in Mijn gegevens, of mist het adres, dan zegt de
 * kaart dat en brengt hij je in één tik naar het formulier.
 */

/** Het stuk reisschema waar deze nacht onder valt, voor wat de app al weet. */
const segmentVan = (
  datum: string,
  stadId: string,
): (Reissegment & { verblijf: Verblijf }) | undefined =>
  REISSCHEMA.segmenten.find(
    (s): s is Reissegment & { verblijf: Verblijf } =>
      s.stad === stadId && !!s.van && !!s.tot && s.van <= datum && datum <= s.tot && !!s.verblijf,
  );

export const kopieer = async (tekst: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(tekst);
    return true;
  } catch {
    return false;
  }
};

/** Google Maps naar het verblijf, pas gemaakt bij de tik; het adres staat niet vooraf in een link. */
export const openRoute = (verblijf: Accommodatie) => {
  const bestemming = verblijf.coordinaten
    ? `${verblijf.coordinaten.lat},${verblijf.coordinaten.lon}`
    : (verblijf.adresLatijn ?? verblijf.adresLokaal ?? verblijf.naam);
  const parameters = new URLSearchParams({
    api: '1',
    destination: bestemming,
    travelmode: 'transit',
  });
  window.open(`https://www.google.com/maps/dir/?${parameters.toString()}`, '_blank', 'noopener');
};

export const VerblijfKaart = ({
  datum,
  nachtStadId,
}: {
  datum: string;
  /** Waar je volgens het reisschema slaapt, voor als het verblijf nog ontbreekt. */
  nachtStadId?: string;
}) => {
  const { gegevens, geladen } = useMijnGegevens();
  const [taxi, setTaxi] = useState(false);
  const [gekopieerd, setGekopieerd] = useState(false);
  if (!geladen) return null;

  const verblijf = verblijfVanNacht(datum, gegevens.accommodaties);

  if (!verblijf) {
    if (!nachtStadId) return null;
    const params = new URLSearchParams({
      sectie: 'accommodaties',
      stad: nachtStadId,
      van: datum,
      tot: plusDagen(datum, 1),
    });
    return (
      <div className="flex items-start gap-2.5 rounded-xl bg-papier-diep p-3 text-sm dark:bg-nacht">
        <BedDouble className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Waar je slaapt in {stadMet(nachtStadId)?.naam ?? nachtStadId} staat nog niet in Mijn
          gegevens.{' '}
          <Link
            to={`/gegevens?${params.toString()}`}
            className="font-medium text-zegel underline underline-offset-2 dark:text-zegel-licht"
          >
            Vul deze accommodatie aan
          </Link>
        </span>
      </div>
    );
  }

  const stad = stadMet(verblijf.stadId);
  const taal = stad?.land === 'vietnam' ? 'vi' : 'ja';
  const adres = verblijf.adresLokaal ?? verblijf.adresLatijn;
  const inchecken = verblijf.incheck.datum === datum;
  const uitchecken = verblijf.uitcheck.datum === plusDagen(datum, 1);

  return (
    <div className="rounded-xl border border-black/5 bg-papier/60 p-3.5 dark:border-white/10 dark:bg-nacht/40">
      <p className="flex items-start gap-2">
        <BedDouble
          className="mt-0.5 size-5 shrink-0 text-indigo-reis dark:text-papier/70"
          aria-hidden
        />
        <span className="min-w-0">
          <span className="block font-semibold">{verblijf.naam}</span>
          {verblijf.naamLokaal && (
            <span lang={taal} className="block text-sm text-inkt-zacht dark:text-papier/60">
              {verblijf.naamLokaal}
            </span>
          )}
        </span>
      </p>

      {verblijf.adresLokaal ? (
        <p lang={taal} className="mt-2 text-lg leading-snug">
          {verblijf.adresLokaal}
        </p>
      ) : (
        <p className="mt-2 text-sm">
          Nog geen adres in lokaal schrift.{' '}
          <Link
            to={`/gegevens?sectie=accommodaties&id=${verblijf.id}`}
            className="font-medium text-zegel underline underline-offset-2 dark:text-zegel-licht"
          >
            Vul deze accommodatie aan
          </Link>
        </p>
      )}
      {verblijf.adresLatijn && (
        <p className="text-sm text-inkt-zacht dark:text-papier/60">{verblijf.adresLatijn}</p>
      )}

      <dl className="mt-2 grid gap-0.5 text-sm">
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="text-inkt-zacht dark:text-papier/60">Inchecken</dt>
          <dd className={inchecken ? 'font-medium' : ''}>
            {inchecken ? 'vandaag' : alsKorteDatum(verblijf.incheck.datum)}
            {verblijf.incheck.tijd && ` vanaf ${verblijf.incheck.tijd}`}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="text-inkt-zacht dark:text-papier/60">Uitchecken</dt>
          <dd className={uitchecken ? 'font-medium' : ''}>
            {uitchecken ? 'morgen' : alsKorteDatum(verblijf.uitcheck.datum)}
            {verblijf.uitcheck.tijd && ` uiterlijk ${verblijf.uitcheck.tijd}`}
          </dd>
        </div>
        {(verblijf.station || verblijf.uitgang) && (
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="text-inkt-zacht dark:text-papier/60">Station</dt>
            <dd>{[verblijf.station, verblijf.uitgang].filter(Boolean).join(', ')}</dd>
          </div>
        )}
        {verblijf.boekingsnummer && (
          <div className="flex flex-wrap items-center gap-x-1.5">
            <dt className="text-inkt-zacht dark:text-papier/60">Boeking</dt>
            <dd>
              <Verborgen waarde={verblijf.boekingsnummer} wat="Boekingsnummer" />
            </dd>
          </div>
        )}
      </dl>

      <SchemaInfo datum={datum} stadId={verblijf.stadId} />

      <div className="mt-3 flex flex-wrap gap-2">
        <Knop klein soort="nadruk" onClick={() => setTaxi(true)}>
          <Car className="size-4" aria-hidden />
          Toon aan taxichauffeur
        </Knop>
        {verblijf.telefoon && (
          <a
            href={telLink(verblijf.telefoon)}
            className="inline-flex items-center gap-1.5 rounded-full bg-papier-diep px-3 py-1.5 text-sm font-medium dark:bg-nacht-diep"
          >
            <Phone className="size-4" aria-hidden />
            Bel
          </a>
        )}
        {adres && (
          <Knop
            klein
            onClick={() =>
              void kopieer(adres).then((gelukt) => {
                setGekopieerd(gelukt);
                if (gelukt) window.setTimeout(() => setGekopieerd(false), 2000);
              })
            }
          >
            <Copy className="size-4" aria-hidden />
            {gekopieerd ? 'Gekopieerd' : 'Kopieer adres'}
          </Knop>
        )}
        <Knop klein onClick={() => openRoute(verblijf)}>
          <ExternalLink className="size-4" aria-hidden />
          Route in Google Maps
        </Knop>
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-inkt-zacht dark:text-papier/60">Bijlagen</summary>
        <div className="mt-2">
          <Bijlagen eigenaar={eigenaarVan(verblijf)} />
        </div>
      </details>

      {taxi && <TaxiScherm doel={verblijfAlsDoel(verblijf)} onSluit={() => setTaxi(false)} />}
    </div>
  );
};

/**
 * Wat het reisschema over dit verblijf weet: via wie, betaald, ontbijt. Betaald
 * en ontbijt kun je zelf aanpassen; dat verandert tijdens de reis, en de
 * content weet het dan niet meer.
 */
const SchemaInfo = ({ datum, stadId }: { datum: string; stadId: string }) => {
  const overschrijvingen = useOverschrijvingen();
  const [bewerken, setBewerken] = useState(false);
  const segment = segmentVan(datum, stadId);
  if (!segment) return null;
  const doelId = `${segment.stad}-${segment.van}`;
  const { waarde, eigen } = pasToe(segment.verblijf, overschrijvingen, 'reissegment', doelId);

  const betaaldTekst = {
    ja: 'betaald',
    nee: 'nog niet betaald',
    deels: 'deels betaald',
  } as const;

  return (
    <div className="mt-2 text-sm text-inkt-zacht dark:text-papier/65">
      <p>
        {VERBLIJF_NAAM[waarde.via]}
        {waarde.betaald && `, ${betaaldTekst[waarde.betaald]}`}
        {eigen.has('betaald') && (
          <>
            {' '}
            <EigenWaarde doel="reissegment" doelId={doelId} veld="betaald" />
          </>
        )}
        {waarde.ontbijt !== undefined && `, ${waarde.ontbijt ? 'met ontbijt' : 'geen ontbijt'}`}
        {eigen.has('ontbijt') && (
          <>
            {' '}
            <EigenWaarde doel="reissegment" doelId={doelId} veld="ontbijt" />
          </>
        )}{' '}
        <button type="button" onClick={() => setBewerken((v) => !v)} className="text-xs underline">
          aanpassen
        </button>
      </p>
      {bewerken && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Keuze
            aria-label="Betaald"
            value={waarde.betaald ?? ''}
            onChange={(e) =>
              void zetOverschrijving('reissegment', doelId, 'betaald', e.target.value || undefined)
            }
          >
            <option value="">betaald onbekend</option>
            <option value="ja">betaald</option>
            <option value="deels">deels betaald</option>
            <option value="nee">nog niet betaald</option>
          </Keuze>
          <Keuze
            aria-label="Ontbijt"
            value={waarde.ontbijt === undefined ? '' : waarde.ontbijt ? 'ja' : 'nee'}
            onChange={(e) =>
              void zetOverschrijving(
                'reissegment',
                doelId,
                'ontbijt',
                e.target.value === '' ? undefined : e.target.value === 'ja',
              )
            }
          >
            <option value="">ontbijt onbekend</option>
            <option value="ja">met ontbijt</option>
            <option value="nee">geen ontbijt</option>
          </Keuze>
        </div>
      )}
    </div>
  );
};
