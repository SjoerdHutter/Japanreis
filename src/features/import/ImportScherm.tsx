import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { EigenPunt, Plaats } from '@/domein/schema';
import { STEDEN, laadAllePlaatsen } from '@/data/content';
import { leesBestand, type RuwPunt } from '@/domein/import/googlemaps';
import { stelVoor, type Voorstel, type Zekerheid } from '@/domein/import/koppel';
import { bewaarEigenPunten, leesEigenPunten, verwijderEigenPuntenVanLijst } from '@/data/db/idb';
import { Kaartje, Knop, Label, Sectiekop } from '@/ui/basis';

/**
 * Een Google Maps lijst in de app krijgen.
 *
 * Google heeft geen manier om een lijst rechtstreeks op te vragen, ook geen
 * gedeelde lijst van iemand anders: er is geen openbare koppeling en de
 * lijstpagina zelf is niet uit te lezen. Wat wel werkt is een bestand, en
 * daarom vraagt dit scherm om een bestand of om geplakte tekst.
 *
 * Niets wordt zonder bevestiging opgeslagen. Je ziet eerst wat er uit het
 * bestand komt, wat er aan een bestaande plaats gekoppeld zou worden en wat er
 * onzeker is, en pas dan gaat het naar je toestel. Een verkeerde koppeling
 * verstopt een punt onder een ander punt, en dat merk je pas als je ernaartoe
 * loopt.
 */

const NIEUWE_ID = () =>
  // crypto.randomUUID bestaat niet overal; de terugval is goed genoeg voor ids
  // die alleen op dit toestel hoeven te kloppen.
  globalThis.crypto?.randomUUID?.() ?? `punt-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const KLEUR: Record<Zekerheid, 'gewoon' | 'let-op' | 'gratis'> = {
  zeker: 'gratis',
  twijfel: 'let-op',
  geen: 'gewoon',
};

const WOORD: Record<Zekerheid, string> = {
  zeker: 'gekoppeld',
  twijfel: 'controleer',
  geen: 'nieuw punt',
};

export const ImportScherm = () => {
  const [plaatsen, setPlaatsen] = useState<Plaats[]>([]);
  const [lijstnaam, setLijstnaam] = useState('');
  const [plaktekst, setPlaktekst] = useState('');
  const [voorstellen, setVoorstellen] = useState<Voorstel[] | null>(null);
  const [koppelen, setKoppelen] = useState<Set<number>>(new Set());
  const [fout, setFout] = useState<string | null>(null);
  const [bewaard, setBewaard] = useState<number | null>(null);
  const [bestaande, setBestaande] = useState<EigenPunt[]>([]);

  useEffect(() => {
    void laadAllePlaatsen().then(setPlaatsen);
    void leesEigenPunten().then(setBestaande);
  }, []);

  const verwerk = useCallback(
    (tekst: string, naam: string) => {
      setFout(null);
      setBewaard(null);
      try {
        const ruwe: RuwPunt[] = leesBestand(tekst, naam || undefined);
        if (ruwe.length === 0) {
          setFout('Er stond geen enkel punt in dit bestand.');
          setVoorstellen(null);
          return;
        }
        const nieuw = stelVoor(ruwe, STEDEN, plaatsen);
        setVoorstellen(nieuw);
        // Een zekere koppeling staat vooraf aan, een twijfelgeval niet. Zo is
        // niets doen altijd de veilige keuze.
        setKoppelen(
          new Set(nieuw.flatMap((v, i) => (v.zekerheid === 'zeker' && v.plaatsId ? [i] : []))),
        );
      } catch (e) {
        setVoorstellen(null);
        setFout(e instanceof Error ? e.message : 'Dit bestand kon ik niet lezen.');
      }
    },
    [plaatsen],
  );

  const kiesBestand = async (bestand: File) => {
    const tekst = await bestand.text();
    const naam = lijstnaam || bestand.name.replace(/\.(json|geojson|csv|txt)$/i, '');
    setLijstnaam(naam);
    verwerk(tekst, naam);
  };

  const bewaar = async () => {
    if (!voorstellen) return;
    const nu = new Date().toISOString();
    const punten: EigenPunt[] = voorstellen.map((v, i) => ({
      id: NIEUWE_ID(),
      naam: v.ruw.naam,
      lijst: v.ruw.lijst ?? lijstnaam ?? undefined,
      coordinaten: v.ruw.coordinaten,
      adres: v.ruw.adres,
      notitie: v.ruw.notitie,
      url: v.ruw.url,
      stadId: v.stadId,
      koppelingPlaatsId: koppelen.has(i) ? v.plaatsId : undefined,
      bron: 'google-maps',
      toegevoegdOp: nu,
    }));
    await bewaarEigenPunten(punten);
    setBewaard(punten.length);
    setVoorstellen(null);
    setPlaktekst('');
    setBestaande(await leesEigenPunten());
  };

  const gooiLijstWeg = async (lijst: string) => {
    await verwijderEigenPuntenVanLijst(lijst);
    setBestaande(await leesEigenPunten());
  };

  const lijsten = [...new Set(bestaande.map((p) => p.lijst ?? 'zonder naam'))];
  const telling = (z: Zekerheid) => voorstellen?.filter((v) => v.zekerheid === z).length ?? 0;
  const zonderPlek = voorstellen?.filter((v) => !v.ruw.coordinaten).length ?? 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
      <Link to="/" className="text-sm text-zegel underline underline-offset-2">
        Alle steden
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Eigen punten importeren</h1>
      <p className="mt-2 mb-6 leading-relaxed text-inkt-zacht dark:text-papier/70">
        Uit een Google Takeout export, of uit een lijst die je plakt. Je punten blijven op dit
        toestel en krijgen op de kaart een eigen kleur, zodat altijd zichtbaar is wat van jou is en
        wat van de app.
      </p>

      <Kaartje className="mb-5 p-4">
        <label className="mb-1.5 block text-sm font-medium" htmlFor="lijstnaam">
          Naam van de lijst
        </label>
        <input
          id="lijstnaam"
          value={lijstnaam}
          onChange={(e) => setLijstnaam(e.target.value)}
          placeholder="Japan, van Ilse"
          className="mb-4 w-full rounded-lg border border-black/10 bg-white px-3 py-2 dark:border-white/15 dark:bg-nacht"
        />

        <label className="mb-1.5 block text-sm font-medium" htmlFor="bestand">
          Bestand uit Google Takeout
        </label>
        <input
          id="bestand"
          type="file"
          accept=".json,.geojson,.csv,.txt,application/json,text/csv,text/plain"
          onChange={(e) => {
            const bestand = e.target.files?.[0];
            if (bestand) void kiesBestand(bestand);
          }}
          className="mb-1 w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-papier-diep file:px-3 file:py-1.5 file:text-sm dark:file:bg-nacht-diep dark:file:text-papier"
        />
        <p className="mb-4 text-xs text-inkt-zacht dark:text-papier/50">
          GeoJSON heeft de coördinaten erin en werkt het beste. Een CSV heeft ze niet, dus daar
          worden ze uit de links gehaald en lukt dat niet altijd.
        </p>

        <label className="mb-1.5 block text-sm font-medium" htmlFor="plak">
          Of plak een lijst, één plek per regel
        </label>
        <textarea
          id="plak"
          value={plaktekst}
          onChange={(e) => setPlaktekst(e.target.value)}
          rows={5}
          placeholder={'Fushimi Inari\nNishiki markt; 35.0050; 135.7649\nGion'}
          className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 font-mono text-sm dark:border-white/15 dark:bg-nacht"
        />
        <div className="mt-3">
          <Knop
            soort="nadruk"
            disabled={!plaktekst.trim()}
            onClick={() => verwerk(plaktekst, lijstnaam)}
          >
            Lees deze lijst
          </Knop>
        </div>
      </Kaartje>

      {fout && (
        <p className="mb-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
          {fout}
        </p>
      )}

      {bewaard !== null && (
        <p className="mb-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100">
          {bewaard} punten opgeslagen. Ze staan nu op de kaart van hun stad.
        </p>
      )}

      {voorstellen && (
        <section className="mb-8">
          <Sectiekop extra={<span className="text-xs">{voorstellen.length} punten</span>}>
            Te importeren
          </Sectiekop>
          <p className="mb-3 text-sm text-inkt-zacht dark:text-papier/65">
            {telling('zeker')} gekoppeld aan een plaats die de app al kent, {telling('twijfel')} om
            te controleren, {telling('geen')} als nieuw punt.
            {zonderPlek > 0 &&
              ` ${zonderPlek} punten hadden geen coördinaten; die komen zonder pin binnen en kun je later met de hand plaatsen.`}
          </p>

          <div className="mb-4 grid gap-2">
            {voorstellen.map((v, i) => (
              <Kaartje key={`${v.ruw.naam}-${i}`} className="p-3">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-medium">{v.ruw.naam}</span>
                  <Label toon={KLEUR[v.zekerheid]}>{WOORD[v.zekerheid]}</Label>
                  {!v.ruw.coordinaten && <Label toon="let-op">geen plek</Label>}
                </div>
                <p className="mt-1 text-sm text-inkt-zacht dark:text-papier/65">{v.reden}</p>
                {v.plaatsId && (
                  <label className="mt-2 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={koppelen.has(i)}
                      onChange={(e) =>
                        setKoppelen((oud) => {
                          const nieuw = new Set(oud);
                          if (e.target.checked) nieuw.add(i);
                          else nieuw.delete(i);
                          return nieuw;
                        })
                      }
                    />
                    Koppel aan {v.plaatsNaam}
                  </label>
                )}
              </Kaartje>
            ))}
          </div>

          <div className="flex gap-2">
            <Knop soort="nadruk" onClick={() => void bewaar()}>
              Sla {voorstellen.length} punten op
            </Knop>
            <Knop soort="stil" onClick={() => setVoorstellen(null)}>
              Annuleer
            </Knop>
          </div>
        </section>
      )}

      {lijsten.length > 0 && (
        <section>
          <Sectiekop>Wat er al binnen is</Sectiekop>
          <div className="grid gap-2">
            {lijsten.map((lijst) => (
              <Kaartje key={lijst} className="flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{lijst}</span>
                  <span className="text-sm text-inkt-zacht dark:text-papier/60">
                    {bestaande.filter((p) => (p.lijst ?? 'zonder naam') === lijst).length} punten
                  </span>
                </span>
                <Knop klein soort="stil" onClick={() => void gooiLijstWeg(lijst)}>
                  Verwijder
                </Knop>
              </Kaartje>
            ))}
          </div>
        </section>
      )}

      <details className="mt-8 text-sm text-inkt-zacht dark:text-papier/65">
        <summary className="cursor-pointer font-medium text-inkt dark:text-papier">
          Hoe kom ik aan zo'n bestand?
        </summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 leading-relaxed">
          <li>
            Gaat het om een lijst van iemand anders: open de gedeelde link in Google Maps en sla de
            lijst op, zodat hij onder je eigen opgeslagen lijsten komt te staan.
          </li>
          <li>
            Ga naar takeout.google.com, kies bij de producten alleen{' '}
            <strong>Maps (your places)</strong> en <strong>Saved</strong>, en vraag de export aan.
          </li>
          <li>
            Pak het zip-bestand uit. De lijsten staan als <code>.csv</code> onder Saved, en je eigen
            opgeslagen plaatsen als <code>.json</code> onder Maps.
          </li>
          <li>Kies dat bestand hierboven.</li>
        </ol>
        <p className="mt-3 leading-relaxed">
          Lukt de export niet, plak dan de namen. Punten zonder coördinaten komen gewoon binnen en
          blijven staan tot je ze op de kaart zet.
        </p>
      </details>
    </div>
  );
};
