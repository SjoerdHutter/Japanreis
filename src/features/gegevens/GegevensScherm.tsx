import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { ALLERGEEN_NAAM } from '@/domein/schema';
import type { Sectie as SectieId } from '@/domein/gegevens/compleet';
import { Terug } from '@/ui/basis';
import { AccommodatiesInhoud, type Voorinvulling } from './AccommodatiesSectie';
import { Bijlagen } from './Bijlagen';
import { ContactenInhoud } from './ContactenSectie';
import { ImportInhoud } from './ImportSectie';
import { MedischInhoud } from './MedischSectie';
import { NogInTeVullen } from './NogInTeVullen';
import { VerzekeringInhoud } from './VerzekeringSectie';
import { VluchtenInhoud } from './VluchtenSectie';
import { Sectie, useMijnGegevens } from './gedeeld';

/**
 * Mijn gegevens: alles wat alleen jij weet en wat je onderweg bij de hand wilt
 * hebben. Verzekering, noodcontacten, medische info, reisdocumenten, vluchten
 * en verblijven, met de bijlagen erbij.
 *
 * Dit blijft op het toestel. Het komt niet in een link, niet in "Deel je lijst"
 * en niet in het reisverslag, tenzij je dat zelf aanzet. De link naar een sectie
 * bevat alleen de naam van de sectie en een willekeurige id, nooit een waarde.
 */
export const GegevensScherm = () => {
  const [params] = useSearchParams();
  const gevraagd = params.get('sectie') as SectieId | null;
  const doelId = params.get('id') ?? undefined;
  const voorinvulling: Voorinvulling | undefined =
    params.get('stad') && params.get('van') && params.get('tot')
      ? { stadId: params.get('stad')!, van: params.get('van')!, tot: params.get('tot')! }
      : undefined;

  const { gegevens, geladen } = useMijnGegevens();
  // Wat je zelf open of dicht hebt geklapt. Zonder keuze staat alleen de sectie
  // uit de link open, zodat een tik op "nog in te vullen" meteen goed uitkomt.
  const [keuzes, setKeuzes] = useState<Record<string, boolean>>({});
  const isOpen = (id: string) => keuzes[id] ?? id === gevraagd;
  const wissel = (id: string) =>
    setKeuzes((oud) => ({ ...oud, [id]: !(oud[id] ?? id === gevraagd) }));

  useEffect(() => {
    if (!gevraagd || !geladen) return;
    document.getElementById(`gegevens-${gevraagd}`)?.scrollIntoView({ block: 'start' });
  }, [gevraagd, geladen]);

  const { verzekering, medisch, noodcontacten, vluchten, accommodaties } = gegevens;
  const aantal = (n: number, een: string, meer: string) =>
    n === 0 ? 'nog niets' : `${n} ${n === 1 ? een : meer}`;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
      <Terug naar="/meer" />
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Mijn gegevens</h1>
      <p className="mt-2 mb-5 flex gap-2 leading-relaxed text-inkt-zacht dark:text-papier/70">
        <Lock className="mt-1 size-4 shrink-0" aria-hidden />
        <span>
          Blijft op dit toestel. Het gaat alleen mee in een backup of export die je zelf start.
        </span>
      </p>

      {!geladen ? (
        <p className="text-sm text-inkt-zacht">Bezig met laden.</p>
      ) : (
        <>
          <NogInTeVullen metKop={false} />

          <div className="grid gap-3">
            <Sectie
              id="verzekering"
              titel="Verzekering"
              samenvatting={verzekering?.maatschappij ?? (verzekering ? 'ingevuld' : 'nog niets')}
              open={isOpen('verzekering')}
              onWissel={() => wissel('verzekering')}
            >
              <VerzekeringInhoud verzekering={verzekering} />
            </Sectie>

            <Sectie
              id="noodcontacten"
              titel="Noodcontacten thuis"
              samenvatting={aantal(noodcontacten.length, 'contact', 'contacten')}
              open={isOpen('noodcontacten')}
              onWissel={() => wissel('noodcontacten')}
            >
              <ContactenInhoud contacten={noodcontacten} />
            </Sectie>

            <Sectie
              id="medisch"
              titel="Medische info"
              samenvatting={
                medisch
                  ? medisch.allergenen.length > 0
                    ? `allergisch voor ${medisch.allergenen.map((a) => ALLERGEEN_NAAM[a]).join(', ')}`
                    : 'ingevuld'
                  : 'nog niets'
              }
              open={isOpen('medisch')}
              onWissel={() => wissel('medisch')}
            >
              <MedischInhoud medisch={medisch} />
            </Sectie>

            <Sectie
              id="documenten"
              titel="Reisdocumenten"
              samenvatting="Paspoort, visum en andere documenten"
              open={isOpen('documenten')}
              onWissel={() => wissel('documenten')}
            >
              <Bijlagen
                eigenaar="reisdocumenten"
                vraagLabel
                uitleg="Een foto van je paspoortpagina, je visum of je rijbewijs. Geef elk bestand een naam, dan vind je het snel terug."
              />
            </Sectie>

            <Sectie
              id="vluchten"
              titel="Vluchten"
              samenvatting={aantal(vluchten.length, 'vlucht', 'vluchten')}
              open={isOpen('vluchten')}
              onWissel={() => wissel('vluchten')}
            >
              <VluchtenInhoud
                vluchten={vluchten}
                openId={gevraagd === 'vluchten' ? doelId : undefined}
              />
            </Sectie>

            <Sectie
              id="accommodaties"
              titel="Accommodaties"
              samenvatting={aantal(accommodaties.length, 'verblijf', 'verblijven')}
              open={isOpen('accommodaties')}
              onWissel={() => wissel('accommodaties')}
            >
              <AccommodatiesInhoud
                accommodaties={accommodaties}
                openId={gevraagd === 'accommodaties' ? doelId : undefined}
                voorinvulling={gevraagd === 'accommodaties' ? voorinvulling : undefined}
              />
            </Sectie>

            <Sectie
              id="reserveringen"
              titel="Tickets en reserveringen"
              samenvatting="Staan in de dagplanner, met vouchers en QR-codes"
              open={isOpen('reserveringen')}
              onWissel={() => wissel('reserveringen')}
            >
              <p className="text-sm leading-relaxed">
                Je reserveringen staan bij de dagplanner, met de kaartverkoop en je vouchers erbij.{' '}
                <Link
                  to="/dagplanner?sectie=reserveringen"
                  className="font-medium text-zegel underline underline-offset-2 dark:text-zegel-licht"
                >
                  Naar de reserveringen
                </Link>
              </p>
            </Sectie>

            <Sectie
              id="import"
              titel="Sjabloon en importeren"
              samenvatting="Alles in één keer invullen op je laptop"
              open={isOpen('import')}
              onWissel={() => wissel('import')}
            >
              <ImportInhoud gegevens={gegevens} />
            </Sectie>
          </div>
        </>
      )}
    </div>
  );
};
