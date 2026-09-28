import { REISDAGEN, REISSCHEMA, STEDEN } from '@/data/content';
import { vandaagOpReis } from '@/domein/highlight/vandaag';
import { dagenVanDeReis } from '@/domein/reizen/dagen';
import { Sectiekop } from '@/ui/basis';
import { VerblijfKaart } from './VerblijfKaart';
import { VerhuisHerinnering } from './VerhuisHerinnering';

/**
 * In het hoofdmenu, tijdens de reis: waar je vannacht slaapt, en of je morgen
 * verkast. Voor en na de reis staat hier niets.
 */
export const VerblijfVandaag = () => {
  const vandaag = vandaagOpReis(STEDEN, REISSCHEMA);
  const dag = dagenVanDeReis(REISSCHEMA, REISDAGEN).find((d) => d.datum === vandaag);
  if (!dag) return null;
  return (
    <section className="mb-6 grid gap-2">
      <Sectiekop>Vannacht</Sectiekop>
      <VerblijfKaart datum={dag.datum} nachtStadId={dag.nachtStadId} />
      <VerhuisHerinnering datum={dag.datum} />
    </section>
  );
};
