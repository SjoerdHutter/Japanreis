import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { REISDAGEN, REISSCHEMA, STEDEN } from '@/data/content';
import { vandaagOpReis } from '@/domein/highlight/vandaag';
import { dagenVanDeReis, reisdagenZonderDatum } from '@/domein/reizen/dagen';
import { Sectiekop, Terug } from '@/ui/basis';
import { DagKaart } from './DagKaart';
import { ReisdagKaart } from './ReisdagKaart';

/**
 * De reis dag voor dag, van de heenreis tot de terugreis.
 *
 * Eerst stonden hier alleen de dagen dat je verkast. Nu heeft elke dag een
 * kaart: waar je bent, het weer, de trein als je die dag reist. Vandaag heeft
 * een rand en staat in beeld zodra je het scherm opent.
 *
 * De link uit het hoofdmenu (`?dag=` met een reisdag) en een link naar een
 * datum (`?datum=`) scrollen allebei naar de goede plek.
 */
export const ReisdagenScherm = () => {
  const [zoekparams] = useSearchParams();
  const gekozenReisdag = zoekparams.get('dag');
  const gekozenDatum = zoekparams.get('datum');
  const vandaag = vandaagOpReis(STEDEN, REISSCHEMA);
  const dagen = useMemo(() => dagenVanDeReis(REISSCHEMA, REISDAGEN), []);
  const zonderDatum = reisdagenZonderDatum(REISDAGEN);

  useEffect(() => {
    const doel = gekozenReisdag ? `reisdag-${gekozenReisdag}` : `dag-${gekozenDatum ?? vandaag}`;
    document.getElementById(doel)?.scrollIntoView({ block: 'start' });
  }, [gekozenReisdag, gekozenDatum, vandaag]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
      <Terug naar="/meer" />
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Reisdagen</h1>
      <p className="mt-2 mb-5 leading-relaxed text-inkt-zacht dark:text-papier/70">
        De reis dag voor dag: waar je bent, het weer, en welke trein of bus als je verkast. De
        vertrektijden en perrons staan op de borden en in Google Maps. Je notitie per dag komt in
        het{' '}
        <Link to="/fotos" className="text-zegel underline underline-offset-2 dark:text-zegel-licht">
          reisverslag
        </Link>
        .
      </p>

      <div className="grid gap-3">
        {dagen.map((dag) => (
          <div key={dag.datum} id={`dag-${dag.datum}`} className="scroll-mt-4">
            <DagKaart dag={dag} vandaag={dag.datum === vandaag} gekozenReisdag={gekozenReisdag} />
          </div>
        ))}
      </div>

      {zonderDatum.length > 0 && (
        <section className="mt-8">
          <Sectiekop>Nog zonder datum</Sectiekop>
          <div className="grid gap-3">
            {zonderDatum.map((reisdag) => (
              <div key={reisdag.id} id={`reisdag-${reisdag.id}`} className="scroll-mt-4">
                <ReisdagKaart reisdag={reisdag} gemarkeerd={reisdag.id === gekozenReisdag} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
