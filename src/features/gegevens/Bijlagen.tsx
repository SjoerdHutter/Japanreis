import { useCallback, useState } from 'react';
import { FileText, Paperclip } from 'lucide-react';
import type { Bijlage, BijlageEigenaar } from '@/domein/schema';
import { BIJLAGE_ACCEPT, GROOT_BESTAND, maakBijlage } from '@/data/bijlagen';
import { bewaarBijlage, leesBijlagen, verwijderBijlage } from '@/data/gegevens';
import { useOpslag } from '@/data/db/useOpslag';
import { alsGrootte } from '@/domein/fotos/miniatuur';
import { Invoer } from '@/ui/formulier';
import { useBlobUrl } from '@/ui/useBlobUrl';
import { BijlageWeergave } from './BijlageWeergave';

/**
 * De bijlagen bij één ding: je polis, een vlucht, een verblijf, een ticket.
 *
 * Toevoegen gaat via de gewone bestandskiezer. Op een iPhone biedt die Foto's,
 * de camera en Bestanden aan, dus een scan van je paspoort en de pdf uit je
 * mail gaan allebei. Alles wordt als bestand in IndexedDB bewaard, zodat het er
 * ook in een trein zonder bereik gewoon is.
 */
export const Bijlagen = ({
  eigenaar,
  uitleg,
  vraagLabel = false,
  helder = false,
}: {
  eigenaar: BijlageEigenaar;
  uitleg?: string;
  /** Vraag bij elk bestand om een naam, zoals bij reisdocumenten. */
  vraagLabel?: boolean;
  /** Openen als voucher: wit en helder, voor een scanner. */
  helder?: boolean;
}) => {
  const lader = useCallback(() => leesBijlagen(eigenaar), [eigenaar]);
  const { waarde: bijlagen } = useOpslag(lader, [] as Bijlage[], ['bijlagen']);
  const [bezig, setBezig] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [open, setOpen] = useState<Bijlage | null>(null);
  const [hernoemen, setHernoemen] = useState<string | null>(null);

  const voegToe = async (bestanden: FileList) => {
    setFout(null);
    const mislukt: string[] = [];
    for (const bestand of [...bestanden]) {
      if (
        bestand.size > GROOT_BESTAND &&
        !window.confirm(
          `${bestand.name} is ${alsGrootte(bestand.size)}. Dat is groot voor een telefoon en maakt je backup zwaar. Toch bewaren?`,
        )
      ) {
        continue;
      }
      const label = vraagLabel
        ? (window.prompt(`Hoe heet dit bestand? Bijvoorbeeld paspoort of visum.`, '') ?? undefined)
        : undefined;
      setBezig(bestand.name);
      try {
        const bijlage = await maakBijlage(bestand, eigenaar, label);
        if (!(await bewaarBijlage(bijlage))) mislukt.push(bestand.name);
      } catch {
        mislukt.push(bestand.name);
      }
    }
    setBezig(null);
    if (mislukt.length > 0) {
      setFout(
        `Bewaren lukte niet voor ${mislukt.join(', ')}. Zit het toestel vol? Kijk bij Meer hoeveel ruimte er nog is.`,
      );
    }
  };

  const hernoem = async (bijlage: Bijlage, label: string) => {
    await bewaarBijlage({
      ...bijlage,
      label: label.trim() || undefined,
      gewijzigdOp: new Date().toISOString(),
    });
    setHernoemen(null);
  };

  const gooiWeg = async (bijlage: Bijlage) => {
    if (!window.confirm(`${bijlage.label ?? bijlage.naam} verwijderen?`)) return;
    await verwijderBijlage(bijlage.id);
  };

  return (
    <div>
      {uitleg && (
        <p className="mb-2 text-sm leading-relaxed text-inkt-zacht dark:text-papier/65">{uitleg}</p>
      )}

      {bijlagen.length > 0 && (
        <ul className="mb-3 grid grid-cols-3 gap-2">
          {bijlagen.map((bijlage) => (
            <li key={bijlage.id} className="min-w-0">
              <button
                type="button"
                onClick={() => setOpen(bijlage)}
                className="block aspect-[3/4] w-full overflow-hidden rounded-lg border border-black/10 bg-white dark:border-white/15 dark:bg-nacht"
                aria-label={`Open ${bijlage.label ?? bijlage.naam}`}
              >
                <Miniatuur bijlage={bijlage} />
              </button>
              {hernoemen === bijlage.id ? (
                <form
                  className="mt-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const invoer = new FormData(e.currentTarget).get('label');
                    void hernoem(bijlage, typeof invoer === 'string' ? invoer : '');
                  }}
                >
                  <Invoer
                    name="label"
                    defaultValue={bijlage.label ?? ''}
                    placeholder={bijlage.naam}
                    autoFocus
                    className="px-2 py-1 text-sm"
                  />
                  <span className="mt-1 flex gap-2 text-xs">
                    <button type="submit" className="font-medium text-zegel">
                      bewaar
                    </button>
                    <button type="button" onClick={() => setHernoemen(null)}>
                      annuleer
                    </button>
                  </span>
                </form>
              ) : (
                <>
                  <p className="mt-1 truncate text-xs font-medium">
                    {bijlage.label ?? bijlage.naam}
                  </p>
                  <p className="flex flex-wrap gap-x-2 text-xs text-inkt-zacht dark:text-papier/55">
                    <span>{alsGrootte(bijlage.grootte)}</span>
                    <button
                      type="button"
                      onClick={() => setHernoemen(bijlage.id)}
                      className="underline underline-offset-2"
                    >
                      naam
                    </button>
                    <button
                      type="button"
                      onClick={() => void gooiWeg(bijlage)}
                      className="text-zegel underline underline-offset-2 dark:text-zegel-licht"
                    >
                      weg
                    </button>
                  </p>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-papier-diep px-3 py-1.5 text-sm font-medium dark:bg-nacht-diep">
        <Paperclip className="size-4" aria-hidden />
        {bezig ? `Bezig met ${bezig}` : 'Bestand toevoegen'}
        <input
          type="file"
          accept={BIJLAGE_ACCEPT}
          multiple
          disabled={bezig !== null}
          className="sr-only"
          onChange={(e) => {
            const bestanden = e.target.files;
            if (bestanden && bestanden.length > 0) void voegToe(bestanden);
            e.target.value = '';
          }}
        />
      </label>
      {fout && <p className="mt-2 text-sm text-zegel dark:text-zegel-licht">{fout}</p>}

      {open && <BijlageWeergave bijlage={open} helder={helder} onSluit={() => setOpen(null)} />}
    </div>
  );
};

const Miniatuur = ({ bijlage }: { bijlage: Bijlage }) => {
  const url = useBlobUrl(bijlage.miniatuur);
  if (url) return <img src={url} alt="" className="h-full w-full object-cover" />;
  return (
    <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-inkt-zacht dark:text-papier/60">
      <FileText className="size-7" aria-hidden />
      <span className="text-[10px] uppercase">{bijlage.naam.split('.').pop()}</span>
    </span>
  );
};
