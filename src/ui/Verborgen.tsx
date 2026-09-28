import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Een polisnummer of boekingscode die pas zichtbaar wordt als je erop tikt.
 *
 * Je laat je telefoon zien aan een receptionist, een taxichauffeur, iemand
 * naast je in de trein. Die hoeft je polisnummer niet te lezen. Na een halve
 * minuut gaat hij vanzelf weer dicht, voor het geval je vergeet op te ruimen.
 */
const WEER_DICHT_NA = 30_000;

export const Verborgen = ({ waarde, wat }: { waarde: string; wat: string }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const klok = window.setTimeout(() => setOpen(false), WEER_DICHT_NA);
    return () => window.clearTimeout(klok);
  }, [open]);

  const Icoon = open ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-label={open ? `${wat} verbergen` : `${wat} tonen`}
      className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-papier-diep px-2 py-1 text-left dark:bg-nacht-diep"
    >
      <span className="font-mono tracking-wide select-all">
        {open ? waarde : '•'.repeat(Math.min(10, Math.max(5, waarde.length)))}
      </span>
      <Icoon className="size-4 shrink-0 text-inkt-zacht dark:text-papier/60" aria-hidden />
    </button>
  );
};
