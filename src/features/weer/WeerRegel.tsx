import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { stadMet } from '@/data/content';
import {
  WEERSOORT_TEKST,
  binnenHorizon,
  isVers,
  weersoort,
  windNiveau,
  type Dagweer,
  type Weersoort,
} from '@/domein/weer/verwachting';
import { datumIn } from '@/domein/tijd/zones';
import { useApp } from '@/state/useApp';

/**
 * Eén regel weer voor een dag in een stad: icoon, temperatuur, regenkans.
 *
 * Kort genoeg om bij elke dag te staan. Zonder bereik staat erbij wanneer de
 * verwachting is opgehaald, want een verwachting van gisteravond is nog
 * bruikbaar zolang je weet dat hij van gisteravond is.
 */

const ICOON: Record<Weersoort, LucideIcon> = {
  zon: Sun,
  half: CloudSun,
  bewolkt: Cloud,
  mist: CloudFog,
  motregen: CloudDrizzle,
  regen: CloudRain,
  sneeuw: CloudSnow,
  onweer: CloudLightning,
};

const rond = (n: number | null) => (n === null ? '?' : String(Math.round(n)));

export const alsBijgewerkt = (moment: string): string =>
  new Date(moment).toLocaleString('nl-NL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export const weerVan = (
  weer: ReturnType<typeof useApp>['weer'],
  stadId: string,
  datum: string,
): Dagweer | undefined => weer[stadId]?.dagen.find((d) => d.datum === datum);

export const WeerRegel = ({
  stadId,
  datum,
  metStad = false,
}: {
  stadId: string;
  datum: string;
  /** Zet de naam van de stad ervoor, voor een dag met twee steden. */
  metStad?: boolean;
}) => {
  const { weer, online } = useApp();
  const stad = stadMet(stadId);
  const cache = weer[stadId];
  const dag = weerVan(weer, stadId, datum);
  const voorvoegsel = metStad && stad ? `${stad.naam}: ` : '';

  if (!dag) {
    if (!stad) return null;
    const nu = new Date();
    if (!binnenHorizon(datum, stad, nu)) {
      return (
        <p className="text-sm text-inkt-zacht dark:text-papier/55">
          {voorvoegsel}nog geen verwachting
        </p>
      );
    }
    if (datum < datumIn(stad.tijdzone, nu)) return null;
    return (
      <p className="text-sm text-inkt-zacht dark:text-papier/55">
        {voorvoegsel}
        {online ? 'verwachting nog niet binnen' : 'nog geen verwachting opgehaald, geen bereik'}
      </p>
    );
  }

  const soort = weersoort(dag.code);
  const Icoon = ICOON[soort];
  const wind = windNiveau(dag);
  const oud = !online || !isVers(cache?.opgehaaldOp, new Date());

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
      <Icoon className="size-5 shrink-0 text-indigo-reis dark:text-papier/70" aria-hidden />
      <span className="sr-only">{WEERSOORT_TEKST[soort]}, </span>
      <span>
        {voorvoegsel}
        <span className="tabular-nums">
          {rond(dag.min)} tot {rond(dag.max)} °C
        </span>
        {dag.regenkans !== null && (
          <span className="text-inkt-zacht dark:text-papier/65">
            , {rond(dag.regenkans)}% kans op regen
            {(dag.regenMm ?? 0) >= 1 && `, ${rond(dag.regenMm)} mm`}
          </span>
        )}
      </span>
      {wind && (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            wind === 'storm'
              ? 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'
              : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
          }`}
        >
          <Wind className="size-3.5" aria-hidden />
          windstoten {rond(dag.windstoten)} km/h
        </span>
      )}
      {oud && cache && (
        <span className="w-full text-xs text-inkt-zacht dark:text-papier/50">
          laatst bijgewerkt {alsBijgewerkt(cache.opgehaaldOp)}
        </span>
      )}
    </p>
  );
};
