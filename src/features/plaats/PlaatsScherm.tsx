import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CarTaxiFront, Copy, ExternalLink, MapPinOff, Phone, TriangleAlert } from 'lucide-react';
import { stadMet } from '@/data/content';
import { useOverschrijvingen, zetOverschrijving } from '@/data/overschrijvingen';
import { eigenVelden, useAllePlaatsen } from '@/data/usePlaatsen';
import { telLink, type Plaats, type Stad } from '@/domein/schema';
import { bezoekduurVan, drukteVan, regenbestendigVan } from '@/domein/filters/plaatsen';
import { mapsLink } from '@/domein/geo/link';
import {
  minutenIn,
  nuOpen,
  tijdenOp,
  vasteSluitingsdagen,
  volgendeVoorstelling,
} from '@/domein/openingstijden/status';
import { alsKlok } from '@/domein/planning/dagplanner';
import { etenInDeBuurt, vlakbij, type Buurplek } from '@/domein/plaatsen/buurt';
import { alsLangeDatum, alsPeriode } from '@/domein/tijd/datums';
import { datumIn } from '@/domein/tijd/zones';
import { formatteerPrijs, regelAlsPrijs } from '@/domein/valuta/formatteer';
import { Kaart, laagVan } from '@/features/kaart/Kaart';
import { TaxiScherm, plaatsAlsDoel } from '@/features/verblijf/TaxiScherm';
import { useApp } from '@/state/useApp';
import { Kaartje, Knop, Label, Sectiekop, Terug } from '@/ui/basis';
import {
  EigenVeld,
  LocatieBewerken,
  OpeningstijdenBewerken,
  PrijzenBewerken,
  SluitingenBewerken,
} from './Bewerken';
import { PlaatsLabels } from './PlaatsLabels';
import { dagTekst } from './tekst';

/**
 * Alles over één plek. De lijst van de stad toont het belangrijkste; hier staat
 * de rest: waarom de plek erin staat, waar je op moet letten, alle prijzen,
 * waar je eet in de buurt, en de knop voor de taxichauffeur.
 *
 * Elk feit dat je beter weet, pas je hier aan. Dat wordt een eigen waarde, met
 * het label en een knop om terug te zetten.
 */

/** Welk blok de duur, beste tijd en regen van deze plek draagt. */
const blokVan = (plaats: Plaats): 'attractie' | 'eten' | 'spa' | undefined =>
  plaats.attractie ? 'attractie' : plaats.eten ? 'eten' : plaats.spa ? 'spa' : undefined;

const soortLabel = (plaats: Plaats): string | undefined =>
  plaats.attractie?.type ??
  (plaats.eten
    ? (plaats.eten.keukenTekst ?? plaats.eten.keuken.replace('-', ' en '))
    : undefined) ??
  (plaats.categorie === 'spa' ? 'spa en wellness' : undefined);

const Regel = ({ titel, children }: { titel: string; children: React.ReactNode }) => (
  <p className="mt-1.5 leading-relaxed">
    <strong className="font-medium">{titel}:</strong> {children}
  </p>
);

const Buurlijst = ({ titel, buren, stad }: { titel: string; buren: Buurplek[]; stad: Stad }) => {
  if (buren.length === 0) return null;
  return (
    <section className="mb-6">
      <Sectiekop>{titel}</Sectiekop>
      <div className="grid gap-2">
        {buren.map(({ plaats, minuten, gekoppeld }) => {
          const open = nuOpen(plaats, stad);
          return (
            <Link
              key={plaats.id}
              to={`/plaats/${plaats.id}`}
              className="rounded-xl border border-black/5 bg-white/60 px-3.5 py-3 transition hover:bg-white dark:border-white/10 dark:bg-nacht-diep/60 dark:hover:bg-nacht-diep"
            >
              <span className="block font-medium">{plaats.naam}</span>
              <span className="mt-1 flex flex-wrap gap-1.5">
                {soortLabel(plaats) && <Label>{soortLabel(plaats)}</Label>}
                {minuten !== null && <Label>{minuten} min lopen</Label>}
                {minuten === null && <Label>afstand onbekend</Label>}
                {gekoppeld && <Label toon="gratis">aanrader</Label>}
                {open === true && <Label toon="gratis">nu open</Label>}
                {open === false && <Label>nu dicht</Label>}
                {plaats.onderscheiding && <Label>{plaats.onderscheiding}</Label>}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export const PlaatsScherm = () => {
  const { plaatsId = '' } = useParams();
  const alle = useAllePlaatsen();
  const overschrijvingen = useOverschrijvingen();
  const { koersen } = useApp();
  const [taxi, setTaxi] = useState(false);
  const [gekopieerd, setGekopieerd] = useState(false);

  if (alle === null) {
    return <p className="mx-auto max-w-2xl px-4 py-10 text-sm">Bezig met laden.</p>;
  }
  const plaats = alle.find((p) => p.id === plaatsId);
  const stad = plaats ? stadMet(plaats.stad) : undefined;
  if (!plaats || !stad) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-4 pb-16">
        <Terug naar="/" />
        <p className="mt-3">Deze plek staat niet in de app.</p>
      </div>
    );
  }

  const inStad = alle.filter((p) => p.stad === stad.id);
  const eigen = eigenVelden(overschrijvingen, plaats.id);
  const blok = blokVan(plaats);
  const hoofd = plaats.onderdeelVan ? inStad.find((p) => p.id === plaats.onderdeelVan) : undefined;
  const onderdelen = inStad.filter((p) => p.onderdeelVan === plaats.id);
  const vandaag = datumIn(stad.tijdzone);
  const vandaagTijden = tijdenOp(plaats, vandaag);
  const open = nuOpen(plaats, stad);
  const sluitingsdagen = vasteSluitingsdagen(plaats.openingstijden);
  const volgende =
    plaats.voorstellingen && volgendeVoorstelling(plaats, minutenIn(stad.tijdzone, new Date()));
  const drukte = drukteVan(plaats);
  const regen = regenbestendigVan(plaats);
  const duur = bezoekduurVan(plaats);
  const adresTekst = [plaats.naamLokaal ?? plaats.naam, plaats.adresLokaal ?? plaats.adres]
    .filter(Boolean)
    .join('\n');

  const kopieer = async () => {
    try {
      await navigator.clipboard.writeText(adresTekst);
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 2000);
    } catch {
      /* geen klembord, bijvoorbeeld zonder https: dan gebeurt er niets */
    }
  };

  const zetHier = (plek: { lat: number; lon: number }) => {
    const tekst = `${plek.lat.toFixed(5)}, ${plek.lon.toFixed(5)}`;
    if (window.confirm(`${plaats.naam} hier op de kaart zetten (${tekst})?`)) {
      void zetOverschrijving('plaats', plaats.id, 'coordinaten', {
        lat: Number(plek.lat.toFixed(5)),
        lon: Number(plek.lon.toFixed(5)),
      });
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
      <Terug naar={`/stad/${stad.id}`} />

      <header className="mt-1 mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">{plaats.naam}</h1>
        {plaats.naamLokaal && plaats.naamLokaal !== plaats.naam && (
          <p
            lang={stad.land === 'vietnam' ? 'vi' : 'ja'}
            className="text-inkt-zacht dark:text-papier/60"
          >
            {plaats.naamLokaal}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {plaats.rang !== undefined && <Label>nummer {plaats.rang} van de Top 20</Label>}
          {soortLabel(plaats) && <Label>{soortLabel(plaats)}</Label>}
          {plaats.prijs && <Label>{formatteerPrijs(plaats.prijs, koersen)}</Label>}
          {open === true && <Label toon="gratis">nu open</Label>}
          {open === false && <Label>nu dicht</Label>}
          <PlaatsLabels plaats={plaats} metBron />
        </div>
        {hoofd && (
          <p className="mt-2 text-sm">
            Hoort bij{' '}
            <Link
              to={`/plaats/${hoofd.id}`}
              className="font-medium text-zegel underline underline-offset-2 dark:text-zegel-licht"
            >
              {hoofd.naam}
            </Link>
            .
          </p>
        )}
      </header>

      {plaats.letOp && plaats.letOp.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="mb-1 flex items-center gap-1.5 font-semibold">
            <TriangleAlert className="size-4" aria-hidden />
            Let op
          </p>
          <ul className="grid list-disc gap-1 pl-5 text-sm leading-relaxed">
            {plaats.letOp.map((zin) => (
              <li key={zin}>{zin}</li>
            ))}
          </ul>
        </div>
      )}

      {plaats.beschrijving && <p className="mb-5 leading-relaxed">{plaats.beschrijving}</p>}

      {plaats.waarom && (
        <section className="mb-6">
          <Sectiekop>Waarom deze plek</Sectiekop>
          <p className="leading-relaxed">{plaats.waarom}</p>
        </section>
      )}

      <section className="mb-6">
        <Sectiekop>Open</Sectiekop>
        <Kaartje className="p-3.5 text-sm">
          <p className="leading-relaxed">
            <strong className="font-medium">Vandaag:</strong> {dagTekst(vandaagTijden)}
          </p>
          {plaats.openingstijden?.tekst && (
            <Regel titel="Tijden">{plaats.openingstijden.tekst}</Regel>
          )}
          {!plaats.openingstijden?.tekst && plaats.openingstijden?.standaard && (
            <Regel titel="Tijden">{plaats.openingstijden.standaard}</Regel>
          )}
          {plaats.openingstijden?.osm && (
            <p className="mt-1 text-xs text-inkt-zacht dark:text-papier/55">
              Zo rekent de app: {plaats.openingstijden.osm}
            </p>
          )}
          {sluitingsdagen.length > 0 && (
            <Regel titel="Vaste sluitingsdagen">{sluitingsdagen.join(' en ')}</Regel>
          )}
          {plaats.voorstellingen && plaats.voorstellingen.length > 0 && (
            <Regel titel="Voorstellingen">
              {plaats.voorstellingen.join(', ')}
              {volgende !== null && volgende !== undefined
                ? `. De volgende vandaag is om ${alsKlok(volgende)}.`
                : '. Vandaag geen meer.'}
            </Regel>
          )}
          {plaats.sluitingen?.map((s) => (
            <Regel key={`${s.van}-${s.tot}`} titel={`Dicht ${alsPeriode(s.van, s.tot)}`}>
              {s.reden}
            </Regel>
          ))}
          {plaats.geslotenOpmerking && <Regel titel="Let op">{plaats.geslotenOpmerking}</Regel>}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <OpeningstijdenBewerken plaats={plaats} stad={stad} eigen={eigen} />
            <SluitingenBewerken plaats={plaats} eigen={eigen} />
          </div>
        </Kaartje>
      </section>

      {(plaats.prijzen?.length || plaats.prijs || plaats.prijsTekst) && (
        <section className="mb-6">
          <Sectiekop>Prijs</Sectiekop>
          <Kaartje className="p-3.5 text-sm">
            {plaats.prijzen && plaats.prijzen.length > 0 ? (
              <ul className="grid gap-1.5">
                {plaats.prijzen.map((regel, i) => (
                  <li
                    key={`${regel.omschrijving}-${i}`}
                    className="flex flex-wrap items-baseline gap-x-2"
                  >
                    <span className="font-medium">{regel.omschrijving}</span>
                    <span>{formatteerPrijs(regelAlsPrijs(regel, stad.valuta), koersen)}</span>
                    {regel.eenheid && <span>{regel.eenheid}</span>}
                    {regel.indicatief && <Label>indicatie</Label>}
                  </li>
                ))}
              </ul>
            ) : (
              plaats.prijs && <p>{formatteerPrijs(plaats.prijs, koersen)}</p>
            )}
            {plaats.prijsTekst && <p className="mt-1.5 leading-relaxed">{plaats.prijsTekst}</p>}
            {plaats.alleenContant && <p className="mt-1.5 font-medium">Alleen contant.</p>}
            <div className="mt-2">
              <PrijzenBewerken plaats={plaats} eigen={eigen} />
            </div>
          </Kaartje>
        </section>
      )}

      <section className="mb-6">
        <Sectiekop>Je bezoek</Sectiekop>
        <Kaartje className="p-3.5 text-sm">
          <Regel titel="Duur">{duur !== undefined ? `ongeveer ${duur} minuten` : 'onbekend'}</Regel>
          {blok && (
            <EigenVeld
              plaats={plaats}
              veld={`${blok}.bezoekduurMinuten`}
              soort="getal"
              label="duur"
              eigen={eigen}
            />
          )}
          <Regel titel="Beste tijd">{drukte?.besteMoment ?? 'onbekend'}</Regel>
          {blok && (
            <EigenVeld
              plaats={plaats}
              veld={`${blok}.drukte.besteMoment`}
              soort="tekst"
              label="beste tijd"
              eigen={eigen}
            />
          )}
          <Regel titel="Bij regen">
            {regen === true ? 'geschikt' : regen === false ? 'niet geschikt' : 'onbekend'}
          </Regel>
          {blok && (
            <EigenVeld
              plaats={plaats}
              veld={`${blok}.regenbestendig`}
              soort="jaNee"
              label="bij regen"
              eigen={eigen}
            />
          )}
          {plaats.reservering && plaats.reservering !== 'niet-nodig' && (
            <Regel titel="Reserveren">
              {plaats.reservering === 'verplicht' ? 'verplicht' : 'aanbevolen'}
            </Regel>
          )}
          <Regel titel="Status">
            {plaats.status === 'onzeker' ? 'onzeker, de toegang wisselt' : 'geen bijzonderheden'}
          </Regel>
          <EigenVeld plaats={plaats} veld="status" soort="status" label="status" eigen={eigen} />
        </Kaartje>
      </section>

      {(plaats.tips?.length || plaats.gecontroleerd !== undefined) && (
        <section className="mb-6">
          <Sectiekop>Tips</Sectiekop>
          {plaats.tips && plaats.tips.length > 0 ? (
            <ul className="grid gap-2">
              {plaats.tips.map((tip) => (
                <li
                  key={tip}
                  className="rounded-xl bg-papier-diep p-3 text-sm leading-relaxed dark:bg-nacht-diep"
                >
                  {tip}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-inkt-zacht dark:text-papier/60">Nog geen tips.</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <EigenVeld plaats={plaats} veld="tips" soort="regels" label="tips" eigen={eigen} />
            <EigenVeld plaats={plaats} veld="letOp" soort="regels" label="let op" eigen={eigen} />
          </div>
        </section>
      )}

      <section className="mb-6">
        <Sectiekop>Adres</Sectiekop>
        <Kaartje className="p-3.5 text-sm">
          {plaats.adres && <p className="leading-relaxed">{plaats.adres}</p>}
          {plaats.adresLokaal && (
            <p
              lang={stad.land === 'vietnam' ? 'vi' : 'ja'}
              className="mt-1 text-base leading-relaxed"
            >
              {plaats.adresLokaal}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Knop klein soort="nadruk" onClick={() => setTaxi(true)}>
              <CarTaxiFront className="size-4" aria-hidden />
              Toon aan chauffeur
            </Knop>
            <Knop klein onClick={() => void kopieer()}>
              <Copy className="size-4" aria-hidden />
              {gekopieerd ? 'Gekopieerd' : 'Kopieer adres'}
            </Knop>
            <Knop klein onClick={() => window.open(mapsLink(plaats), '_blank', 'noopener')}>
              <ExternalLink className="size-4" aria-hidden />
              Route in Google Maps
            </Knop>
          </div>
          {plaats.telefoon && (
            <p className="mt-3">
              <a
                href={telLink(plaats.telefoon)}
                className="inline-flex items-center gap-1.5 font-medium text-zegel dark:text-zegel-licht"
              >
                <Phone className="size-4" aria-hidden />
                {plaats.telefoon}
              </a>
            </p>
          )}
          {plaats.web && (
            <p className="mt-2">
              <a
                href={plaats.web}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-zegel underline underline-offset-2 dark:text-zegel-licht"
              >
                {plaats.web.replace(/^https?:\/\//, '')}
              </a>
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <EigenVeld
              plaats={plaats}
              veld="telefoon"
              soort="tekst"
              label="telefoon"
              eigen={eigen}
            />
            <EigenVeld plaats={plaats} veld="web" soort="tekst" label="website" eigen={eigen} />
          </div>
        </Kaartje>
      </section>

      <section className="mb-6">
        <Sectiekop>Op de kaart</Sectiekop>
        {!plaats.coordinaten && (
          <p className="mb-2 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
            <MapPinOff className="mt-0.5 size-4 shrink-0" aria-hidden />
            Locatie ontbreekt. Plak coördinaten of druk lang op de kaart, op de plek zelf.
          </p>
        )}
        <Kaart
          punten={
            plaats.coordinaten
              ? [
                  {
                    id: plaats.id,
                    naam: plaats.naam,
                    coordinaten: plaats.coordinaten,
                    laag: laagVan(plaats),
                  },
                ]
              : []
          }
          gebied={
            plaats.coordinaten
              ? {
                  zuidwest: {
                    lat: plaats.coordinaten.lat - 0.004,
                    lon: plaats.coordinaten.lon - 0.005,
                  },
                  noordoost: {
                    lat: plaats.coordinaten.lat + 0.004,
                    lon: plaats.coordinaten.lon + 0.005,
                  },
                }
              : stad.kaartgebied
          }
          hoogte="14rem"
          clusteren={false}
          onLangDrukken={zetHier}
        />
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <LocatieBewerken plaats={plaats} eigen={eigen} />
          {plaats.coordBron === 'nominatim' && !eigen.has('coordinaten') && (
            <span className="text-xs text-inkt-zacht dark:text-papier/55">
              Locatie gevonden via OpenStreetMap; kan een paar meter naast de deur liggen.
            </span>
          )}
        </div>
      </section>

      {plaats.categorie === 'attractie' ? (
        <Buurlijst
          titel="Eten en drinken in de buurt"
          buren={etenInDeBuurt(plaats, inStad)}
          stad={stad}
        />
      ) : (
        <Buurlijst titel="Vlakbij" buren={vlakbij(plaats, inStad)} stad={stad} />
      )}

      {onderdelen.length > 0 && (
        <section className="mb-6">
          <Sectiekop>Hoort erbij</Sectiekop>
          <div className="grid gap-2">
            {onderdelen.map((o) => (
              <Link
                key={o.id}
                to={`/plaats/${o.id}`}
                className="rounded-xl border border-black/5 bg-white/60 px-3.5 py-3 font-medium transition hover:bg-white dark:border-white/10 dark:bg-nacht-diep/60 dark:hover:bg-nacht-diep"
              >
                {o.naam}
              </Link>
            ))}
          </div>
        </section>
      )}

      {(plaats.bronnen?.length || plaats.gecheckt) && (
        <section className="mb-6">
          <Sectiekop>Bron</Sectiekop>
          <p className="text-sm leading-relaxed">
            {plaats.bronnen?.map((bron, i) => (
              <span key={bron.naam}>
                {i > 0 && ', '}
                {bron.url ? (
                  <a
                    href={bron.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zegel underline underline-offset-2 dark:text-zegel-licht"
                  >
                    {bron.naam}
                  </a>
                ) : (
                  bron.naam
                )}
              </span>
            ))}
            {plaats.gecheckt && (
              <span className="text-inkt-zacht dark:text-papier/60">
                {plaats.bronnen?.length ? '. ' : ''}Gecheckt op {alsLangeDatum(plaats.gecheckt)}.
              </span>
            )}
          </p>
        </section>
      )}

      {taxi && <TaxiScherm doel={plaatsAlsDoel(plaats)} onSluit={() => setTaxi(false)} />}
    </div>
  );
};
