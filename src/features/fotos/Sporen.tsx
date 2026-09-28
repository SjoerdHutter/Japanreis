import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { importeerGpx, verwijderSpoor, werkSpoorBij } from '@/data/sporen';
import { SPOORKLEUREN, alsAfstand, alsDuur } from '@/domein/sporen/spoor';
import { alsKorteDatum } from '@/domein/tijd/datums';
import type { OpgeslagenSpoor } from '@/domein/schema';
import { Kaartje, Knop, Sectiekop } from '@/ui/basis';
import { Invoer, Veld } from '@/ui/formulier';

/**
 * Gelopen routes: GPX-bestanden inlezen en per dag laten zien.
 *
 * Een GPX exporteer je uit Strava, Komoot, je horloge of een app als Open GPX
 * Tracker. Op een iPhone kies je het bestand in Bestanden; bewaar het daar
 * eerst vanuit de app die het maakte.
 */
export const GpxInvoer = () => {
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<{ fouten: string[]; aantal: number } | null>(null);

  const lees = async (bestanden: File[]) => {
    setBezig(true);
    setMelding(null);
    const uitkomst = await importeerGpx(bestanden);
    setMelding({ fouten: uitkomst.fouten, aantal: uitkomst.toegevoegd.length });
    setBezig(false);
  };

  return (
    <Kaartje className="mb-5 p-4">
      <label className="mb-1.5 block text-sm font-medium" htmlFor="gpx">
        Gelopen routes (GPX)
      </label>
      {/* Geen accept: iOS kent .gpx niet als type en grijst het bestand dan uit. */}
      <input
        id="gpx"
        type="file"
        multiple
        disabled={bezig}
        onChange={(e) => {
          const bestanden = e.target.files;
          if (bestanden && bestanden.length > 0) void lees([...bestanden]);
          e.target.value = '';
        }}
        className="w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-papier-diep file:px-3 file:py-1.5 file:text-sm dark:file:bg-nacht-diep dark:file:text-papier"
      />
      {bezig ? (
        <p className="mt-2 text-sm text-inkt-zacht dark:text-papier/60">Bezig met inlezen</p>
      ) : (
        <p className="mt-2 text-xs text-inkt-zacht dark:text-papier/50">
          Uit Strava, Komoot of je horloge. De route komt vanzelf bij de dag waarop je hem liep, en
          blijft op dit toestel.
        </p>
      )}
      {melding && melding.aantal > 0 && (
        <p className="mt-2 text-sm" role="status">
          {melding.aantal === 1 ? 'Eén route' : `${melding.aantal} routes`} ingelezen.
        </p>
      )}
      {melding?.fouten.map((fout) => (
        <p key={fout} className="mt-2 text-sm text-zegel">
          {fout}
        </p>
      ))}
    </Kaartje>
  );
};

export const SporenLijst = ({
  sporen,
  verborgen,
  onWissel,
}: {
  sporen: OpgeslagenSpoor[];
  /** Dagen waarvan de routes niet op de kaart staan. */
  verborgen: ReadonlySet<string>;
  onWissel: (dag: string) => void;
}) => {
  // Hier en niet in de regel zelf: kies je een andere dag, dan verhuist de
  // regel naar een andere groep en zou hij anders dichtklappen.
  const [open, setOpen] = useState<string | null>(null);
  if (sporen.length === 0) return null;
  const perDag = new Map<string, OpgeslagenSpoor[]>();
  for (const spoor of sporen) {
    const dag = spoor.datum ?? '';
    perDag.set(dag, [...(perDag.get(dag) ?? []), spoor]);
  }

  return (
    <section className="mb-6">
      <Sectiekop
        extra={
          <span className="text-xs text-inkt-zacht dark:text-papier/50">
            {alsAfstand(sporen.reduce((som, s) => som + s.statistiek.afstandM, 0))} in totaal
          </span>
        }
      >
        Gelopen routes
      </Sectiekop>
      <div className="grid gap-4">
        {[...perDag].map(([dag, vandaag]) => (
          <div key={dag || 'zonder'}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{dag ? alsKorteDatum(dag) : 'Nog zonder dag'}</p>
              <label className="flex items-center gap-1.5 text-sm text-inkt-zacht dark:text-papier/65">
                <input
                  type="checkbox"
                  checked={!verborgen.has(dag)}
                  onChange={() => onWissel(dag)}
                />
                op de kaart
              </label>
            </div>
            <ul className="grid gap-2">
              {vandaag.map((spoor) => (
                <SpoorRegel
                  key={spoor.id}
                  spoor={spoor}
                  bewerken={open === spoor.id}
                  onBewerken={() => setOpen(open === spoor.id ? null : spoor.id)}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
};

const SpoorRegel = ({
  spoor,
  bewerken,
  onBewerken,
}: {
  spoor: OpgeslagenSpoor;
  bewerken: boolean;
  onBewerken: () => void;
}) => {
  const [naam, setNaam] = useState(spoor.naam);
  const [datum, setDatum] = useState(spoor.datum ?? '');
  const [weg, setWeg] = useState(false);
  const s = spoor.statistiek;

  const bewaar = async (wijziging: Partial<OpgeslagenSpoor>) => {
    const nieuw = { ...spoor, ...wijziging };
    if (!nieuw.datum) delete nieuw.datum;
    await werkSpoorBij(nieuw);
  };

  return (
    <li>
      <Kaartje className="p-3.5">
        <div className="flex items-start gap-3">
          <span
            className="mt-1 size-3.5 shrink-0 rounded-full"
            style={{ background: spoor.kleur }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium break-words">{spoor.naam}</p>
            <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-sm">
              <Cijfer label="Afstand" waarde={alsAfstand(s.afstandM)} />
              <Cijfer
                label="Klimmen"
                waarde={s.stijgingM !== undefined ? `${s.stijgingM} m` : 'geen hoogte'}
              />
              <Cijfer
                label="In beweging"
                waarde={s.bewegingS !== undefined ? alsDuur(s.bewegingS) : 'geen tijden'}
              />
              <Cijfer
                label="Datum"
                waarde={spoor.datum ? alsKorteDatum(spoor.datum) : 'nog geen dag'}
              />
            </dl>
          </div>
          <button
            type="button"
            onClick={onBewerken}
            aria-expanded={bewerken}
            aria-label={`${spoor.naam} aanpassen`}
            className="rounded-full p-1.5 text-inkt-zacht hover:bg-papier-diep dark:text-papier/60 dark:hover:bg-nacht"
          >
            <Pencil className="size-4" aria-hidden />
          </button>
        </div>

        {bewerken && (
          <div className="mt-3 grid gap-3 border-t border-black/5 pt-3 dark:border-white/10">
            <Veld label="Naam">
              <Invoer
                value={naam}
                maxLength={120}
                onChange={(e) => setNaam(e.target.value)}
                onBlur={() => {
                  const schoon = naam.trim();
                  if (schoon && schoon !== spoor.naam) void bewaar({ naam: schoon });
                  else setNaam(spoor.naam);
                }}
              />
            </Veld>
            <Veld
              label="Dag"
              uitleg="Liep je na middernacht nog, dan hoort de route misschien bij de dag ervoor."
            >
              <Invoer
                type="date"
                value={datum}
                onChange={(e) => {
                  setDatum(e.target.value);
                  void bewaar({ datum: e.target.value || undefined });
                }}
              />
            </Veld>
            <div>
              <p className="mb-1.5 text-sm font-medium">Kleur</p>
              <div className="flex flex-wrap gap-2">
                {SPOORKLEUREN.map((kleur) => (
                  <button
                    key={kleur}
                    type="button"
                    onClick={() => void bewaar({ kleur })}
                    aria-label={`kleur ${kleur}`}
                    aria-pressed={spoor.kleur === kleur}
                    className={`size-8 rounded-full border-2 ${
                      spoor.kleur === kleur
                        ? 'border-inkt dark:border-papier'
                        : 'border-transparent'
                    }`}
                    style={{ background: kleur }}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {weg ? (
                <>
                  <span className="text-sm">Deze route verwijderen?</span>
                  <Knop klein soort="nadruk" onClick={() => void verwijderSpoor(spoor.id)}>
                    Ja, verwijder
                  </Knop>
                  <Knop klein soort="stil" onClick={() => setWeg(false)}>
                    Nee
                  </Knop>
                </>
              ) : (
                <Knop klein soort="stil" onClick={() => setWeg(true)}>
                  <Trash2 className="size-4" aria-hidden />
                  Verwijder deze route
                </Knop>
              )}
            </div>
          </div>
        )}
      </Kaartje>
    </li>
  );
};

const Cijfer = ({ label, waarde }: { label: string; waarde: string }) => (
  <div className="min-w-0">
    <dt className="text-xs text-inkt-zacht dark:text-papier/55">{label}</dt>
    <dd className="tabular-nums">{waarde}</dd>
  </div>
);
