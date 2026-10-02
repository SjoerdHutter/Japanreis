import { useState } from 'react';
import { useNagekeken, zetControles } from '@/data/controles';
import { alsLangeDatum } from '@/domein/tijd/datums';

/**
 * Het label "controleren" bij een meegeleverd feit, met een vinkje om het weg
 * te halen zodra je het zelf hebt nagekeken. Tik op het label, dan verschijnt
 * het vinkje; zo vink je het niet per ongeluk aan tijdens het scrollen.
 *
 * `gecontroleerd` komt uit de content. Staat daar true, of hoort het feit niet
 * bij de meegeleverde content, dan toont dit niets.
 *
 * Met `bron` en `gecheckt` staat erbij waar het feit vandaan komt en wanneer
 * het is verzameld, zodat je weet waar je het nakijkt. In een lijst verschijnt
 * dat pas na een tik; met `metBron` staat het er altijd, zoals op de pagina van
 * een plek.
 */
export const Controleren = ({
  id,
  gecontroleerd,
  bron,
  gecheckt,
  metBron = false,
}: {
  id: string;
  gecontroleerd?: boolean;
  bron?: { naam: string; url?: string };
  gecheckt?: string;
  metBron?: boolean;
}) => {
  const nagekeken = useNagekeken();
  const [open, setOpen] = useState(false);
  if (gecontroleerd !== false || !nagekeken || nagekeken.has(id)) return null;
  const herkomst = (bron || gecheckt) && (
    <span className="text-xs text-inkt-zacht dark:text-papier/60">
      {bron && (
        <>
          bron:{' '}
          {bron.url ? (
            <a
              href={bron.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zegel underline underline-offset-2 dark:text-zegel-licht"
            >
              {bron.naam}
            </a>
          ) : (
            bron.naam
          )}
        </>
      )}
      {bron && gecheckt && ', '}
      {gecheckt && `gecheckt op ${alsLangeDatum(gecheckt)}`}
    </span>
  );
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
      {(open || metBron) && herkomst}
      {open && (
        <label className="inline-flex items-center gap-1 text-xs">
          <input type="checkbox" onChange={(e) => void zetControles([id], e.target.checked)} />
          gecontroleerd
        </label>
      )}
    </span>
  );
};
