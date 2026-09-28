import { REISDAGEN, REISSCHEMA, STEDEN } from '@/data/content';
import { vandaagOpReis } from '@/domein/highlight/vandaag';
import { dagenVanDeReis } from '@/domein/reizen/dagen';
import { plusDagen } from '@/domein/tijd/datums';
import { WindWaarschuwing } from './WindWaarschuwing';

/**
 * In het hoofdmenu: een windwaarschuwing voor vandaag en morgen, als die er is.
 * Morgen ook, want treinen worden bij een tyfoon vaak de dag ervoor al
 * stilgelegd, en dan wil je het vanavond weten.
 */
export const WindVandaag = () => {
  const vandaag = vandaagOpReis(STEDEN, REISSCHEMA);
  const morgen = plusDagen(vandaag, 1);
  const dagen = dagenVanDeReis(REISSCHEMA, REISDAGEN)
    .filter((d) => d.datum === vandaag || d.datum === morgen)
    .flatMap((d) => d.steden.map((stadId) => ({ stadId, datum: d.datum })));
  if (dagen.length === 0) return null;
  return (
    <div className="mb-6 empty:hidden">
      <WindWaarschuwing dagen={dagen} />
    </div>
  );
};
