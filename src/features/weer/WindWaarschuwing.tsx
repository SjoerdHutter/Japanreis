import { Wind } from 'lucide-react';
import { stadMet } from '@/data/content';
import { windNiveau } from '@/domein/weer/verwachting';
import { alsKorteDatum } from '@/domein/tijd/datums';
import { useApp } from '@/state/useApp';
import { weerVan } from './WeerRegel';

/**
 * Een balk bij harde wind. Vanaf 60 km/h waait het stevig genoeg om een
 * kabelbaan of een boot naar Miyajima stil te leggen; vanaf 90 km/h is het
 * stormweer en in oktober vaak de rand van een tyfoon. Dan vallen treinen uit,
 * vaak al de dag ervoor aangekondigd.
 */
export const WindWaarschuwing = ({ dagen }: { dagen: { stadId: string; datum: string }[] }) => {
  const { weer } = useApp();
  const meldingen = dagen
    .map(({ stadId, datum }) => {
      const dag = weerVan(weer, stadId, datum);
      const niveau = windNiveau(dag);
      return niveau && dag
        ? { stadId, datum, niveau, stoten: Math.round(dag.windstoten ?? 0) }
        : null;
    })
    .filter((m) => m !== null);

  if (meldingen.length === 0) return null;
  return (
    <div className="grid gap-2">
      {meldingen.map((m) => {
        const plek = `${stadMet(m.stadId)?.naam ?? m.stadId} op ${alsKorteDatum(m.datum)}`;
        return (
          <p
            key={`${m.stadId}-${m.datum}`}
            role="alert"
            className={`flex gap-2.5 rounded-xl p-3 text-sm leading-relaxed ${
              m.niveau === 'storm'
                ? 'bg-red-100 font-medium text-red-950 dark:bg-red-950/60 dark:text-red-100'
                : 'bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100'
            }`}
          >
            <Wind className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {m.niveau === 'storm'
                ? `Stormachtige windstoten tot ${m.stoten} km/h in ${plek}. Kijk het tyfoonnieuws na (JMA, NHK World) en of je trein rijdt; treinen worden vaak een dag vooraf stilgelegd.`
                : `Harde windstoten tot ${m.stoten} km/h in ${plek}. Kabelbanen en boten kunnen stilliggen.`}
            </span>
          </p>
        );
      })}
    </div>
  );
};
