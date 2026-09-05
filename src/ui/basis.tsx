import type { ReactNode } from 'react';

/**
 * De kleine bouwstenen die overal terugkomen. Geen componentenbibliotheek maar
 * een handvol vormen, zodat knoppen en labels er in de hele app hetzelfde
 * uitzien zonder dat elk scherm zijn eigen klassenrijtje verzint.
 */

export const Knop = ({
  children,
  onClick,
  soort = 'gewoon',
  klein = false,
  type = 'button',
  disabled = false,
  'aria-pressed': ariaPressed,
}: {
  children: ReactNode;
  onClick?: () => void;
  soort?: 'gewoon' | 'nadruk' | 'stil';
  klein?: boolean;
  type?: 'button' | 'submit';
  disabled?: boolean;
  'aria-pressed'?: boolean;
}) => {
  const basis =
    'inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition disabled:opacity-40 disabled:cursor-not-allowed';
  const maat = klein ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-[15px]';
  const kleur = {
    nadruk: 'bg-zegel text-white hover:bg-zegel-diep active:bg-zegel-diep',
    gewoon:
      'bg-papier-diep text-inkt hover:bg-[#e6dfd2] dark:bg-nacht-diep dark:text-papier dark:hover:bg-[#2c2820]',
    stil: 'text-inkt-zacht hover:text-inkt dark:text-papier/70 dark:hover:text-papier',
  }[soort];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={ariaPressed}
      className={`${basis} ${maat} ${kleur}`}
    >
      {children}
    </button>
  );
};

/** Een klein label bij een plaats: type, dagdeel, waarschuwing. */
export const Label = ({
  children,
  toon = 'gewoon',
}: {
  children: ReactNode;
  toon?: 'gewoon' | 'let-op' | 'gratis' | 'eigen';
}) => {
  const kleur = {
    gewoon: 'bg-papier-diep text-inkt-zacht dark:bg-nacht-diep dark:text-papier/70',
    'let-op': 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
    gratis: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
    // De persoonlijke laag is met opzet een andere kleur dan de redactionele
    // content, zodat je altijd ziet wat van jou is en wat van de app.
    eigen: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200',
  }[toon];
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${kleur}`}>
      {children}
    </span>
  );
};

export const Kaartje = ({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={`rounded-2xl border border-black/5 bg-white/70 shadow-sm dark:border-white/10 dark:bg-nacht-diep/70 ${className}`}
  >
    {children}
  </div>
);

export const Sectiekop = ({ children, extra }: { children: ReactNode; extra?: ReactNode }) => (
  <div className="mb-3 flex items-baseline justify-between gap-3">
    <h2 className="text-sm font-semibold tracking-wide text-inkt-zacht uppercase dark:text-papier/60">
      {children}
    </h2>
    {extra}
  </div>
);
