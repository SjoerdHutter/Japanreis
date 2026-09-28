import { useState } from 'react';
import {
  ALLERGENEN,
  ALLERGEEN_NAAM,
  BLOEDGROEPEN,
  medischSchema,
  schoon,
  type Allergeen,
  type Medisch,
} from '@/domein/schema';
import { bewaarGegeven } from '@/data/gegevens';
import { Knop, Label } from '@/ui/basis';
import { Keuze, Tekstvak, Veld, foutenPerVeld } from '@/ui/formulier';
import { Bijlagen } from './Bijlagen';
import { Regel, nu, useVelden } from './gedeeld';

/**
 * Allergieën, medicijnen en je bloedgroep.
 *
 * De allergieën zijn een vaste lijst, dezelfde als die van de menukaart en de
 * kaarten om te tonen. Zo kan de app ze vertalen en waarschuwen bij een gerecht;
 * een allergie in vrije tekst kan dat niet. Wat niet in de lijst staat, schrijf
 * je eronder.
 */
export const MedischInhoud = ({ medisch }: { medisch?: Medisch }) => {
  const [bewerken, setBewerken] = useState(!medisch);
  return (
    <div className="grid gap-4">
      {bewerken ? (
        <MedischFormulier
          medisch={medisch}
          onKlaar={() => setBewerken(false)}
          kanAnnuleren={Boolean(medisch)}
        />
      ) : (
        medisch && (
          <div>
            <dl>
              <Regel label="Allergieën">
                {medisch.allergenen.length === 0 && !medisch.allergieOverig ? (
                  'geen opgegeven'
                ) : (
                  <span className="flex flex-wrap gap-1.5">
                    {medisch.allergenen.map((a) => (
                      <Label key={a} toon="let-op">
                        {ALLERGEEN_NAAM[a]}
                      </Label>
                    ))}
                    {medisch.allergieOverig && <span>{medisch.allergieOverig}</span>}
                  </span>
                )}
              </Regel>
              {medisch.medicatie && (
                <Regel label="Medicatie">
                  <span className="whitespace-pre-line">{medisch.medicatie}</span>
                </Regel>
              )}
              {medisch.bloedgroep && <Regel label="Bloedgroep">{medisch.bloedgroep}</Regel>}
              {medisch.notities && (
                <Regel label="Notities">
                  <span className="whitespace-pre-line">{medisch.notities}</span>
                </Regel>
              )}
            </dl>
            <div className="mt-2">
              <Knop klein onClick={() => setBewerken(true)}>
                Bewerken
              </Knop>
            </div>
          </div>
        )
      )}
      <div>
        <p className="mb-1.5 text-sm font-medium">Bijlagen</p>
        <Bijlagen
          eigenaar="medisch"
          uitleg="Een medicijnpaspoort, een recept of een verklaring van je arts."
        />
      </div>
    </div>
  );
};

const MedischFormulier = ({
  medisch,
  onKlaar,
  kanAnnuleren,
}: {
  medisch?: Medisch;
  onKlaar: () => void;
  kanAnnuleren: boolean;
}) => {
  const [allergenen, setAllergenen] = useState<Allergeen[]>(medisch?.allergenen ?? []);
  const { waarden, zet } = useVelden({
    allergieOverig: medisch?.allergieOverig ?? '',
    medicatie: medisch?.medicatie ?? '',
    bloedgroep: medisch?.bloedgroep ?? '',
    notities: medisch?.notities ?? '',
  });
  const [fouten, setFouten] = useState<Record<string, string>>({});

  const wissel = (a: Allergeen) =>
    setAllergenen((oud) => (oud.includes(a) ? oud.filter((x) => x !== a) : [...oud, a]));

  const bewaar = async () => {
    const uitkomst = medischSchema.safeParse(
      schoon({ ...waarden, allergenen, soort: 'medisch', id: 'medisch', gewijzigdOp: nu() }),
    );
    if (!uitkomst.success) {
      setFouten(foutenPerVeld(uitkomst.error));
      return;
    }
    if (await bewaarGegeven(uitkomst.data)) onKlaar();
    else setFouten({ notities: 'Bewaren lukte niet. Zit het toestel vol?' });
  };

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void bewaar();
      }}
    >
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Allergieën</legend>
        <div className="flex flex-wrap gap-1.5">
          {ALLERGENEN.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => wissel(a)}
              aria-pressed={allergenen.includes(a)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                allergenen.includes(a)
                  ? 'border-zegel bg-zegel text-white'
                  : 'border-black/10 bg-white/70 dark:border-white/15 dark:bg-nacht-diep/70'
              }`}
            >
              {ALLERGEEN_NAAM[a]}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-inkt-zacht dark:text-papier/55">
          Deze komen terug op de kaarten om te tonen en bij de menukaart.
        </p>
      </fieldset>
      <Veld label="Andere allergie" fout={fouten.allergieOverig}>
        <Tekstvak rows={2} value={waarden.allergieOverig} onChange={zet('allergieOverig')} />
      </Veld>
      <Veld label="Medicatie" fout={fouten.medicatie} uitleg="Naam, dosering en waarvoor.">
        <Tekstvak value={waarden.medicatie} onChange={zet('medicatie')} />
      </Veld>
      <Veld label="Bloedgroep" fout={fouten.bloedgroep}>
        <Keuze value={waarden.bloedgroep} onChange={zet('bloedgroep')}>
          <option value="">onbekend</option>
          {BLOEDGROEPEN.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </Keuze>
      </Veld>
      <Veld label="Notities" fout={fouten.notities}>
        <Tekstvak value={waarden.notities} onChange={zet('notities')} />
      </Veld>
      <div className="flex gap-2">
        <Knop type="submit" soort="nadruk">
          Bewaren
        </Knop>
        {kanAnnuleren && (
          <Knop soort="stil" onClick={onKlaar}>
            Annuleren
          </Knop>
        )}
      </div>
    </form>
  );
};
