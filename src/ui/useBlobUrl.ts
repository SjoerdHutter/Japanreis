import { useEffect, useState } from 'react';

/**
 * Een tijdelijke url voor een Blob, die weer wordt ingetrokken zodra hij niet
 * meer nodig is. Een url die blijft hangen houdt het hele bestand in het
 * geheugen vast, en bij een paar scans van tien megabyte merk je dat.
 *
 * De url hoort bij één Blob. Wisselt de Blob, dan geeft dit tot de nieuwe url
 * klaarstaat niets terug in plaats van de oude, al ingetrokken url.
 */
export const useBlobUrl = (blob: Blob | undefined): string | undefined => {
  const [paar, setPaar] = useState<{ blob: Blob; url: string }>();

  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    let levend = true;
    void Promise.resolve().then(() => {
      if (levend) setPaar({ blob, url });
    });
    return () => {
      levend = false;
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  return paar && paar.blob === blob ? paar.url : undefined;
};
