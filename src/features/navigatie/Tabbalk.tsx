import { Link, useLocation } from 'react-router-dom';
import {
  CalendarDays,
  Languages,
  LayoutGrid,
  MapPinned,
  Siren,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/**
 * De balk onderaan elk scherm.
 *
 * Vier dingen die je onderweg steeds opnieuw nodig hebt, en de rest onder Meer.
 * Eerst was er alleen de link "Alle steden" bovenaan elk scherm, en stonden de
 * hulpmiddelen onderaan het hoofdmenu: van het budget naar een zin in het
 * Japans was drie keer tikken en een keer flink scrollen.
 *
 * De balk ligt boven de kaart. Leaflet geeft zijn lagen een z-index tot 1000,
 * dus daar moet deze overheen.
 */

interface Tab {
  pad: string;
  naam: string;
  icoon: LucideIcon;
  /** Bij welke adressen deze tab oplicht. */
  hoortBij: (pad: string) => boolean;
  rood?: boolean;
}

const bij =
  (...begin: string[]) =>
  (pad: string) =>
    begin.some((b) => pad === b || pad.startsWith(`${b}/`));

const TABS: Tab[] = [
  {
    pad: '/',
    naam: 'Steden',
    icoon: MapPinned,
    hoortBij: (pad) => pad === '/' || bij('/stad', '/tijdlijn', '/geschiedenis')(pad),
  },
  { pad: '/dagplanner', naam: 'Plannen', icoon: CalendarDays, hoortBij: bij('/dagplanner') },
  { pad: '/budget', naam: 'Budget', icoon: Wallet, hoortBij: bij('/budget') },
  { pad: '/context', naam: 'Taal', icoon: Languages, hoortBij: bij('/context') },
  // Nood staat in de balk en niet onder Meer: in een noodgeval wil je niet
  // zoeken. Het icoon is altijd rood, ook als de tab niet actief is.
  { pad: '/nood', naam: 'Nood', icoon: Siren, hoortBij: bij('/nood'), rood: true },
];

const MEER: Tab = {
  pad: '/meer',
  naam: 'Meer',
  icoon: LayoutGrid,
  // Alles wat geen eigen tab heeft, valt onder Meer.
  hoortBij: (pad) => !TABS.some((t) => t.hoortBij(pad)),
};

export const Tabbalk = () => {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Hoofdmenu"
      className="fixed inset-x-0 bottom-0 z-[1100] border-t border-black/10 bg-papier/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-white/10 dark:bg-nacht/95"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-6">
        {[...TABS, MEER].map(({ pad, naam, icoon: Icoon, hoortBij, rood }) => {
          const actief = hoortBij(pathname);
          return (
            <li key={pad} className="min-w-0">
              <Link
                to={pad}
                aria-current={actief ? 'page' : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition ${
                  rood
                    ? 'text-red-700 dark:text-red-400'
                    : actief
                      ? 'text-zegel dark:text-zegel-licht'
                      : 'text-inkt-zacht hover:text-inkt dark:text-papier/55 dark:hover:text-papier'
                }`}
              >
                <Icoon className="size-[22px]" strokeWidth={actief ? 2.25 : 1.75} aria-hidden />
                {naam}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
