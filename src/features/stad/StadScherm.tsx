import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { EigenPunt, Plaats } from '@/domein/schema';
import { laadPlaatsen, stadMet, tijdlijnVan } from '@/data/content';
import { useApp } from '@/state/useApp';
import { Kaartje, Label, Sectiekop } from '@/ui/basis';
import { Kaart, laagVan, type KaartPunt } from '@/features/kaart/Kaart';
import { OfflineKnop } from '@/features/kaart/OfflineKnop';
import { VastzetKnop } from '@/features/steden/Hoofdmenu';
import { Filterbalk } from './Filterbalk';
import { verblijfIn, VERBLIJF_NAAM } from '@/domein/highlight/verblijf';
import { REISSCHEMA } from '@/data/content';
import { PlaatsRegel } from './PlaatsRegel';
import { leesEigenPunten } from '@/data/db/idb';
import { filterPlaatsen, keuzesUit, type Filter } from '@/domein/filters/plaatsen';
import { formatteerPrijs } from '@/domein/valuta/formatteer';

/**
 * Het scherm van één stad.
 *
 * Bereikbaar voor elke stad, altijd, ongeacht waar je bent. Dat is niet een
 * detail maar het uitgangspunt: de highlight bepaalt alleen wat er bovenaan het
 * hoofdmenu staat, nooit wat je mag openen.
 *
 * De vier tabs delen één kaart en één filter. De kaart toont wat het filter
 * overlaat, zodat "ramen onder EUR 9 binnen tien minuten lopen" niet alleen een
 * lijst is maar ook meteen laat zien welke kant je op moet.
 */

type Tab = 'attracties' | 'eten' | 'winkels' | 'stempels' | 'eigen';

const TABS: { id: Tab; naam: string }[] = [
  { id: 'attracties', naam: 'Attracties' },
  { id: 'eten', naam: 'Eten' },
  { id: 'winkels', naam: 'Winkels en overig' },
  { id: 'stempels', naam: 'Stempels' },
  { id: 'eigen', naam: 'Eigen punten' },
];

/**
 * Welke plaatsen horen bij welk tabblad.
 *
 * De tab "winkels en overig" vangt alles op wat geen attractie, eetlocatie of
 * stempel is. Die is er niet voor de sier: zonder dat tabblad zit een punt met
 * categorie `winkel`, `vervoer`, `verblijf` of `overig` wel in het bestand en op
 * de kaart, maar staat het in geen enkele lijst. Dat is precies het soort gat
 * waar je pas achter komt als je een winkeladres zoekt en het nergens kunt
 * vinden terwijl je zeker weet dat je het hebt toegevoegd.
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

/** 2026-10-13 wordt "13 oktober". Streepjes horen niet in een zin. */
const alsDatum = (isoDatum: string): string => {
  const [, maand, dag] = isoDatum.split('-');
  return `${Number(dag)} ${MAANDEN[Number(maand) - 1]}`;
};

const hoortBij = (plaats: Plaats, tab: Tab): boolean => {
  switch (tab) {
    case 'attracties':
      return plaats.categorie === 'attractie';
    case 'eten':
      return plaats.categorie === 'eten';
    case 'winkels':
      return (
        plaats.categorie === 'winkel' ||
        plaats.categorie === 'vervoer' ||
        plaats.categorie === 'verblijf' ||
        plaats.categorie === 'overig'
      );
    case 'stempels':
      return Boolean(plaats.ekiStempel || plaats.goshuin);
    case 'eigen':
      return false;
  }
};

export const StadScherm = () => {
  const { stadId = '' } = useParams();
  const stad = stadMet(stadId);
  const { koersen, positie, onthoudBezoek } = useApp();
  const [plaatsen, setPlaatsen] = useState<Plaats[] | null>(null);
  const [eigen, setEigen] = useState<EigenPunt[]>([]);
  const [tab, setTab] = useState<Tab>('attracties');
  /**
   * Elk tabblad houdt zijn eigen filter bij.
   *
   * Eén gedeeld filter lijkt eenvoudiger, maar dan neemt een keuze als "tempel"
   * je mee naar het tabblad Eten en is de lijst daar leeg zonder dat je ziet
   * waardoor: de filterbalk van Eten toont die knop immers niet. Zo blijft je
   * selectie ook staan als je even bij het eten kijkt en terugkomt.
   */
  const [filterPerTab, setFilterPerTab] = useState<Record<Tab, Filter>>({
    attracties: {},
    eten: {},
    winkels: {},
    stempels: {},
    eigen: {},
  });
  const filter = filterPerTab[tab];
  const setFilter = (nieuw: Filter) => setFilterPerTab((oud) => ({ ...oud, [tab]: nieuw }));
  const [zoekparams, setZoekparams] = useSearchParams();

  // Een tijdvak in de link betekent dat je hier vanaf de tijdlijn komt. Dan
  // staat dat filter meteen aan; dat is de terugweg uit hoofdstuk 4, in twee
  // tikken van tijdvak naar de punten die eruit stammen.
  //
  // Het tijdvak staat bewust niet in `filter`. De link is er de bron van, en
  // hem ook in state bewaren levert twee waarheden op die uit elkaar gaan lopen
  // zodra je terugnavigeert. Hij wordt er hieronder bij gemengd.
  const tijdvakUitLink = zoekparams.get('tijdvak') ?? undefined;

  useEffect(() => {
    if (!stad) return;
    onthoudBezoek(stad.id);
    let levend = true;
    void laadPlaatsen(stad.id).then((p) => {
      if (levend) setPlaatsen(p);
    });
    void leesEigenPunten(stad.id).then((p) => {
      if (levend) setEigen(p);
    });
    return () => {
      levend = false;
    };
  }, [stad, onthoudBezoek]);

  const werkendFilter = useMemo<Filter>(
    () => ({ ...filter, tijdvak: tijdvakUitLink }),
    [filter, tijdvakUitLink],
  );

  /** Alles los: de filters van dit tabblad én het tijdvak dat uit de link kwam. */
  const wisAlles = () => {
    setFilter({ vanaf: filter.vanaf });
    if (tijdvakUitLink) {
      zoekparams.delete('tijdvak');
      setZoekparams(zoekparams, { replace: true });
    }
  };

  const alle = useMemo(() => plaatsen ?? [], [plaatsen]);
  const vanTab = useMemo(() => alle.filter((p) => hoortBij(p, tab)), [alle, tab]);
  const keuzes = useMemo(() => keuzesUit(vanTab), [vanTab]);

  const zichtbaar = useMemo(
    () => (stad ? filterPlaatsen(vanTab, werkendFilter, stad) : []),
    [vanTab, werkendFilter, stad],
  );

  const zichtbareEigen = useMemo(() => {
    if (!filter.zoek?.trim()) return eigen;
    const naald = filter.zoek.trim().toLowerCase();
    return eigen.filter((p) =>
      [p.naam, p.notitie, p.lijst, p.adres].some((v) => v?.toLowerCase().includes(naald)),
    );
  }, [eigen, filter.zoek]);

  // De kaart volgt de tab. Op de tab eigen punten staan de redactionele punten
  // er lichtjes bij, zodat je ziet hoe jouw lijst zich tot de app verhoudt.
  const punten = useMemo<KaartPunt[]>(() => {
    const redactioneel = (tab === 'eigen' ? alle : zichtbaar).map((p) => ({
      id: p.id,
      naam: p.naam,
      coordinaten: p.coordinaten,
      laag: laagVan(p),
      toelichting: p.prijs ? formatteerPrijs(p.prijs, koersen) : undefined,
    }));

    const persoonlijk = zichtbareEigen
      .filter((p) => p.coordinaten && !p.koppelingPlaatsId)
      .map((p) => ({
        id: p.id,
        naam: p.naam,
        coordinaten: p.coordinaten!,
        laag: 'eigen' as const,
        toelichting:
          [p.lijst && `uit ${p.lijst}`, p.notitie].filter(Boolean).join(' · ') || undefined,
      }));

    return [...redactioneel, ...persoonlijk];
  }, [tab, alle, zichtbaar, zichtbareEigen, koersen]);

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
  const tijdvakNaam = tijdlijn?.tijdvakken.find((v) => v.id === tijdvakUitLink)?.naam;

  const verblijven = verblijfIn(REISSCHEMA, stad.id);

  const telling = (id: Tab): number =>
    id === 'eigen' ? eigen.length : alle.filter((p) => hoortBij(p, id)).length;

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

        {verblijven.map((v, i) => (
          <div
            key={`${v.van}-${i}`}
            className="mt-3 rounded-lg bg-papier-diep px-3 py-2 text-sm leading-relaxed dark:bg-nacht-diep"
          >
            <span className="font-medium">
              {v.van === v.tot
                ? alsDatum(v.van)
                : `${alsDatum(v.van)} tot en met ${alsDatum(v.tot)}`}
              {v.verblijf !== undefined &&
                v.verblijf.nachten > 0 &&
                `, ${v.verblijf.nachten} ${v.verblijf.nachten === 1 ? 'nacht' : 'nachten'}`}
            </span>
            {v.verblijf && (
              <span className="text-inkt-zacht dark:text-papier/70">
                {'. '}
                {VERBLIJF_NAAM[v.verblijf.via]}
                {v.verblijf.betaald === 'ja' && ', betaald'}
                {v.verblijf.betaald === 'nee' && ', nog niet betaald'}
                {v.verblijf.betaald === 'deels' && ', deels betaald'}
                {v.verblijf.ontbijt === false && ', geen ontbijt'}
              </span>
            )}
            {v.opmerking && (
              <p className="mt-1 text-inkt-zacht dark:text-papier/70">{v.opmerking}</p>
            )}
          </div>
        ))}
        <p className="mt-2">
          <Link
            to={`/geschiedenis/${stad.id}`}
            className="text-sm text-zegel underline underline-offset-2"
          >
            Geschiedenis van {stad.naam}
          </Link>
        </p>
      </header>

      <div className="mb-3">
        <Kaart punten={punten} gebied={stad.kaartgebied} positie={positie} />
      </div>
      <div className="mb-6">
        <OfflineKnop stad={stad} />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist">
        {TABS.map(({ id, naam }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              tab === id
                ? 'bg-inkt text-papier dark:bg-papier dark:text-inkt'
                : 'bg-papier-diep text-inkt-zacht hover:text-inkt dark:bg-nacht-diep dark:text-papier/70'
            }`}
          >
            {naam} <span className="opacity-60">{telling(id)}</span>
          </button>
        ))}
      </div>

      {tijdvakNaam && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-papier-diep p-3 text-sm dark:bg-nacht-diep">
          <span>
            Alleen punten uit het tijdvak <strong>{tijdvakNaam}</strong>.
          </span>
          <button
            type="button"
            onClick={() => {
              zoekparams.delete('tijdvak');
              setZoekparams(zoekparams, { replace: true });
            }}
            className="text-zegel underline underline-offset-2"
          >
            toon alles
          </button>
        </div>
      )}

      {plaatsen === null ? (
        <p className="text-sm text-inkt-zacht">Bezig met laden.</p>
      ) : tab === 'eigen' ? (
        <EigenLijst punten={zichtbareEigen} />
      ) : (
        <>
          <Filterbalk
            tab={tab}
            filter={werkendFilter}
            keuzes={keuzes}
            stad={stad}
            onWijzig={setFilter}
            onWisAlles={wisAlles}
            aantal={zichtbaar.length}
            totaal={vanTab.length}
          />

          {vanTab.length === 0 ? (
            <p className="text-sm text-inkt-zacht dark:text-papier/60">
              Voor deze stad staan er nog geen punten in deze categorie. Voeg ze toe in{' '}
              <code>data/plaatsen/{stad.id}.yaml</code>.
            </p>
          ) : zichtbaar.length === 0 ? (
            <p className="text-sm text-inkt-zacht dark:text-papier/60">
              Niets voldoet aan deze combinatie. Laat een filter los om weer iets te zien.
            </p>
          ) : (
            <div className="grid gap-2">
              {zichtbaar.map((p) => (
                <PlaatsRegel key={p.id} plaats={p} stad={stad} vanaf={filter.vanaf ?? positie} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

/**
 * De persoonlijke laag in de lijst.
 *
 * Apart van de redactionele content en met een eigen labelkleur, want een punt
 * uit een Google Maps lijst weet vaak niet meer dan een naam. Doen alsof het
 * gelijkwaardig is aan een nagekeken beschrijving zou de app minder betrouwbaar
 * maken, niet completer.
 */
const EigenLijst = ({ punten }: { punten: EigenPunt[] }) => {
  if (punten.length === 0) {
    return (
      <p className="text-sm text-inkt-zacht dark:text-papier/60">
        Nog niets van jezelf in deze stad.{' '}
        <Link to="/import" className="text-zegel underline underline-offset-2">
          Importeer een Google Maps lijst
        </Link>
        .
      </p>
    );
  }

  return (
    <>
      <Sectiekop
        extra={
          <Link to="/import" className="text-xs text-zegel underline underline-offset-2">
            importeren
          </Link>
        }
      >
        Uit je eigen lijsten
      </Sectiekop>
      <div className="grid gap-2">
        {punten.map((punt) => (
          <Kaartje key={punt.id} className="p-3.5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-medium">{punt.naam}</span>
              {punt.lijst && <Label toon="eigen">{punt.lijst}</Label>}
              {punt.ongeverifieerd && <Label toon="let-op">ongeverifieerd</Label>}
              {!punt.coordinaten && <Label toon="let-op">nog geen plek op de kaart</Label>}
            </div>
            {punt.notitie && (
              <p className="mt-1.5 text-sm text-inkt-zacht dark:text-papier/65">{punt.notitie}</p>
            )}
            {punt.adres && (
              <p className="mt-1 text-xs text-inkt-zacht/80 dark:text-papier/45">{punt.adres}</p>
            )}
          </Kaartje>
        ))}
      </div>
    </>
  );
};
