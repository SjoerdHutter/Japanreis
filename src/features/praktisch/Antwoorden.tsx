import { ChevronDown, MessageCircleReply } from 'lucide-react';
import type { Zin } from '@/domein/schema';
import { ZINNEN } from '@/data/content';
import { antwoordenFeitId } from '@/data/content/feiten';
import { Controleren } from '@/ui/Controleren';

/**
 * Wat je terug kunt horen op een zin.
 *
 * Een vraag stellen lukt met de zinnenlijst wel; het antwoord verstaan is het
 * lastige deel. Daarom staan de gangbare antwoorden in het schrift bij elke
 * zin, met bovenaan in de taal van het land het verzoek om er een aan te
 * wijzen. Dan hoef je het niet te verstaan: je houdt je telefoon op en de
 * ander wijst. De uitspraak en de betekenis staan eronder, voor als je het
 * toch hoort.
 */

type Taal = 'ja' | 'vi';

const wijsZin = (taal: Taal) =>
  ZINNEN.find((z) => z.id === (taal === 'ja' ? 'wijs-antwoord-ja' : 'wijs-antwoord-vn'));

const Lijst = ({ zin, taal, groot }: { zin: Zin; taal: Taal; groot: boolean }) => {
  const wijs = wijsZin(taal);
  return (
    <>
      {wijs && (
        <p
          lang={taal}
          className={groot ? 'text-2xl leading-snug font-semibold' : 'text-base font-medium'}
        >
          {wijs.lokaal}
          <span
            lang="nl"
            className={`block font-normal ${groot ? 'text-sm text-black/60' : 'text-xs text-inkt-zacht dark:text-papier/55'}`}
          >
            {wijs.nederlands}
          </span>
        </p>
      )}
      <ul className="mt-2.5 grid gap-1.5">
        {zin.antwoorden?.map((antwoord) => (
          <li
            key={antwoord.lokaal}
            className={
              groot
                ? 'rounded-xl border-2 border-black/15 px-3.5 py-2.5'
                : 'rounded-lg bg-black/[0.035] px-3 py-2 dark:bg-white/[0.06]'
            }
          >
            <p
              lang={taal}
              className={
                groot ? 'text-2xl leading-snug font-semibold' : 'text-lg leading-snug font-medium'
              }
            >
              {antwoord.lokaal}
            </p>
            <p className={`text-sm ${groot ? 'text-black/70' : ''}`}>
              <span className="font-medium">{antwoord.nederlands}</span>
              <span
                className={`ml-1.5 ${groot ? 'text-black/50' : 'text-inkt-zacht dark:text-papier/55'}`}
              >
                {antwoord.uitspraak}
              </span>
            </p>
            {antwoord.uitleg && (
              <p
                className={`mt-0.5 text-sm leading-relaxed ${groot ? 'text-black/60' : 'text-inkt-zacht dark:text-papier/65'}`}
              >
                {antwoord.uitleg}
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className={`mt-2 text-xs ${groot ? 'text-black/50' : ''}`}>
        <Controleren id={antwoordenFeitId(zin.id)} gecontroleerd={zin.antwoordenGecontroleerd} />
      </p>
    </>
  );
};

/** Inklapbaar onder een zin in de zinnenlijst. `open` klapt hem bij het tonen open. */
export const Antwoorden = ({ zin, taal, open }: { zin: Zin; taal: Taal; open?: boolean }) => {
  const aantal = zin.antwoorden?.length ?? 0;
  if (aantal === 0) return null;
  return (
    <details open={open} className="group mt-3 border-t border-black/5 pt-2 dark:border-white/10">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-1 text-sm font-medium text-zegel dark:text-zegel-licht [&::-webkit-details-marker]:hidden">
        <MessageCircleReply className="size-4 shrink-0" aria-hidden />
        Wat je terug kunt horen ({aantal})
        <ChevronDown
          className="ml-auto size-4 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="pt-2">
        <Lijst zin={zin} taal={taal} groot={false} />
      </div>
    </details>
  );
};

/** Altijd open en groot, op een scherm dat je aan iemand laat zien. */
export const AntwoordenOmAanTeWijzen = ({ zin, taal }: { zin: Zin; taal: Taal }) => {
  if (!zin.antwoorden?.length) return null;
  return (
    <div className="mt-8 border-t-2 border-black/10 pt-5 text-black">
      <Lijst zin={zin} taal={taal} groot />
    </div>
  );
};
