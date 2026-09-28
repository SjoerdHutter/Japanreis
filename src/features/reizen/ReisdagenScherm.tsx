import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { REISDAGEN, REISSCHEMA, STEDEN } from '@/data/content';
import { vandaagOpReis } from '@/domein/highlight/vandaag';
import { Terug } from '@/ui/basis';
import { ReisdagKaart } from './ReisdagKaart';

/**
 * Alle reisdagen onder elkaar: hoe je van stad naar stad komt.
 *
 * De dag van vandaag heeft een rand. Kom je hier vanaf de kaart in het
 * hoofdmenu, dan staat die dag in de link en scrolt het scherm ernaartoe.
 */
export const ReisdagenScherm = () => {
  const [zoekparams] = useSearchParams();
  const gekozen = zoekparams.get('dag');
  const vandaag = vandaagOpReis(STEDEN, REISSCHEMA);

  useEffect(() => {
    if (gekozen) document.getElementById(`reisdag-${gekozen}`)?.scrollIntoView();
  }, [gekozen]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
      <Terug naar="/meer" />
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Reisdagen</h1>
      <p className="mt-2 mb-5 leading-relaxed text-inkt-zacht dark:text-papier/70">
        Hoe je van stad naar stad komt: welke trein of bus, vanaf welk station, en wat je met je
        koffer doet. De vertrektijden en perrons staan op de borden en in Google Maps.
      </p>
      <div className="grid gap-3">
        {REISDAGEN.map((reisdag) => (
          <div key={reisdag.id} id={`reisdag-${reisdag.id}`} className="scroll-mt-4">
            <ReisdagKaart
              reisdag={reisdag}
              gemarkeerd={reisdag.id === gekozen || reisdag.datum === vandaag}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
