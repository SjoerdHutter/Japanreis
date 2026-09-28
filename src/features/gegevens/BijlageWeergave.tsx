import { useEffect, useRef, useState } from 'react';
import { Share } from 'lucide-react';
import type { Bijlage } from '@/domein/schema';
import { isAfbeelding, isPdf } from '@/data/bijlagen';
import { deelOfDownload } from '@/data/deel';
import { openPdf, tekenPagina } from '@/data/pdf';
import { Volscherm } from '@/ui/Volscherm';
import { useBlobUrl } from '@/ui/useBlobUrl';

/**
 * Een bijlage over het hele scherm: een foto van je paspoort, een e-ticket, een
 * QR-code. Alles van het toestel zelf, dus het werkt zonder bereik.
 *
 * Een pdf tekent elke pagina onder elkaar, op de breedte van het scherm. Met
 * twee vingers inzoomen kan gewoon, zoals op elke pagina. Kan de app een
 * bestand niet tonen, dan staat er een knop om het via het deelvenster in een
 * andere app te openen.
 */
export const BijlageWeergave = ({
  bijlage,
  helder = false,
  onSluit,
}: {
  bijlage: Bijlage;
  /** Voor een voucher of QR-code: wit, groot, en het scherm blijft aan. */
  helder?: boolean;
  onSluit: () => void;
}) => {
  const titel = bijlage.label ?? bijlage.naam;
  const pdf = isPdf(bijlage.type, bijlage.naam);
  const afbeelding = !pdf && isAfbeelding(bijlage.type, bijlage.naam);

  const deel = () =>
    void deelOfDownload(
      bijlage.bestand instanceof File
        ? bijlage.bestand
        : new File([bijlage.bestand], bijlage.naam, { type: bijlage.type }),
    );

  return (
    <Volscherm
      titel={titel}
      helder={helder}
      onSluit={onSluit}
      acties={
        <button
          type="button"
          onClick={deel}
          aria-label="Delen of openen in een andere app"
          className={`inline-flex min-h-10 items-center rounded-full px-3 ${
            helder ? 'bg-black/5 text-black' : 'bg-papier-diep dark:bg-nacht-diep'
          }`}
        >
          <Share className="size-4" aria-hidden />
        </button>
      }
    >
      {pdf ? (
        <PdfPaginas bestand={bijlage.bestand} onDeel={deel} />
      ) : afbeelding ? (
        <Afbeelding bijlage={bijlage} onDeel={deel} />
      ) : (
        <GeenWeergave onDeel={deel} />
      )}
    </Volscherm>
  );
};

const GeenWeergave = ({ onDeel }: { onDeel: () => void }) => (
  <div className="mt-8 text-center text-sm leading-relaxed">
    <p>Dit bestand kan de app niet tonen.</p>
    <button
      type="button"
      onClick={onDeel}
      className="mt-3 rounded-full bg-zegel px-4 py-2 font-medium text-white"
    >
      Open in een andere app
    </button>
  </div>
);

const Afbeelding = ({ bijlage, onDeel }: { bijlage: Bijlage; onDeel: () => void }) => {
  const url = useBlobUrl(bijlage.weergave ?? bijlage.bestand);
  const [mislukt, setMislukt] = useState(false);
  if (mislukt) return <GeenWeergave onDeel={onDeel} />;
  if (!url) return null;
  return (
    <img
      src={url}
      alt={bijlage.label ?? bijlage.naam}
      onError={() => setMislukt(true)}
      className="mx-auto h-auto max-w-full"
    />
  );
};

const PdfPaginas = ({ bestand, onDeel }: { bestand: Blob; onDeel: () => void }) => {
  const houder = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'laden' | 'klaar' | 'mislukt'>('laden');
  const [aantal, setAantal] = useState(0);

  useEffect(() => {
    const doel = houder.current;
    if (!doel) return;
    let levend = true;
    let sluit: (() => void) | undefined;

    void (async () => {
      try {
        const open = await openPdf(bestand);
        sluit = open.sluit;
        if (!levend) return;
        setAantal(open.pdf.numPages);
        const breedte = Math.max(200, doel.clientWidth);
        // Pagina voor pagina, zodat de eerste er meteen staat en een document
        // van twintig pagina's het geheugen niet in één keer volzet.
        for (let nummer = 1; nummer <= open.pdf.numPages && levend; nummer++) {
          const doek = document.createElement('canvas');
          doek.className = 'mx-auto mb-3 block bg-white shadow';
          doek.setAttribute('aria-label', `Pagina ${nummer}`);
          doel.append(doek);
          await tekenPagina(open.pdf, nummer, breedte, doek);
          if (nummer === 1 && levend) setStatus('klaar');
        }
      } catch {
        if (levend) setStatus('mislukt');
      }
    })();

    return () => {
      levend = false;
      sluit?.();
      doel.replaceChildren();
    };
  }, [bestand]);

  return (
    <>
      {status === 'laden' && <p className="mt-6 text-center text-sm">Pdf openen…</p>}
      {status === 'mislukt' && <GeenWeergave onDeel={onDeel} />}
      {status === 'klaar' && aantal > 1 && (
        <p className="mb-2 text-center text-xs opacity-70">{aantal} pagina's</p>
      )}
      <div ref={houder} />
    </>
  );
};
