import type { Dagdeel, Stad } from '@/domein/schema';
import type { Filter, Keuzes } from '@/domein/filters/plaatsen';
import { PRIJSKLASSEN, formatteerPrijsklasse } from '@/domein/valuta/formatteer';
import { useApp } from '@/state/useApp';

/**
 * De filterbalk boven de lijst.
 *
 * Alleen knoppen die in deze stad iets opleveren; een keuze voor kaiseki in
 * Hanoi laat je zoeken naar iets dat er niet is. De knoppen staan als rijtjes
 * chips onder elkaar in plaats van in uitklapmenu's, omdat je hier met één hand
 * en een halve blik op je telefoon doorheen moet kunnen.
 */

const Chip = ({
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
    className={`rounded-full border px-3 py-1.5 text-sm transition ${
      aan
        ? 'border-zegel bg-zegel text-white'
        : 'border-black/10 bg-white/70 text-inkt hover:bg-white dark:border-white/15 dark:bg-nacht-diep/70 dark:text-papier'
    }`}
  >
    {children}
  </button>
);

const Rij = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center gap-1.5">
    <span className="mr-1 w-full text-xs font-medium tracking-wide text-inkt-zacht uppercase sm:w-auto dark:text-papier/55">
      {label}
    </span>
    {children}
  </div>
);

/** Zet een waarde in of uit een lijst, zonder de rest aan te raken. */
const wissel = <T,>(lijst: T[] | undefined, waarde: T): T[] => {
  const huidig = lijst ?? [];
  return huidig.includes(waarde) ? huidig.filter((v) => v !== waarde) : [...huidig, waarde];
};

const DAGDEEL_LABEL: Record<Dagdeel, string> = {
  ochtend: 'ochtend',
  middag: 'middag',
  avond: 'avond',
  nacht: 'nacht',
};

const DUUR_STAPPEN = [30, 60, 120] as const;

export const Filterbalk = ({
  tab,
  filter,
  keuzes,
  stad,
  onWijzig,
  onWisAlles,
  aantal,
  totaal,
}: {
  tab: 'attracties' | 'eten' | 'stempels' | 'eigen';
  filter: Filter;
  keuzes: Keuzes;
  stad: Stad;
  onWijzig: (nieuw: Filter) => void;
  /** Wist ook het tijdvak uit de link, dat niet in `filter` thuishoort. */
  onWisAlles: () => void;
  aantal: number;
  totaal: number;
}) => {
  const { koersen, positie, locatieStatus, vraagLocatie } = useApp();
  const zet = (deel: Partial<Filter>) => onWijzig({ ...filter, ...deel });

  const prijsklassen = stad.valuta === 'VND' ? PRIJSKLASSEN.VND : PRIJSKLASSEN.JPY;

  return (
    <div className="mb-4 grid gap-3 rounded-2xl border border-black/5 bg-white/60 p-3.5 dark:border-white/10 dark:bg-nacht-diep/60">
      <input
        type="search"
        value={filter.zoek ?? ''}
        onChange={(e) => zet({ zoek: e.target.value })}
        placeholder={`Zoeken in ${stad.naam}`}
        className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 dark:border-white/15 dark:bg-nacht"
      />

      {tab === 'attracties' && (
        <>
          {keuzes.typen.length > 1 && (
            <Rij label="Type">
              {keuzes.typen.map((type) => (
                <Chip
                  key={type}
                  aan={filter.typen?.includes(type) ?? false}
                  onClick={() => zet({ typen: wissel(filter.typen, type) })}
                >
                  {type}
                </Chip>
              ))}
            </Rij>
          )}

          <Rij label="Hoogstens">
            {DUUR_STAPPEN.map((minuten) => (
              <Chip
                key={minuten}
                aan={filter.maxBezoekduur === minuten}
                onClick={() =>
                  zet({ maxBezoekduur: filter.maxBezoekduur === minuten ? undefined : minuten })
                }
              >
                {minuten} min
              </Chip>
            ))}
          </Rij>

          {(keuzes.dagdelen.length > 0 || keuzes.heeftRegenbestendig) && (
            <Rij label="Wanneer">
              {keuzes.dagdelen.map((dagdeel) => (
                <Chip
                  key={dagdeel}
                  aan={filter.dagdelen?.includes(dagdeel) ?? false}
                  onClick={() => zet({ dagdelen: wissel(filter.dagdelen, dagdeel) })}
                >
                  {DAGDEEL_LABEL[dagdeel]}
                </Chip>
              ))}
              {keuzes.heeftRegenbestendig && (
                <Chip
                  aan={filter.regenbestendig === true}
                  onClick={() => zet({ regenbestendig: filter.regenbestendig ? undefined : true })}
                >
                  bij regen
                </Chip>
              )}
            </Rij>
          )}
        </>
      )}

      {tab === 'eten' && (
        <>
          {keuzes.keukens.length > 1 && (
            <Rij label="Keuken">
              {keuzes.keukens.map((keuken) => (
                <Chip
                  key={keuken}
                  aan={filter.keukens?.includes(keuken) ?? false}
                  onClick={() => zet({ keukens: wissel(filter.keukens, keuken) })}
                >
                  {keuken.replace('-', ' en ')}
                </Chip>
              ))}
            </Rij>
          )}

          <Rij label="Prijs">
            {prijsklassen.map((klasse) => (
              <Chip
                key={klasse.id}
                aan={filter.prijsklassen?.includes(klasse.id) ?? false}
                onClick={() => zet({ prijsklassen: wissel(filter.prijsklassen, klasse.id) })}
              >
                {formatteerPrijsklasse(klasse, koersen)}
              </Chip>
            ))}
          </Rij>

          <Rij label="Soort">
            {keuzes.heeftOntbijt && (
              <Chip
                aan={filter.ontbijt === true}
                onClick={() => zet({ ontbijt: filter.ontbijt ? undefined : true })}
              >
                ontbijt
              </Chip>
            )}
            {keuzes.heeftLateNight && (
              <Chip
                aan={filter.lateNight === true}
                onClick={() => zet({ lateNight: filter.lateNight ? undefined : true })}
              >
                late night
              </Chip>
            )}
            <Chip
              aan={filter.moeite === 'waardig-een-omweg'}
              onClick={() =>
                zet({
                  moeite: filter.moeite === 'waardig-een-omweg' ? undefined : 'waardig-een-omweg',
                })
              }
            >
              een omweg waard
            </Chip>
            <Chip
              aan={filter.moeite === 'snelle-bak'}
              onClick={() =>
                zet({ moeite: filter.moeite === 'snelle-bak' ? undefined : 'snelle-bak' })
              }
            >
              snelle bak
            </Chip>
            {keuzes.heeftReservering && (
              <Chip
                aan={filter.reserveringVerplicht === true}
                onClick={() =>
                  zet({ reserveringVerplicht: filter.reserveringVerplicht ? undefined : true })
                }
              >
                reserveren verplicht
              </Chip>
            )}
          </Rij>
        </>
      )}

      {(tab === 'attracties' || tab === 'eten') && (
        <Rij label="Nu">
          <Chip
            aan={filter.nuOpen === true}
            onClick={() => zet({ nuOpen: filter.nuOpen ? undefined : true })}
          >
            nu open
          </Chip>
          <Chip
            aan={filter.verbergVandaagGesloten === true}
            onClick={() =>
              zet({ verbergVandaagGesloten: filter.verbergVandaagGesloten ? undefined : true })
            }
          >
            niet vandaag gesloten
          </Chip>
          {keuzes.heeftGratis && tab === 'attracties' && (
            <Chip
              aan={filter.gratis === true}
              onClick={() => zet({ gratis: filter.gratis ? undefined : true })}
            >
              gratis
            </Chip>
          )}
        </Rij>
      )}

      {/* Het afstandsfilter heeft een vertrekpunt nodig. Zonder locatie is een
          looptijd betekenisloos, dus dan staat er een knop om die aan te zetten
          in plaats van een filter dat stilletjes niets doet. */}
      <Rij label="Lopen">
        {positie ? (
          [5, 10, 20].map((minuten) => (
            <Chip
              key={minuten}
              aan={filter.maxLooptijd === minuten}
              onClick={() =>
                zet({
                  maxLooptijd: filter.maxLooptijd === minuten ? undefined : minuten,
                  vanaf: positie,
                })
              }
            >
              binnen {minuten} min
            </Chip>
          ))
        ) : locatieStatus === 'geweigerd' ? (
          <span className="text-sm text-inkt-zacht dark:text-papier/55">
            Locatie staat uit, dus afstand valt niet te bepalen.
          </span>
        ) : (
          <button
            type="button"
            onClick={vraagLocatie}
            className="text-sm text-zegel underline underline-offset-2"
          >
            zet je locatie aan om op looptijd te filteren
          </button>
        )}
      </Rij>

      <div className="flex items-center justify-between gap-3 border-t border-black/5 pt-2.5 text-sm dark:border-white/10">
        <span className="text-inkt-zacht dark:text-papier/60">
          {aantal === totaal ? `${totaal} punten` : `${aantal} van ${totaal}`}
        </span>
        {aantal !== totaal && (
          <button
            type="button"
            onClick={onWisAlles}
            className="text-zegel underline underline-offset-2"
          >
            filters wissen
          </button>
        )}
      </div>
    </div>
  );
};
