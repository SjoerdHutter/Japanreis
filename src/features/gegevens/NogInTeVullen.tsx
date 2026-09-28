import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, ChevronRight, ShieldUser } from 'lucide-react';
import { REISSCHEMA, STEDEN } from '@/data/content';
import { leesReserveringen, type Reservering } from '@/data/db/idb';
import { useOpslag } from '@/data/db/useOpslag';
import { watOntbreekt, type Ontbrekend } from '@/domein/gegevens/compleet';
import { Kaartje, Sectiekop } from '@/ui/basis';
import { useMijnGegevens } from './gedeeld';

/**
 * "Nog in te vullen": wat je onderweg mist als het er niet staat.
 *
 * Elke regel brengt je in één tik naar het juiste formulier. De reserveringen
 * die nog geregeld moeten worden blijven hun eigen lijst in de dagplanner; hier
 * staat alleen hoeveel het er zijn, met een link erheen. Is alles ingevuld, dan
 * blijft er één regel over naar Mijn gegevens.
 */

const MAX_REGELS = 5;

export const linkNaar = (item: Ontbrekend): string => {
  const params = new URLSearchParams({ sectie: item.sectie });
  if (item.doelId) params.set('id', item.doelId);
  if (item.nieuw) {
    params.set('stad', item.nieuw.stadId);
    params.set('van', item.nieuw.van);
    params.set('tot', item.nieuw.tot);
  }
  return `/gegevens?${params.toString()}`;
};

/**
 * `metKop` is voor het hoofdmenu: met een link naar Mijn gegevens, en met een
 * regel als alles is ingevuld. Op Mijn gegevens zelf is die regel overbodig.
 */
export const NogInTeVullen = ({ metKop = true }: { metKop?: boolean }) => {
  const { gegevens, geladen } = useMijnGegevens();
  const { waarde: reserveringen } = useOpslag(leesReserveringen, [] as Reservering[], [
    'reserveringen',
  ]);
  const ontbrekend = useMemo(() => watOntbreekt(gegevens, REISSCHEMA, STEDEN), [gegevens]);
  const teRegelen = reserveringen.filter((r) => r.status === 'te-regelen').length;

  if (!geladen) return null;

  if (ontbrekend.length === 0 && teRegelen === 0) {
    if (!metKop) return null;
    return (
      <section className="mb-6">
        <Link to="/gegevens" className="block">
          <Kaartje className="flex items-center gap-3 p-3.5 transition hover:bg-white dark:hover:bg-nacht-diep">
            <ShieldUser className="size-5 shrink-0 text-zegel dark:text-zegel-licht" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Mijn gegevens</span>
              <span className="block text-sm text-inkt-zacht dark:text-papier/60">
                Verzekering, vluchten en verblijven staan erin.
              </span>
            </span>
            <CircleCheck className="size-5 shrink-0 text-emerald-600" aria-hidden />
          </Kaartje>
        </Link>
      </section>
    );
  }

  const zichtbaar = ontbrekend.slice(0, MAX_REGELS);
  const meer = ontbrekend.length - zichtbaar.length;

  return (
    <section className="mb-6">
      <Sectiekop
        extra={
          metKop ? (
            <Link
              to="/gegevens"
              className="text-xs font-medium text-zegel underline underline-offset-2 dark:text-zegel-licht"
            >
              mijn gegevens
            </Link>
          ) : null
        }
      >
        Nog in te vullen
      </Sectiekop>
      <Kaartje className="overflow-hidden">
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {zichtbaar.map((item) => (
            <li key={item.id}>
              <Link
                to={linkNaar(item)}
                className="flex min-h-11 items-center gap-2 px-3.5 py-2.5 text-sm transition hover:bg-white dark:hover:bg-nacht-diep"
              >
                <span className="min-w-0 flex-1">{item.tekst}</span>
                <ChevronRight className="size-4 shrink-0 text-inkt-zacht" aria-hidden />
              </Link>
            </li>
          ))}
          {meer > 0 && (
            <li>
              <Link
                to="/gegevens"
                className="block px-3.5 py-2.5 text-sm text-inkt-zacht dark:text-papier/60"
              >
                en nog {meer}
              </Link>
            </li>
          )}
          {teRegelen > 0 && (
            <li>
              <Link
                to="/dagplanner?sectie=reserveringen"
                className="flex min-h-11 items-center gap-2 px-3.5 py-2.5 text-sm transition hover:bg-white dark:hover:bg-nacht-diep"
              >
                <span className="min-w-0 flex-1">
                  {teRegelen} {teRegelen === 1 ? 'reservering' : 'reserveringen'} nog te regelen
                </span>
                <ChevronRight className="size-4 shrink-0 text-inkt-zacht" aria-hidden />
              </Link>
            </li>
          )}
        </ul>
      </Kaartje>
    </section>
  );
};
