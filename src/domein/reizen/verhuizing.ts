import type { Accommodatie } from '@/domein/schema';
import { verblijfVanNacht } from '@/domein/gegevens/orden';
import { plusDagen } from '@/domein/tijd/datums';
import type { Reisdagkaart } from './dagen';

/**
 * Verkas je morgen? Dan is vandaag de dag om je koffer vooruit te sturen.
 *
 * Takkyubin brengt een koffer in een dag van hotel naar hotel, maar alleen als
 * je hem de dag ervoor afgeeft, met het adres van het volgende hotel erbij. Een
 * verhuizing is een andere stad of een ander verblijf voor de volgende nacht.
 */
export interface Verhuizing {
  naarStadId: string;
  /** Het verblijf van morgennacht, als dat al in Mijn gegevens staat. */
  volgend?: Accommodatie;
}

export const verhuisMorgen = (
  datum: string,
  dagen: Reisdagkaart[],
  accommodaties: Accommodatie[],
): Verhuizing | null => {
  const morgen = plusDagen(datum, 1);
  const vannacht = verblijfVanNacht(datum, accommodaties);
  const volgend = verblijfVanNacht(morgen, accommodaties);
  const hierStad = vannacht?.stadId ?? dagen.find((d) => d.datum === datum)?.nachtStadId;
  const daarStad = volgend?.stadId ?? dagen.find((d) => d.datum === morgen)?.nachtStadId;
  if (!hierStad || !daarStad) return null;
  const ander = hierStad !== daarStad || (vannacht && volgend && vannacht.id !== volgend.id);
  return ander ? { naarStadId: daarStad, volgend } : null;
};
