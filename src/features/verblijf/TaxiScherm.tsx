import { Phone } from 'lucide-react';
import { ZINNEN, stadMet } from '@/data/content';
import { telLink, type Accommodatie, type Coordinaat, type Plaats } from '@/domein/schema';
import { Kaart } from '@/features/kaart/Kaart';
import { Volscherm } from '@/ui/Volscherm';

/**
 * Voor de taxichauffeur: naam en adres in groot lokaal schrift, het
 * telefoonnummer, en een kaartje met de pin. Een chauffeur in Kyoto leest
 * geen Latijns schrift, maar tikt een Japans adres zo in zijn navigatie, en
 * belt anders het hotel. Hetzelfde geldt in Hanoi voor een museum of restaurant.
 *
 * Werkt zonder bereik; het kaartje heeft alleen tegels als je de kaart van die
 * stad offline hebt opgeslagen.
 */

/** Wat de chauffeur moet zien, voor een verblijf of een plek. */
export interface TaxiDoel {
  id: string;
  stadId: string;
  naam: string;
  naamLokaal?: string;
  adresLokaal?: string;
  adresLatijn?: string;
  telefoon?: string;
  coordinaten?: Coordinaat;
}

export const verblijfAlsDoel = (verblijf: Accommodatie): TaxiDoel => ({
  id: verblijf.id,
  stadId: verblijf.stadId,
  naam: verblijf.naam,
  naamLokaal: verblijf.naamLokaal,
  adresLokaal: verblijf.adresLokaal,
  adresLatijn: verblijf.adresLatijn,
  telefoon: verblijf.telefoon,
  coordinaten: verblijf.coordinaten,
});

export const plaatsAlsDoel = (plaats: Plaats): TaxiDoel => ({
  id: plaats.id,
  stadId: plaats.stad,
  naam: plaats.naam,
  naamLokaal: plaats.naamLokaal,
  adresLokaal: plaats.adresLokaal,
  adresLatijn: plaats.adres,
  telefoon: plaats.telefoon,
  coordinaten: plaats.coordinaten,
});

export const TaxiScherm = ({ doel, onSluit }: { doel: TaxiDoel; onSluit: () => void }) => {
  const stad = stadMet(doel.stadId);
  const taal = stad?.land === 'vietnam' ? 'vi' : 'ja';
  const zin = ZINNEN.find((z) => z.id === (taal === 'ja' ? 'taxi-adres-ja' : 'taxi-adres-vn'));
  const pin = doel.coordinaten;

  return (
    <Volscherm
      titel="Voor de taxichauffeur"
      helder
      tip="Zet je scherm op maximale helderheid, dan kan de chauffeur het goed lezen."
      onSluit={onSluit}
    >
      <div lang={taal} className="grid gap-4 pt-3 text-black">
        {zin && <p className="text-2xl leading-snug font-semibold">{zin.lokaal}</p>}
        <p className="text-3xl leading-tight font-bold">{doel.naamLokaal ?? doel.naam}</p>
        {doel.naamLokaal && <p className="-mt-3 text-lg">{doel.naam}</p>}
        <p className="text-[2rem] leading-snug font-bold break-words">
          {doel.adresLokaal ?? doel.adresLatijn ?? 'Nog geen adres ingevuld'}
        </p>
        {doel.telefoon && (
          <a
            href={telLink(doel.telefoon)}
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-black px-4 py-3 text-2xl font-semibold text-white tabular-nums"
          >
            <Phone className="size-6" aria-hidden />
            {doel.telefoon}
          </a>
        )}
        {pin && (
          <Kaart
            punten={[{ id: doel.id, naam: doel.naam, coordinaten: pin, laag: 'eigen' }]}
            gebied={{
              zuidwest: { lat: pin.lat - 0.004, lon: pin.lon - 0.005 },
              noordoost: { lat: pin.lat + 0.004, lon: pin.lon + 0.005 },
            }}
            hoogte="14rem"
            clusteren={false}
          />
        )}
      </div>
      <p className="mt-5 text-sm text-black/60">
        {zin?.nederlands}.{doel.adresLatijn && ` ${doel.adresLatijn}`}
      </p>
    </Volscherm>
  );
};
