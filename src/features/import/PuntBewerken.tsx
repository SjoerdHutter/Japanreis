import { useMemo, useState } from 'react';
import type { Coordinaat, EigenPunt, Plaats, Stad } from '@/domein/schema';
import { Knop } from '@/ui/basis';
import { Kaart } from '@/features/kaart/Kaart';
import { naamGelijkenis } from '@/domein/import/koppel';
import { afstandKm } from '@/domein/geo/afstand';

/**
 * Een eigen punt bijwerken: er een plek bij zetten, hem koppelen aan een plaats
 * die de app al kent, of de tip aanpassen.
 *
 * Dit is de tegenhanger van de importer. Een Google Maps CSV levert punten
 * zonder coördinaten op, en de Instagram export levert alleen links; die punten
 * worden niet weggegooid maar wachten hier tot je ze afmaakt. Zonder dit scherm
 * zou "we gooien niets weg" betekenen dat er een stapel onbruikbare punten
 * blijft liggen, en dat is geen belofte maar een rommelhoek.
 *
 * Plaatsen op de kaart gaat met een tik op de kaart. Slepen is op een telefoon
 * lastiger te raken dan tikken, en het resultaat is hetzelfde.
 */
export const PuntBewerken = ({
  punt,
  steden,
  plaatsen,
  onBewaar,
  onVerwijder,
  onSluit,
}: {
  punt: EigenPunt;
  steden: Stad[];
  plaatsen: Plaats[];
  onBewaar: (punt: EigenPunt) => void;
  onVerwijder: (id: string) => void;
  onSluit: () => void;
}) => {
  const [naam, setNaam] = useState(punt.naam);
  const [notitie, setNotitie] = useState(punt.notitie ?? '');
  const [coordinaten, setCoordinaten] = useState<Coordinaat | undefined>(punt.coordinaten);
  const [stadId, setStadId] = useState(punt.stadId ?? '');
  const [koppeling, setKoppeling] = useState(punt.koppelingPlaatsId ?? '');

  const stad = steden.find((s) => s.id === stadId) ?? steden[0];

  /**
   * Voorstellen om aan te koppelen: eerst wat dichtbij ligt als er een plek is,
   * anders wat qua naam in de buurt komt. Nooit automatisch, altijd als aanbod.
   */
  const voorstellen = useMemo(() => {
    const inStad = stadId ? plaatsen.filter((p) => p.stad === stadId) : plaatsen;
    if (coordinaten) {
      return inStad
        .map((p) => ({ plaats: p, km: afstandKm(coordinaten, p.coordinaten) }))
        .filter((k) => k.km < 1)
        .sort((a, b) => a.km - b.km)
        .slice(0, 6)
        .map((k) => ({ plaats: k.plaats, waarom: `${Math.round(k.km * 1000)} meter` }));
    }
    return inStad
      .map((p) => ({ plaats: p, score: naamGelijkenis(naam, p.naam) }))
      .filter((k) => k.score >= 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((k) => ({ plaats: k.plaats, waarom: 'lijkt qua naam' }));
  }, [coordinaten, naam, plaatsen, stadId]);

  const bewaar = () => {
    onBewaar({
      ...punt,
      naam: naam.trim() || punt.naam,
      notitie: notitie.trim() || undefined,
      coordinaten,
      stadId: stadId || undefined,
      koppelingPlaatsId: koppeling || undefined,
    });
  };

  return (
    <div className="rounded-2xl border border-black/10 bg-white/80 p-4 dark:border-white/15 dark:bg-nacht-diep/80">
      <div className="grid gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Naam</span>
          <input
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 dark:border-white/15 dark:bg-nacht"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Tip of notitie</span>
          <textarea
            value={notitie}
            onChange={(e) => setNotitie(e.target.value)}
            rows={3}
            placeholder="Wat er over deze plek gezegd werd"
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 dark:border-white/15 dark:bg-nacht"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Stad</span>
          <select
            value={stadId}
            onChange={(e) => setStadId(e.target.value)}
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 dark:border-white/15 dark:bg-nacht"
          >
            <option value="">nog niet bekend</option>
            {steden.map((s) => (
              <option key={s.id} value={s.id}>
                {s.naam}
              </option>
            ))}
          </select>
        </label>

        {stad && (
          <div>
            <p className="mb-1.5 text-sm font-medium">
              {coordinaten ? 'Tik op de kaart om te verplaatsen' : 'Tik op de kaart om te plaatsen'}
            </p>
            <Kaart
              punten={
                coordinaten
                  ? [{ id: punt.id, naam: naam || punt.naam, coordinaten, laag: 'eigen' }]
                  : []
              }
              gebied={stad.kaartgebied}
              hoogte="14rem"
              onTikOpKaart={(plek) => {
                setCoordinaten(plek);
                // De stad die erbij hoort meteen invullen, zodat het punt op het
                // juiste stadsscherm terechtkomt zonder dat je dat apart doet.
                const passend = steden.find((s) => afstandKm(plek, s.centrum) <= s.straalKm);
                if (passend) setStadId(passend.id);
              }}
            />
            {coordinaten && (
              <p className="mt-1.5 text-xs text-inkt-zacht dark:text-papier/50">
                {coordinaten.lat.toFixed(5)}, {coordinaten.lon.toFixed(5)}{' '}
                <button
                  type="button"
                  onClick={() => setCoordinaten(undefined)}
                  className="text-zegel underline underline-offset-2"
                >
                  plek wissen
                </button>
              </p>
            )}
          </div>
        )}

        {voorstellen.length > 0 && (
          <div>
            <p className="mb-1.5 text-sm font-medium">Koppelen aan een plaats uit de app</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setKoppeling('')}
                aria-pressed={koppeling === ''}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  koppeling === ''
                    ? 'border-zegel bg-zegel text-white'
                    : 'border-black/10 bg-white/70 dark:border-white/15 dark:bg-nacht-diep/70'
                }`}
              >
                los punt
              </button>
              {voorstellen.map(({ plaats, waarom }) => (
                <button
                  key={plaats.id}
                  type="button"
                  onClick={() => {
                    setKoppeling(plaats.id);
                    if (!coordinaten) setCoordinaten(plaats.coordinaten);
                    setStadId(plaats.stad);
                  }}
                  aria-pressed={koppeling === plaats.id}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    koppeling === plaats.id
                      ? 'border-zegel bg-zegel text-white'
                      : 'border-black/10 bg-white/70 dark:border-white/15 dark:bg-nacht-diep/70'
                  }`}
                >
                  {plaats.naam}{' '}
                  <span className={koppeling === plaats.id ? 'opacity-80' : 'opacity-60'}>
                    {waarom}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-black/5 pt-3 dark:border-white/10">
          <Knop soort="nadruk" onClick={bewaar}>
            Bewaren
          </Knop>
          <Knop soort="stil" onClick={onSluit}>
            Annuleren
          </Knop>
          <span className="ml-auto">
            <Knop soort="stil" klein onClick={() => onVerwijder(punt.id)}>
              Verwijder dit punt
            </Knop>
          </span>
        </div>
      </div>
    </div>
  );
};
