import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Luggage } from 'lucide-react';
import { REISDAGEN, REISSCHEMA, stadMet } from '@/data/content';
import { dagenVanDeReis } from '@/domein/reizen/dagen';
import { verhuisMorgen } from '@/domein/reizen/verhuizing';
import { plusDagen } from '@/domein/tijd/datums';
import { useMijnGegevens } from '@/features/gegevens/gedeeld';
import { Knop } from '@/ui/basis';
import { kopieer } from './VerblijfKaart';

/**
 * De avond voor je verkast: stuur je koffer vooruit.
 *
 * Takkyubin geef je vandaag af, bij de receptie of een konbini, met het adres
 * van het volgende verblijf. Dat adres staat hier klaar om te kopiëren, zodat
 * je het niet uit een mail hoeft te vissen terwijl de receptionist wacht.
 */
export const VerhuisHerinnering = ({ datum }: { datum: string }) => {
  const { gegevens, geladen } = useMijnGegevens();
  const [gekopieerd, setGekopieerd] = useState(false);
  const dagen = useMemo(() => dagenVanDeReis(REISSCHEMA, REISDAGEN), []);
  if (!geladen) return null;
  const verhuizing = verhuisMorgen(datum, dagen, gegevens.accommodaties);
  if (!verhuizing) return null;

  const stad = stadMet(verhuizing.naarStadId)?.naam ?? verhuizing.naarStadId;
  const volgend = verhuizing.volgend;
  const adres = volgend?.adresLokaal ?? volgend?.adresLatijn;
  const params = new URLSearchParams({
    sectie: 'accommodaties',
    stad: verhuizing.naarStadId,
    van: plusDagen(datum, 1),
    tot: plusDagen(datum, 2),
  });

  return (
    <div className="rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="flex gap-2">
        <Luggage className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Morgen verkas je naar {stad}. Wil je je koffer vooruitsturen met takkyubin, geef hem dan
          vandaag af.{' '}
          <Link to="/budget?sectie=bagage" className="font-medium underline underline-offset-2">
            Over takkyubin
          </Link>
        </span>
      </p>
      {volgend && adres ? (
        <div className="mt-2 rounded-lg bg-white/70 p-2.5 dark:bg-black/20">
          <p className="font-medium">{volgend.naam}</p>
          <p lang={stadMet(volgend.stadId)?.land === 'vietnam' ? 'vi' : 'ja'}>{adres}</p>
          {volgend.telefoon && <p className="tabular-nums">{volgend.telefoon}</p>}
          <div className="mt-2">
            <Knop
              klein
              onClick={() =>
                void kopieer(
                  [volgend.naam, adres, volgend.telefoon].filter(Boolean).join('\n'),
                ).then((gelukt) => {
                  setGekopieerd(gelukt);
                  if (gelukt) window.setTimeout(() => setGekopieerd(false), 2000);
                })
              }
            >
              <Copy className="size-4" aria-hidden />
              {gekopieerd ? 'Gekopieerd' : 'Kopieer het adres'}
            </Knop>
          </div>
        </div>
      ) : (
        <p className="mt-2">
          Het adres van het volgende verblijf staat nog niet in de app.{' '}
          <Link to={`/gegevens?${params.toString()}`} className="font-medium underline">
            Vul het in
          </Link>
        </p>
      )}
    </div>
  );
};
