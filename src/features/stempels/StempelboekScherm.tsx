import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Plaats } from '@/domein/schema';
import { STEDEN, laadAllePlaatsen, stadMet } from '@/data/content';
import { Kaartje, Knop, Label } from '@/ui/basis';
import {
  bewaarStempel,
  leesStempels,
  lees,
  schrijf,
  verwijderStempel,
  type VerzameldeStempel,
} from '@/data/db/idb';
import { maakMiniatuur } from '@/domein/fotos/miniatuur';
import { teHalenUit, tellers, toonGoshuinTip, type TeHalen } from '@/domein/stempels/boek';

/**
 * Het digitale stempelboek.
 *
 * Twee soorten die uit elkaar gehouden worden, want het zijn twee gewoontes.
 * Eki stamps zijn gratis, staan op stations en bij attracties, en het zoeken is
 * het halve spel: ze staan zelden bij de ingang. Een goshuin is kalligrafie die
 * ter plekke geschreven wordt, kost een paar honderd yen, en hoort in een eigen
 * boekje dat je vooraf koopt.
 *
 * Dat laatste is de reden voor de tip bovenaan: wie er pas achter komt als hij
 * voor het loket staat, krijgt een los vel dat later nergens meer in past.
 */
export const StempelboekScherm = () => {
  const [plaatsen, setPlaatsen] = useState<Plaats[]>([]);
  const [gehaald, setGehaald] = useState<VerzameldeStempel[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [tipWeg, setTipWeg] = useState(true);
  const [stadFilter, setStadFilter] = useState<string | null>(null);
  const [bezig, setBezig] = useState<string | null>(null);

  const haalOp = useCallback(async () => {
    const stempels = await leesStempels();
    const nieuweUrls: Record<string, string> = {};
    for (const stempel of stempels) {
      if (stempel.afbeelding) nieuweUrls[stempel.id] = URL.createObjectURL(stempel.afbeelding);
    }
    return { stempels, urls: nieuweUrls };
  }, []);

  const toon = useCallback(
    (uitkomst: { stempels: VerzameldeStempel[]; urls: Record<string, string> }) => {
      setUrls((oud) => {
        for (const url of Object.values(oud)) URL.revokeObjectURL(url);
        return uitkomst.urls;
      });
      setGehaald(uitkomst.stempels);
    },
    [],
  );

  useEffect(() => {
    void laadAllePlaatsen().then(setPlaatsen);
    void haalOp().then(toon);
    void lees('stempelboek.tipGetoond').then((v) => setTipWeg(v === true));
  }, [haalOp, toon]);

  const teHalen = useMemo(() => teHalenUit(plaatsen), [plaatsen]);
  const gehaaldeIds = useMemo(() => new Set(gehaald.map((s) => s.id)), [gehaald]);
  const { totaal, perStad } = useMemo(
    () => tellers(teHalen, gehaaldeIds, STEDEN),
    [teHalen, gehaaldeIds],
  );

  const zichtbaar = useMemo(
    () => (stadFilter ? teHalen.filter((s) => s.stadId === stadFilter) : teHalen),
    [teHalen, stadFilter],
  );

  const wisselen = async (stempel: TeHalen) => {
    if (gehaaldeIds.has(stempel.id)) {
      await verwijderStempel(stempel.id);
    } else {
      await bewaarStempel({
        id: stempel.id,
        plaatsId: stempel.plaatsId,
        stadId: stempel.stadId,
        type: stempel.type,
        gehaaldOp: new Date().toISOString().slice(0, 10),
      });
    }
    toon(await haalOp());
  };

  const voegAfbeeldingToe = async (stempel: TeHalen, bestand: File) => {
    setBezig(stempel.id);
    try {
      // Alleen de miniatuur bewaren en niet het origineel: een stempel is een
      // afdruk van een paar centimeter, daar is 480 pixels ruim voor. Dat
      // scheelt bij vijftig stempels een paar honderd megabyte.
      const miniatuur = await maakMiniatuur(bestand);
      const bestaand = gehaald.find((s) => s.id === stempel.id);
      await bewaarStempel({
        id: stempel.id,
        plaatsId: stempel.plaatsId,
        stadId: stempel.stadId,
        type: stempel.type,
        gehaaldOp: bestaand?.gehaaldOp ?? new Date().toISOString().slice(0, 10),
        notitie: bestaand?.notitie,
        afbeelding: miniatuur.blob,
      });
      toon(await haalOp());
    } catch {
      /* geen leesbare afbeelding: de stempel blijft gewoon afgevinkt staan */
    } finally {
      setBezig(null);
    }
  };

  const tipTonen = toonGoshuinTip(gehaaldeIds, tipWeg);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
      <Link to="/" className="text-sm text-zegel underline underline-offset-2">
        Alle steden
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Stempelboek</h1>
      <p className="mt-2 mb-5 leading-relaxed text-inkt-zacht dark:text-papier/70">
        Eki stamps zijn gratis en staan op stations en bij attracties. Een goshuin is kalligrafie
        die ter plekke geschreven wordt en hoort in een eigen boekje.
      </p>

      {tipTonen && (
        <div className="mb-5 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-800/60 dark:bg-amber-950/40">
          <p className="text-sm leading-relaxed text-amber-950 dark:text-amber-100">
            <strong className="font-semibold">Koop eerst een goshuincho.</strong> Dat is het
            accordeonboekje waar de kalligrafie in geschreven wordt. Je koopt er een bij vrijwel
            elke grote tempel of schrijn voor ruwweg ¥1.500 tot ¥3.000. Zonder boekje krijg je een
            los vel, en dat past later nergens meer in.
          </p>
          <div className="mt-2.5">
            <Knop
              klein
              soort="stil"
              onClick={() => {
                setTipWeg(true);
                void schrijf('stempelboek.tipGetoond', true);
              }}
            >
              Begrepen
            </Knop>
          </div>
        </div>
      )}

      <div className="mb-5 grid grid-cols-3 gap-2">
        <Cijfer label="Totaal" gehaald={totaal.gehaald} totaal={totaal.totaal} />
        <Cijfer label="Eki stamps" gehaald={totaal.eki.gehaald} totaal={totaal.eki.totaal} />
        <Cijfer label="Goshuin" gehaald={totaal.goshuin.gehaald} totaal={totaal.goshuin.totaal} />
      </div>

      <div className="mb-5 flex gap-1.5 overflow-x-auto pb-2">
        <Stadknop aan={stadFilter === null} onClick={() => setStadFilter(null)}>
          alle steden
        </Stadknop>
        {STEDEN.filter((s) => (perStad.get(s.id)?.totaal ?? 0) > 0).map((s) => {
          const teller = perStad.get(s.id)!;
          return (
            <Stadknop
              key={s.id}
              aan={stadFilter === s.id}
              onClick={() => setStadFilter(stadFilter === s.id ? null : s.id)}
            >
              {s.naam}{' '}
              <span className="opacity-60">
                {teller.gehaald}/{teller.totaal}
              </span>
            </Stadknop>
          );
        })}
      </div>

      {teHalen.length === 0 ? (
        <p className="text-sm text-inkt-zacht dark:text-papier/60">
          Er staan nog geen stempels in de content. Voeg ze toe bij een plaats in{' '}
          <code>data/plaatsen/</code>.
        </p>
      ) : (
        <section className="grid gap-2">
          {zichtbaar.map((stempel) => {
            const verzameld = gehaald.find((s) => s.id === stempel.id);
            return (
              <Kaartje key={stempel.id} className="p-3.5">
                <div className="flex items-start gap-3">
                  {urls[stempel.id] ? (
                    <img
                      src={urls[stempel.id]}
                      alt={`Stempel van ${stempel.plaatsNaam}`}
                      className="h-16 w-16 shrink-0 rounded-lg border border-black/10 object-cover dark:border-white/15"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-dashed text-2xl ${
                        verzameld
                          ? 'border-zegel/40 text-zegel'
                          : 'border-black/10 text-inkt-zacht/40 dark:border-white/15'
                      }`}
                    >
                      {verzameld ? '✓' : stempel.type === 'eki' ? '🚉' : '⛩'}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-medium">{stempel.plaatsNaam}</span>
                      <Label toon={stempel.type === 'goshuin' ? 'gewoon' : 'gratis'}>
                        {stempel.type === 'eki' ? 'eki stamp, gratis' : 'goshuin'}
                      </Label>
                      {verzameld && <Label toon="eigen">gehaald op {verzameld.gehaaldOp}</Label>}
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-inkt-zacht dark:text-papier/65">
                      {stempel.waar}
                    </p>
                    {stempel.openingstijden && (
                      <p className="mt-1 text-xs text-inkt-zacht dark:text-papier/50">
                        Stempelkantoor open {stempel.openingstijden}
                        {stempel.type === 'goshuin' && ', vaak korter dan de tempel zelf'}
                      </p>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <Knop
                        klein
                        soort={verzameld ? 'gewoon' : 'nadruk'}
                        aria-pressed={Boolean(verzameld)}
                        onClick={() => void wisselen(stempel)}
                      >
                        {verzameld ? 'Gehaald' : 'Afvinken'}
                      </Knop>
                      <label className="cursor-pointer text-xs text-zegel underline underline-offset-2">
                        {bezig === stempel.id
                          ? 'bezig'
                          : urls[stempel.id]
                            ? 'andere foto'
                            : 'foto of scan toevoegen'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const bestand = e.target.files?.[0];
                            if (bestand) void voegAfbeeldingToe(stempel, bestand);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <Link
                        to={`/stad/${stempel.stadId}`}
                        className="text-xs text-zegel underline underline-offset-2"
                      >
                        {stadMet(stempel.stadId)?.naam ?? stempel.stadId}
                      </Link>
                    </div>
                  </div>
                </div>
              </Kaartje>
            );
          })}
        </section>
      )}
    </div>
  );
};

const Cijfer = ({ label, gehaald, totaal }: { label: string; gehaald: number; totaal: number }) => (
  <Kaartje className="p-3 text-center">
    <p className="text-2xl font-semibold tabular-nums">
      {gehaald}
      <span className="text-base font-normal text-inkt-zacht dark:text-papier/50">/{totaal}</span>
    </p>
    <p className="mt-0.5 text-xs text-inkt-zacht dark:text-papier/55">{label}</p>
  </Kaartje>
);

const Stadknop = ({
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
    className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
      aan
        ? 'border-zegel bg-zegel text-white'
        : 'border-black/10 bg-white/70 dark:border-white/15 dark:bg-nacht-diep/70'
    }`}
  >
    {children}
  </button>
);
