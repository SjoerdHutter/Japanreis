import { useState } from 'react';
import { Users } from 'lucide-react';
import {
  WEEKDAGEN,
  type Dagdeel,
  type Drukteniveau,
  type Plaats,
  type Weekdag,
} from '@/domein/schema';
import { druktFeitId } from '@/data/content/feiten';
import { zetOverschrijving } from '@/data/overschrijvingen';
import { alsTijdslotTekst, leesTijdslot } from '@/domein/planning/drukte';
import { Knop, Label } from '@/ui/basis';
import { Controleren } from '@/ui/Controleren';
import { EigenWaarde } from '@/ui/EigenWaarde';
import { Invoer, Keuze } from '@/ui/formulier';

/**
 * Hoe druk het is, en wanneer het rustigst. Staat bij de grote trekpleisters:
 * Fushimi Inari om tien uur 's ochtends is een andere plek dan om zeven uur.
 * De dagplanner zet ze op dat rustige moment als de openingstijden dat
 * toelaten. Weet je het ter plekke beter, pas het dan aan.
 */

const VELD = 'attractie.drukte';
const DAGDELEN: Dagdeel[] = ['ochtend', 'middag', 'avond'];
const NIVEAU_TEKST: Record<Drukteniveau, string> = {
  rustig: 'rustig',
  druk: 'druk',
  'zeer-druk': 'zeer druk',
};
const NIVEAU_TOON: Record<Drukteniveau, 'gratis' | 'gewoon' | 'let-op'> = {
  rustig: 'gratis',
  druk: 'gewoon',
  'zeer-druk': 'let-op',
};

export const DrukteBlok = ({ plaats, eigen }: { plaats: Plaats; eigen: Set<string> }) => {
  const drukte = plaats.attractie?.drukte;
  const [bewerken, setBewerken] = useState(false);
  const [slot, setSlot] = useState(drukte?.besteTijdslot ?? '');
  const [perDagdeel, setPerDagdeel] = useState<Partial<Record<Dagdeel, Drukteniveau>>>(
    drukte?.perDagdeel ?? {},
  );
  const [dagen, setDagen] = useState<Weekdag[]>(drukte?.druksteDagen ?? []);

  if (!plaats.attractie) return null;
  const heeftIets =
    drukte &&
    (drukte.besteMoment || drukte.besteTijdslot || drukte.perDagdeel || drukte.druksteDagen);
  const gelezen = leesTijdslot(slot);
  const eigenVeld = (veld: string) => eigen.has(`${VELD}.${veld}`);

  const bewaar = async () => {
    if (slot.trim() !== (drukte?.besteTijdslot ?? '')) {
      await zetOverschrijving(
        'plaats',
        plaats.id,
        `${VELD}.besteTijdslot`,
        slot.trim() || undefined,
      );
    }
    if (JSON.stringify(perDagdeel) !== JSON.stringify(drukte?.perDagdeel ?? {})) {
      await zetOverschrijving('plaats', plaats.id, `${VELD}.perDagdeel`, perDagdeel);
    }
    if (JSON.stringify(dagen) !== JSON.stringify(drukte?.druksteDagen ?? [])) {
      await zetOverschrijving('plaats', plaats.id, `${VELD}.druksteDagen`, dagen);
    }
    setBewerken(false);
  };

  return (
    <div className="mt-3 rounded-lg bg-papier-diep/70 p-2.5 dark:bg-nacht/60">
      <p className="flex flex-wrap items-center gap-1.5 font-medium text-inkt dark:text-papier">
        <Users className="size-4" aria-hidden />
        Drukte
        {!eigen.size && (
          <Controleren id={druktFeitId(plaats.id)} gecontroleerd={drukte?.gecontroleerd} />
        )}
      </p>
      {!heeftIets && !bewerken && (
        <p className="mt-1 text-inkt-zacht dark:text-papier/65">Niet bekend in de app.</p>
      )}
      {drukte?.besteTijdslot && (
        <p className="mt-1">
          <strong className="font-medium text-inkt dark:text-papier">Het rustigst:</strong>{' '}
          {drukte.besteTijdslot}{' '}
          {eigenVeld('besteTijdslot') && (
            <EigenWaarde doel="plaats" doelId={plaats.id} veld={`${VELD}.besteTijdslot`} />
          )}
        </p>
      )}
      {drukte?.besteMoment && <p className="mt-1">{drukte.besteMoment}</p>}
      {drukte?.drukstMoment && (
        <p className="mt-1">
          <strong className="font-medium text-inkt dark:text-papier">Drukst:</strong>{' '}
          {drukte.drukstMoment}
        </p>
      )}
      {drukte?.perDagdeel && (
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {DAGDELEN.filter((d) => drukte.perDagdeel?.[d]).map((d) => (
            <Label key={d} toon={NIVEAU_TOON[drukte.perDagdeel![d]!]}>
              {d} {NIVEAU_TEKST[drukte.perDagdeel![d]!]}
            </Label>
          ))}
          {eigenVeld('perDagdeel') && (
            <EigenWaarde doel="plaats" doelId={plaats.id} veld={`${VELD}.perDagdeel`} />
          )}
        </p>
      )}
      {drukte?.druksteDagen && drukte.druksteDagen.length > 0 && (
        <p className="mt-1">
          <strong className="font-medium text-inkt dark:text-papier">Drukste dagen:</strong>{' '}
          {drukte.druksteDagen.join(' en ')}{' '}
          {eigenVeld('druksteDagen') && (
            <EigenWaarde doel="plaats" doelId={plaats.id} veld={`${VELD}.druksteDagen`} />
          )}
        </p>
      )}

      {bewerken ? (
        <div className="mt-2 grid gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium">Het rustigste moment</span>
            <Invoer
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              placeholder="voor 08:00, na 17:00 of bij opening"
            />
            <span className="mt-1 block text-xs">
              {slot.trim() === ''
                ? 'Leeg laten mag.'
                : gelezen
                  ? `De planner leest: ${alsTijdslotTekst(gelezen)}.`
                  : 'Dit kan de planner niet lezen; schrijf bijvoorbeeld "voor 08:00".'}
            </span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {DAGDELEN.map((d) => (
              <label key={d} className="block">
                <span className="mb-1 block text-xs font-medium">{d}</span>
                <Keuze
                  value={perDagdeel[d] ?? ''}
                  onChange={(e) =>
                    setPerDagdeel((oud) => {
                      const nieuw = { ...oud };
                      if (e.target.value) nieuw[d] = e.target.value as Drukteniveau;
                      else delete nieuw[d];
                      return nieuw;
                    })
                  }
                  className="px-2 py-1 text-sm"
                >
                  <option value="">onbekend</option>
                  <option value="rustig">rustig</option>
                  <option value="druk">druk</option>
                  <option value="zeer-druk">zeer druk</option>
                </Keuze>
              </label>
            ))}
          </div>
          <fieldset>
            <legend className="mb-1 text-xs font-medium">Drukste dagen</legend>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {WEEKDAGEN.map((dag) => (
                <label key={dag} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={dagen.includes(dag)}
                    onChange={(e) =>
                      setDagen((oud) =>
                        e.target.checked
                          ? WEEKDAGEN.filter((w) => oud.includes(w) || w === dag)
                          : oud.filter((w) => w !== dag),
                      )
                    }
                  />
                  {dag}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex gap-2">
            <Knop klein soort="nadruk" onClick={() => void bewaar()}>
              Bewaar
            </Knop>
            <Knop klein soort="stil" onClick={() => setBewerken(false)}>
              Annuleer
            </Knop>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setBewerken(true)}
          className="mt-1.5 text-xs underline"
        >
          drukte aanpassen
        </button>
      )}
    </div>
  );
};
