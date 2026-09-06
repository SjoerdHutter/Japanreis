import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/state/useApp';
import { Keuzebalk } from './Keuzebalk';
import { StadKaartje } from './StadKaartje';
import { Kaartje, Knop, Label, Sectiekop } from '@/ui/basis';
import { leesCachestatus } from '@/data/db/idb';
import { TIJDLIJNEN, REISSCHEMA } from '@/data/content';
import type { Reden } from '@/domein/highlight/bepaal';
import { bepaalReisstatus, type Reisstatus } from '@/domein/highlight/reisstatus';
import { datumIn } from '@/domein/tijd/zones';

/**
 * Het hoofdmenu: één highlight bovenaan, alle andere steden eronder.
 *
 * De volgorde is met opzet zo. De highlight is een hulpje, geen filter: de
 * lijst eronder is altijd volledig en bevat altijd elke stad, ook Hanoi en ook
 * de stad aan de andere kant van het land. Er is geen enkele toestand waarin
 * hier iets ontbreekt.
 */

/** Waarom staat deze stad bovenaan? In één regel, zodat het niet magisch voelt. */
const UITLEG: Record<Reden, string> = {
  'gps-en-schema': 'Je bent hier, en het reisschema zegt hetzelfde.',
  gps: 'Volgens je locatie ben je hier.',
  schema: 'Volgens het reisschema is dit vandaag aan de beurt.',
  keuze: 'Jij hebt deze gekozen. Geldt tot vannacht.',
  vastgezet: 'Vastgezet, dus de automatische keuze staat uit.',
  'laatst-bekeken': 'Dit was de stad die je het laatst open had.',
  eerste: 'Nog geen locatie en nog geen datums in het reisschema.',
};

/**
 * De uitleg bij de laatste terugval, die iets moet zeggen dat ook echt klopt.
 *
 * Bij `eerste` weet de app niet waar je bent en wijst het schema niets aan. Dat
 * kan drie verschillende dingen betekenen, en ze door elkaar halen levert een
 * regel op die de lezer naar een bestand stuurt waar niets mis mee is.
 */
const MAANDEN = [
  'januari',
  'februari',
  'maart',
  'april',
  'mei',
  'juni',
  'juli',
  'augustus',
  'september',
  'oktober',
  'november',
  'december',
];

/** 2026-10-04 wordt "4 oktober". Een datum in een zin hoort geen streepjes te hebben. */
const alsDatum = (isoDatum: string): string => {
  const [, maand, dag] = isoDatum.split('-');
  return `${Number(dag)} ${MAANDEN[Number(maand) - 1]}`;
};

const uitlegBij = (reden: Reden, status: Reisstatus): string => {
  if (reden !== 'eerste') return UITLEG[reden];
  if (status.fase === 'voor-vertrek') {
    const dagen = status.dagenTot ?? 0;
    return `Nog geen locatie. De reis begint ${dagen === 1 ? 'morgen' : `over ${dagen} dagen`}, op ${alsDatum(status.vertrek ?? '')}.`;
  }
  if (status.fase === 'afgelopen') {
    return `Nog geen locatie, en de reis is afgelopen op ${alsDatum(status.terug ?? '')}.`;
  }
  if (status.fase === 'onderweg') {
    return 'Nog geen locatie, en voor vandaag staat er geen stad in het reisschema.';
  }
  return UITLEG.eerste;
};

export const Hoofdmenu = () => {
  const { steden, highlight, kiesStad, laatLos, locatieStatus, vraagLocatie } = useApp();
  const [offlineSteden, setOfflineSteden] = useState<Set<string>>(new Set());

  useEffect(() => {
    void leesCachestatus().then((statussen) =>
      setOfflineSteden(new Set(statussen.filter((s) => s.tegels > 0).map((s) => s.stadId))),
    );
  }, []);

  const stadMet = (id: string | null | undefined) => steden.find((s) => s.id === id);
  const bovenaan = stadMet(highlight.stadId);
  const tweede = stadMet(highlight.tweedeStadId);
  const conflictGps = stadMet(highlight.conflict?.gpsStadId);
  const conflictSchema = stadMet(highlight.conflict?.schemaStadId);

  const rest = steden.filter((s) => s.id !== bovenaan?.id && s.id !== tweede?.id);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-5 pb-16">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Japanreis</h1>
        <p className="text-sm text-inkt-zacht dark:text-papier/60">
          Japan en Hanoi, ook zonder bereik.
        </p>
      </header>

      {conflictGps && conflictSchema && (
        <div className="mb-4">
          <Keuzebalk
            gps={conflictGps}
            schema={conflictSchema}
            onKies={(id, opties) => kiesStad(id, opties)}
          />
        </div>
      )}

      {bovenaan && (
        <section className="mb-6">
          <Sectiekop
            extra={
              highlight.vastgezet ? (
                <button
                  type="button"
                  onClick={laatLos}
                  className="text-xs font-medium text-zegel underline underline-offset-2"
                >
                  laat los
                </button>
              ) : null
            }
          >
            {tweede ? 'Vandaag' : 'Nu'}
          </Sectiekop>

          <div className={tweede ? 'grid gap-3 sm:grid-cols-2' : ''}>
            <HighlightKaart
              stad={bovenaan}
              vastgezet={highlight.vastgezet}
              reden={highlight.reden}
            />
            {tweede && <HighlightKaart stad={tweede} vastgezet={false} reden={highlight.reden} />}
          </div>
        </section>
      )}

      <section>
        <Sectiekop
          extra={
            locatieStatus === 'uit' ? (
              <button
                type="button"
                onClick={vraagLocatie}
                className="text-xs font-medium text-zegel underline underline-offset-2"
              >
                gebruik mijn locatie
              </button>
            ) : locatieStatus === 'geweigerd' ? (
              <span className="text-xs text-inkt-zacht dark:text-papier/50">locatie geweigerd</span>
            ) : null
          }
        >
          Alle steden
        </Sectiekop>
        <div className="grid gap-2">
          {rest.map((stad) => (
            <StadKaartje key={stad.id} stad={stad} offline={offlineSteden.has(stad.id)} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <Sectiekop>Geschiedenis</Sectiekop>
        <div className="grid gap-2">
          {TIJDLIJNEN.map((tijdlijn) => (
            <Link
              key={tijdlijn.id}
              to={`/tijdlijn/${tijdlijn.id}`}
              className="flex items-center gap-3 rounded-xl border border-black/5 bg-white/60 px-3.5 py-3 transition hover:bg-white dark:border-white/10 dark:bg-nacht-diep/60 dark:hover:bg-nacht-diep"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Tijdlijn {tijdlijn.naam}</span>
                <span className="block text-sm text-inkt-zacht dark:text-papier/60">
                  {tijdlijn.tijdvakken[0].naam} tot{' '}
                  {tijdlijn.tijdvakken[tijdlijn.tijdvakken.length - 1].naam}
                </span>
              </span>
              <span className="text-xs text-inkt-zacht dark:text-papier/50">
                {tijdlijn.tijdvakken.length} tijdvakken
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-center">
        <Link to="/fotos" className="text-sm text-zegel underline underline-offset-2">
          Fotokaart
        </Link>
        <Link to="/stempels" className="text-sm text-zegel underline underline-offset-2">
          Stempelboek
        </Link>
        <Link to="/apps" className="text-sm text-zegel underline underline-offset-2">
          Handige apps
        </Link>
        <Link to="/tips" className="text-sm text-zegel underline underline-offset-2">
          Tips uit je collectie
        </Link>
        <Link to="/vervoer" className="text-sm text-zegel underline underline-offset-2">
          Vervoer en JR Pass
        </Link>
        <Link to="/budget" className="text-sm text-zegel underline underline-offset-2">
          Budget
        </Link>
        <Link to="/dagplanner" className="text-sm text-zegel underline underline-offset-2">
          Dagplanner
        </Link>
        <Link to="/overstap" className="text-sm text-zegel underline underline-offset-2">
          Overstap Hanoi
        </Link>
        <Link to="/context" className="text-sm text-zegel underline underline-offset-2">
          Etiquette en taal
        </Link>
        <Link to="/import" className="text-sm text-zegel underline underline-offset-2">
          Eigen punten importeren
        </Link>
        <p className="w-full text-xs text-inkt-zacht dark:text-papier/40">
          Versie {__APP_VERSIE__}
        </p>
      </div>
    </div>
  );
};

const HighlightKaart = ({
  stad,
  vastgezet,
  reden,
}: {
  stad: {
    id: string;
    naam: string;
    naamLokaal?: string;
    land: string;
    tijdzone: string;
    korteBeschrijving: string;
  };
  vastgezet: boolean;
  reden: Reden;
}) => {
  // Vandaag in de tijdzone van deze stad, net als de rest van de highlight
  // logica: op de vlucht naar Tokio springt de telefoon om en dan zou de teller
  // tot vertrek een dag verkeerd staan.
  const reisstatus = bepaalReisstatus(REISSCHEMA, datumIn(stad.tijdzone, new Date()));
  return (
    <Kaartje className="overflow-hidden">
      <Link to={`/stad/${stad.id}`} className="block p-4">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xl" aria-hidden>
            {stad.land === 'japan' ? '🇯🇵' : '🇻🇳'}
          </span>
          <h3 className="text-xl font-semibold">{stad.naam}</h3>
          {stad.naamLokaal && (
            <span className="text-sm text-inkt-zacht dark:text-papier/50">{stad.naamLokaal}</span>
          )}
          {vastgezet && <Label toon="let-op">vastgezet</Label>}
        </div>
        <p className="text-[15px] leading-relaxed text-inkt-zacht dark:text-papier/70">
          {stad.korteBeschrijving}
        </p>
        <p className="mt-3 text-xs text-inkt-zacht/80 dark:text-papier/45">
          {uitlegBij(reden, reisstatus)}
        </p>
      </Link>
    </Kaartje>
  );
};

export const VastzetKnop = ({ stadId }: { stadId: string }) => {
  const { kiesStad, highlight, laatLos } = useApp();
  const staatVast = highlight.vastgezet && highlight.stadId === stadId;
  return (
    <Knop
      klein
      soort={staatVast ? 'nadruk' : 'gewoon'}
      aria-pressed={staatVast}
      onClick={() => (staatVast ? laatLos() : kiesStad(stadId, { vastgezet: true }))}
    >
      {staatVast ? 'Vastgezet' : 'Zet bovenaan'}
    </Knop>
  );
};
