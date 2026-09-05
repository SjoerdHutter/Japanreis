import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Coordinaat, Plaats } from '@/domein/schema';
import { STEDEN, laadAllePlaatsen, stadMet } from '@/data/content';
import { useApp } from '@/state/useApp';
import { Kaart, type KaartPunt } from '@/features/kaart/Kaart';
import { Kaartje, Knop, Label, Sectiekop } from '@/ui/basis';
import { leesFoto } from '@/domein/fotos/exif';
import { momentInZone } from '@/domein/tijd/zones';
import { alsGrootte, maakMiniatuur } from '@/domein/fotos/miniatuur';
import {
  groepeerPerDag,
  opTijd,
  overzicht,
  plaatsVoorFoto,
  reislijn,
  stadVoorPunt,
  steldPlekVoor,
  type Foto,
} from '@/domein/fotos/reis';
import {
  bewaarFotos,
  leesFotos,
  verwijderFoto,
  werkFotoBij,
  type OpgeslagenFoto,
} from '@/data/db/idb';
import { omhullendGebied } from './gebied';
import { maakReisverslag } from './verslag';

/**
 * De fotokaart.
 *
 * Je foto's op de kaart, als één doorlopende lijn door de reis: heenreis over
 * Hanoi, Japan, en terug over Hanoi. Niet per stad geknipt, want dan zou de
 * vlucht ertussenuit vallen en zou de reis eruitzien als losse eilanden.
 *
 * De foto's blijven op dit toestel. Er is geen server om ze naartoe te sturen
 * en er komt er ook geen; alleen het reisverslag dat je zelf opvraagt verlaat
 * de app, en daar zitten geen foto's in maar de route en de plekken.
 */

const NIEUWE_ID = () =>
  globalThis.crypto?.randomUUID?.() ?? `foto-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** De kaart van heel Japan en Vietnam, als er nog geen foto's zijn. */
const HELE_REIS = {
  zuidwest: { lat: 20.5, lon: 105 },
  noordoost: { lat: 36, lon: 140.5 },
};

export const FotokaartScherm = () => {
  const { positie } = useApp();
  const [fotos, setFotos] = useState<OpgeslagenFoto[]>([]);
  const [plaatsen, setPlaatsen] = useState<Plaats[]>([]);
  const [bezig, setBezig] = useState<{ klaar: number; totaal: number } | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [dag, setDag] = useState<string | null>(null);
  const [geselecteerd, setGeselecteerd] = useState<string | null>(null);
  const [plaatsBezig, setPlaatsBezig] = useState<string | null>(null);
  const [verslagUrl, setVerslagUrl] = useState<string | null>(null);

  /**
   * De blob-urls van de miniaturen.
   *
   * Ze worden gemaakt op het moment dat de foto's uit de database komen en de
   * vorige worden dan ingetrokken. Een url die je niet intrekt houdt de hele
   * foto in het geheugen vast, en bij tweehonderd vakantiefoto's is dat het
   * verschil tussen een app die werkt en een tabblad dat omvalt.
   */
  const urlsRef = useRef<Record<string, string>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});

  /**
   * Haalt de foto's op en zet de urls klaar. Geeft ze terug in plaats van ze
   * zelf in de toestand te zetten, zodat de aanroeper bepaalt wanneer het
   * scherm bijwerkt.
   */
  const haalFotosOp = useCallback(async () => {
    const uitDb = await leesFotos();
    for (const url of Object.values(urlsRef.current)) URL.revokeObjectURL(url);
    const nieuw: Record<string, string> = {};
    for (const foto of uitDb) nieuw[foto.id] = URL.createObjectURL(foto.miniatuur);
    urlsRef.current = nieuw;
    return { fotos: uitDb, urls: nieuw };
  }, []);

  const toon = useCallback(
    (uitkomst: { fotos: OpgeslagenFoto[]; urls: Record<string, string> }) => {
      setFotos(uitkomst.fotos);
      setUrls(uitkomst.urls);
    },
    [],
  );

  useEffect(() => {
    void haalFotosOp().then(toon);
    void laadAllePlaatsen().then(setPlaatsen);
    const bewaarde = urlsRef;
    return () => {
      for (const url of Object.values(bewaarde.current)) URL.revokeObjectURL(url);
      bewaarde.current = {};
    };
  }, [haalFotosOp, toon]);

  const alsFoto = (f: OpgeslagenFoto): Foto => ({
    id: f.id,
    naam: f.naam,
    genomenOp: f.genomenOp,
    wandklok: f.wandklok,
    coordinaten: f.coordinaten,
    handmatigGeplaatst: f.handmatigGeplaatst,
    stadId: f.stadId,
    plaatsId: f.plaatsId,
  });

  const alle = useMemo(() => fotos.map(alsFoto), [fotos]);
  const dagen = useMemo(() => groepeerPerDag(alle, STEDEN), [alle]);
  const cijfers = useMemo(() => overzicht(alle, STEDEN), [alle]);

  const zichtbaar = useMemo(() => {
    if (!dag) return opTijd(alle);
    return dagen.find((d) => d.datum === dag)?.fotos ?? [];
  }, [dag, dagen, alle]);

  // De lijn loopt altijd over de hele reis, ook als je één dag bekijkt: dan zie
  // je waar die dag in het geheel valt in plaats van een los stukje.
  const lijn = useMemo(() => reislijn(alle), [alle]);

  const punten = useMemo<KaartPunt[]>(
    () =>
      zichtbaar
        .filter((f) => f.coordinaten)
        .map((f) => ({
          id: f.id,
          naam: f.naam,
          coordinaten: f.coordinaten!,
          laag: 'foto' as const,
          toelichting: f.wandklok?.replace('T', ' '),
        })),
    [zichtbaar],
  );

  const gebied = useMemo(() => omhullendGebied(lijn.length > 0 ? lijn : [], HELE_REIS), [lijn]);

  const verwerk = async (bestanden: FileList) => {
    setFout(null);
    setBezig({ klaar: 0, totaal: bestanden.length });
    const nieuw: OpgeslagenFoto[] = [];
    const mislukt: string[] = [];

    for (const [i, bestand] of [...bestanden].entries()) {
      try {
        const [gegevens, miniatuur] = await Promise.all([
          leesFoto(bestand),
          maakMiniatuur(bestand),
        ]);
        const stad = gegevens.coordinaten ? stadVoorPunt(gegevens.coordinaten, STEDEN) : undefined;

        // De wandklok uit de camera omrekenen naar een echt moment, met de zone
        // van de stad waar de foto genomen is. Zonder plek is die zone niet te
        // weten; dan die van dit toestel, wat voor de volgorde binnen een dag
        // niets uitmaakt en over een zonegrens heen hooguit een paar uur
        // scheelt. De dag zelf komt toch uit de wandklok.
        const zone = stad?.tijdzone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
        const moment = gegevens.wandklok ? momentInZone(zone, gegevens.wandklok) : null;

        const foto: OpgeslagenFoto = {
          id: NIEUWE_ID(),
          naam: bestand.name,
          genomenOp: moment?.toISOString(),
          wandklok: gegevens.wandklok,
          tijdstipBron: gegevens.tijdstipBron,
          coordinaten: gegevens.coordinaten,
          stadId: stad?.id,
          volledig: bestand,
          miniatuur: miniatuur.blob,
          toegevoegdOp: new Date().toISOString(),
        };
        // De koppeling aan een attractie of restaurant meteen leggen, zolang
        // die dicht genoeg bij ligt om te kloppen.
        const bijPlaats = plaatsVoorFoto(alsFoto(foto), plaatsen);
        if (bijPlaats) foto.plaatsId = bijPlaats.id;
        nieuw.push(foto);
      } catch {
        // Een bestand dat de browser niet als afbeelding kan lezen valt af.
        mislukt.push(bestand.name);
      }
      setBezig({ klaar: i + 1, totaal: bestanden.length });
    }

    await bewaarFotos(nieuw);
    toon(await haalFotosOp());
    setBezig(null);
    if (mislukt.length > 0) {
      setFout(
        `${mislukt.length} ${mislukt.length === 1 ? 'bestand was' : 'bestanden waren'} geen leesbare afbeelding en ${mislukt.length === 1 ? 'is' : 'zijn'} overgeslagen.`,
      );
    }
  };

  const plaatsHandmatig = async (id: string, plek: Coordinaat) => {
    const foto = fotos.find((f) => f.id === id);
    if (!foto) return;
    const stad = stadVoorPunt(plek, STEDEN);

    // Nu de plek bekend is, is de tijdzone dat ook. Het moment opnieuw uitrekenen
    // uit de wandklok, zodat deze foto op de juiste plek in de reislijn valt en
    // niet een paar uur naast de foto's eromheen.
    const moment = stad && foto.wandklok ? momentInZone(stad.tijdzone, foto.wandklok) : null;

    const bijgewerkt: OpgeslagenFoto = {
      ...foto,
      coordinaten: plek,
      handmatigGeplaatst: true,
      stadId: stad?.id,
      genomenOp: moment?.toISOString() ?? foto.genomenOp,
    };
    const bijPlaats = plaatsVoorFoto(alsFoto(bijgewerkt), plaatsen);
    bijgewerkt.plaatsId = bijPlaats?.id;
    await werkFotoBij(bijgewerkt);
    toon(await haalFotosOp());
    setPlaatsBezig(null);
  };

  const gooiWeg = async (id: string) => {
    await verwijderFoto(id);
    // haalFotosOp trekt de url van deze foto in bij het opnieuw opbouwen.
    toon(await haalFotosOp());
    setGeselecteerd(null);
  };

  const maakVerslag = () => {
    if (verslagUrl) URL.revokeObjectURL(verslagUrl);
    const html = maakReisverslag(alle, STEDEN, plaatsen, cijfers);
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    setVerslagUrl(url);
  };
  useEffect(
    () => () => {
      if (verslagUrl) URL.revokeObjectURL(verslagUrl);
    },
    [verslagUrl],
  );

  const zonderPlek = fotos.filter((f) => !f.coordinaten);
  const ruimte = fotos.reduce((t, f) => t + f.volledig.size + f.miniatuur.size, 0);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
      <Link to="/" className="text-sm text-zegel underline underline-offset-2">
        Alle steden
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Fotokaart</h1>
      <p className="mt-2 mb-5 leading-relaxed text-inkt-zacht dark:text-papier/70">
        Je foto's op de kaart, als één doorlopende lijn: heenreis over Hanoi, Japan, en terug over
        Hanoi. De foto's blijven op dit toestel.
      </p>

      <Kaartje className="mb-5 p-4">
        <label className="mb-1.5 block text-sm font-medium" htmlFor="fotos">
          Foto's toevoegen
        </label>
        <input
          id="fotos"
          type="file"
          accept="image/*"
          multiple
          disabled={bezig !== null}
          onChange={(e) => {
            const bestanden = e.target.files;
            if (bestanden && bestanden.length > 0) void verwerk(bestanden);
            e.target.value = '';
          }}
          className="w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-papier-diep file:px-3 file:py-1.5 file:text-sm dark:file:bg-nacht-diep dark:file:text-papier"
        />
        {bezig ? (
          <p className="mt-2 text-sm text-inkt-zacht dark:text-papier/60">
            Bezig: {bezig.klaar} van {bezig.totaal}
          </p>
        ) : (
          <p className="mt-2 text-xs text-inkt-zacht dark:text-papier/50">
            De GPS en het tijdstip komen uit de foto zelf. Foto's zonder GPS komen gewoon binnen en
            krijgen hieronder een voorstel op basis van de route van die dag.
          </p>
        )}
        {fout && <p className="mt-2 text-sm text-zegel">{fout}</p>}
      </Kaartje>

      {fotos.length === 0 ? (
        <p className="text-sm text-inkt-zacht dark:text-papier/60">
          Nog geen foto's. Voeg ze hierboven toe; ze verlaten je toestel niet.
        </p>
      ) : (
        <>
          <div className="mb-3">
            <Kaart
              punten={punten}
              lijn={lijn}
              gebied={gebied}
              positie={positie}
              hoogte="22rem"
              onKies={setGeselecteerd}
              onTikOpKaart={
                plaatsBezig ? (plek) => void plaatsHandmatig(plaatsBezig, plek) : undefined
              }
            />
          </div>

          {plaatsBezig && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
              <span>Tik op de kaart om deze foto te plaatsen.</span>
              <button
                type="button"
                onClick={() => setPlaatsBezig(null)}
                className="underline underline-offset-2"
              >
                annuleren
              </button>
            </div>
          )}

          <Tijdbalk dagen={dagen} gekozen={dag} onKies={setDag} />

          <section className="mb-6">
            <Sectiekop
              extra={
                <span className="text-xs text-inkt-zacht dark:text-papier/50">
                  {zichtbaar.length} van {fotos.length}
                </span>
              }
            >
              {dag ? `Foto's van ${dag}` : 'Alle foto’s'}
            </Sectiekop>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {zichtbaar.map((f) => {
                const bestand = fotos.find((o) => o.id === f.id)!;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setGeselecteerd(geselecteerd === f.id ? null : f.id)}
                    className={`relative aspect-square overflow-hidden rounded-lg border-2 transition ${
                      geselecteerd === f.id ? 'border-zegel' : 'border-transparent'
                    }`}
                  >
                    <img
                      src={urls[bestand.id]}
                      alt={f.naam}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    {!f.coordinaten && (
                      <span className="absolute right-1 bottom-1 rounded bg-amber-500 px-1 text-[10px] font-medium text-white">
                        geen plek
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {geselecteerd && (
            <FotoDetail
              foto={fotos.find((f) => f.id === geselecteerd)!}
              alle={alle}
              plaatsen={plaatsen}
              url={urls[geselecteerd]}
              onPlaats={(plek) => void plaatsHandmatig(geselecteerd, plek)}
              onPlaatsMetTik={() => setPlaatsBezig(geselecteerd)}
              onVerwijder={() => void gooiWeg(geselecteerd)}
              onSluit={() => setGeselecteerd(null)}
            />
          )}

          {zonderPlek.length > 0 && !geselecteerd && (
            <p className="mb-6 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
              {zonderPlek.length} {zonderPlek.length === 1 ? 'foto heeft' : "foto's hebben"} geen
              plek. Tik erop in de galerij om er een voorstel voor te krijgen of hem zelf te
              plaatsen.
            </p>
          )}

          <section>
            <Sectiekop>De reis in cijfers</Sectiekop>
            <Kaartje className="p-4 text-sm leading-relaxed">
              <p>
                {cijfers.aantalFotos} foto's over {cijfers.aantalDagen}{' '}
                {cijfers.aantalDagen === 1 ? 'dag' : 'dagen'}, waarvan {cijfers.aantalMetPlek} met
                een plek op de kaart.
              </p>
              <p className="mt-1.5">
                Hemelsbreed {cijfers.hemelsbredeAfstandKm.toLocaleString('nl-NL')} kilometer tussen
                de foto's. Dat is de reikwijdte van de reis en geen gereden afstand.
              </p>
              {cijfers.stedenBezocht.length > 0 && (
                <p className="mt-1.5">
                  Steden op de lijn:{' '}
                  {cijfers.stedenBezocht.map((id) => stadMet(id)?.naam ?? id).join(', ')}.
                </p>
              )}
              <p className="mt-1.5 text-inkt-zacht dark:text-papier/55">
                De foto's nemen {alsGrootte(ruimte)} in beslag op dit toestel.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Knop klein onClick={maakVerslag}>
                  Maak een reisverslag
                </Knop>
                {verslagUrl && (
                  <a
                    href={verslagUrl}
                    download="reisverslag.html"
                    className="text-sm text-zegel underline underline-offset-2"
                  >
                    reisverslag.html opslaan
                  </a>
                )}
              </div>
              <p className="mt-2 text-xs text-inkt-zacht dark:text-papier/50">
                Het verslag bevat de route, de dagen en de plekken, en geen foto's. Zo kun je het
                delen zonder je fotorol mee te sturen.
              </p>
            </Kaartje>
          </section>
        </>
      )}
    </div>
  );
};

/** De tijdbalk: per dag door de route scrubben. */
const Tijdbalk = ({
  dagen,
  gekozen,
  onKies,
}: {
  dagen: { datum: string; stadId?: string; fotos: Foto[] }[];
  gekozen: string | null;
  onKies: (datum: string | null) => void;
}) => {
  if (dagen.length === 0) return null;
  return (
    <div className="mb-5">
      <Sectiekop>Tijdbalk</Sectiekop>
      <div className="flex gap-1.5 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => onKies(null)}
          aria-pressed={gekozen === null}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
            gekozen === null
              ? 'border-zegel bg-zegel text-white'
              : 'border-black/10 bg-white/70 dark:border-white/15 dark:bg-nacht-diep/70'
          }`}
        >
          hele reis
        </button>
        {dagen.map((d) => (
          <button
            key={d.datum}
            type="button"
            onClick={() => onKies(gekozen === d.datum ? null : d.datum)}
            aria-pressed={gekozen === d.datum}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
              gekozen === d.datum
                ? 'border-zegel bg-zegel text-white'
                : 'border-black/10 bg-white/70 dark:border-white/15 dark:bg-nacht-diep/70'
            }`}
          >
            {d.datum.slice(5)}{' '}
            <span className="opacity-60">
              {d.stadId ? (stadMet(d.stadId)?.naam ?? d.stadId) : d.fotos.length}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

/** Eén foto uitgelicht, met het voorstel voor een plek als hij die mist. */
const FotoDetail = ({
  foto,
  alle,
  plaatsen,
  url,
  onPlaats,
  onPlaatsMetTik,
  onVerwijder,
  onSluit,
}: {
  foto: OpgeslagenFoto;
  alle: Foto[];
  plaatsen: Plaats[];
  url: string;
  onPlaats: (plek: Coordinaat) => void;
  onPlaatsMetTik: () => void;
  onVerwijder: () => void;
  onSluit: () => void;
}) => {
  // De foto zelf doorgeven en niet een handgebouwde kopie. Zo'n kopie liep een
  // veld achter zodra er een bijkwam, en dan viel het voorstel stil zonder dat
  // er iets zichtbaar misging.
  const voorstel = useMemo(() => steldPlekVoor(foto, alle), [foto, alle]);

  const plaats = foto.plaatsId ? plaatsen.find((p) => p.id === foto.plaatsId) : undefined;
  const stad = foto.stadId ? stadMet(foto.stadId) : undefined;

  return (
    <Kaartje className="mb-6 p-4">
      <div className="flex gap-3">
        <img src={url} alt={foto.naam} className="h-24 w-24 shrink-0 rounded-lg object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{foto.naam}</p>
          <p className="mt-1 flex flex-wrap gap-1.5">
            {foto.genomenOp && <Label>{new Date(foto.genomenOp).toLocaleString('nl-NL')}</Label>}
            {foto.tijdstipBron === 'bestand' && <Label toon="let-op">tijd uit het bestand</Label>}
            {foto.handmatigGeplaatst && <Label toon="eigen">zelf geplaatst</Label>}
            {!foto.coordinaten && <Label toon="let-op">geen plek</Label>}
            {stad && <Label>{stad.naam}</Label>}
            {plaats && <Label toon="gratis">{plaats.naam}</Label>}
          </p>
        </div>
      </div>

      {!foto.coordinaten && (
        <div className="mt-3 border-t border-black/5 pt-3 dark:border-white/10">
          {voorstel ? (
            <>
              <p className="text-sm text-inkt-zacht dark:text-papier/65">{voorstel.reden}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Knop klein soort="nadruk" onClick={() => onPlaats(voorstel.coordinaten)}>
                  Neem dit voorstel over
                </Knop>
                <Knop klein onClick={onPlaatsMetTik}>
                  Zelf aanwijzen
                </Knop>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-inkt-zacht dark:text-papier/65">
                Er staat geen foto met een plek dicht genoeg in de tijd om iets voor te stellen.
                Zelf aanwijzen is hier eerlijker dan gokken.
              </p>
              <div className="mt-2">
                <Knop klein soort="nadruk" onClick={onPlaatsMetTik}>
                  Zelf aanwijzen
                </Knop>
              </div>
            </>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-black/5 pt-3 dark:border-white/10">
        {foto.coordinaten && (
          <Knop klein soort="stil" onClick={onPlaatsMetTik}>
            Verplaatsen
          </Knop>
        )}
        <Knop klein soort="stil" onClick={onSluit}>
          Sluiten
        </Knop>
        <span className="ml-auto">
          <Knop klein soort="stil" onClick={onVerwijder}>
            Verwijder deze foto
          </Knop>
        </span>
      </div>
    </Kaartje>
  );
};
