import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Iets over het hele scherm: een voucher, een e-ticket, een kaart om te tonen.
 *
 * Eén vorm voor alles wat je aan een ander laat zien, zodat de sluitknop altijd
 * op dezelfde plek zit. `helder` is voor een QR-code of een zin voor een
 * taxichauffeur: wit, zwart, groot, en het scherm blijft aan zolang dit open
 * staat. De helderheid zelf kan een web app niet regelen; daarom staat de tip
 * erbij.
 */
export const Volscherm = ({
  titel,
  onSluit,
  helder = false,
  acties,
  children,
}: {
  titel: string;
  onSluit: () => void;
  helder?: boolean;
  /** Knoppen naast de sluitknop, zoals delen. */
  acties?: ReactNode;
  children: ReactNode;
}) => {
  useEffect(() => {
    const vorige = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const bijToets = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSluit();
    };
    window.addEventListener('keydown', bijToets);
    return () => {
      document.body.style.overflow = vorige;
      window.removeEventListener('keydown', bijToets);
    };
  }, [onSluit]);

  // Het scherm aan houden terwijl iemand de code scant. Lukt het niet, bijvoorbeeld
  // in een oudere iOS of zonder batterij, dan gaat het gewoon zonder.
  useEffect(() => {
    if (!helder || !('wakeLock' in navigator)) return;
    let slot: WakeLockSentinel | null = null;
    let weg = false;
    void navigator.wakeLock
      .request('screen')
      .then((s) => {
        if (weg) void s.release();
        else slot = s;
      })
      .catch(() => {
        /* geen wake lock: dan dimt het scherm na een tijdje gewoon */
      });
    return () => {
      weg = true;
      void slot?.release();
    };
  }, [helder]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titel}
      className={`fixed inset-0 z-[1300] flex flex-col ${
        helder ? 'bg-white text-black' : 'bg-papier text-inkt dark:bg-nacht dark:text-papier'
      }`}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center gap-2 px-4 py-2">
        <p className="min-w-0 flex-1 truncate font-medium">{titel}</p>
        {acties}
        <button
          type="button"
          onClick={onSluit}
          className={`inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-medium ${
            helder ? 'bg-black/5 text-black' : 'bg-papier-diep dark:bg-nacht-diep'
          }`}
        >
          <X className="size-4" aria-hidden />
          Sluiten
        </button>
      </div>
      {helder && (
        <p className="px-4 pb-2 text-sm text-black/70">
          Zet je scherm op maximale helderheid, dan leest een scanner de code het best.
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain px-4 pb-6">{children}</div>
    </div>,
    document.body,
  );
};
