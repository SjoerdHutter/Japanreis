import { useState } from 'react';
import { useNagekeken, zetControles } from '@/data/controles';

/**
 * Het label "controleren" bij een meegeleverd feit, met een vinkje om het weg
 * te halen zodra je het zelf hebt nagekeken. Tik op het label, dan verschijnt
 * het vinkje; zo vink je het niet per ongeluk aan tijdens het scrollen.
 *
 * `gecontroleerd` komt uit de content. Staat daar true, of hoort het feit niet
 * bij de meegeleverde content, dan toont dit niets.
 */
export const Controleren = ({ id, gecontroleerd }: { id: string; gecontroleerd?: boolean }) => {
  const nagekeken = useNagekeken();
  const [open, setOpen] = useState(false);
  if (gecontroleerd !== false || !nagekeken || nagekeken.has(id)) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200"
      >
        controleren
      </button>
      {open && (
        <label className="inline-flex items-center gap-1 text-xs">
          <input type="checkbox" onChange={(e) => void zetControles([id], e.target.checked)} />
          gecontroleerd
        </label>
      )}
    </span>
  );
};
