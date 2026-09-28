import { useState } from 'react';
import { schoon, telLink, verzekeringSchema, type Verzekering } from '@/domein/schema';
import { bewaarGegeven } from '@/data/gegevens';
import { Knop } from '@/ui/basis';
import { CODE_INVOER, Invoer, Tekstvak, Veld, foutenPerVeld } from '@/ui/formulier';
import { Verborgen } from '@/ui/Verborgen';
import { Bijlagen } from './Bijlagen';
import { Regel, nu, useVelden } from './gedeeld';

/** Je reisverzekering: wie je belt als het misgaat, en met welk nummer. */
export const VerzekeringInhoud = ({ verzekering }: { verzekering?: Verzekering }) => {
  const [bewerken, setBewerken] = useState(!verzekering);
  return (
    <div className="grid gap-4">
      {bewerken ? (
        <VerzekeringFormulier
          verzekering={verzekering}
          onKlaar={() => setBewerken(false)}
          kanAnnuleren={Boolean(verzekering)}
        />
      ) : (
        verzekering && (
          <div>
            <dl>
              {verzekering.maatschappij && (
                <Regel label="Verzekeraar">{verzekering.maatschappij}</Regel>
              )}
              {verzekering.noodnummer && (
                <Regel label="Noodnummer">
                  <a
                    href={telLink(verzekering.noodnummer)}
                    className="font-medium text-zegel underline underline-offset-2 dark:text-zegel-licht"
                  >
                    {verzekering.noodnummer}
                  </a>
                </Regel>
              )}
              {verzekering.polisnummer && (
                <Regel label="Polisnummer">
                  <Verborgen waarde={verzekering.polisnummer} wat="Polisnummer" />
                </Regel>
              )}
              {verzekering.dekking && (
                <Regel label="Dekking">
                  <span className="whitespace-pre-line">{verzekering.dekking}</span>
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
          eigenaar="verzekering"
          uitleg="Je polisblad of de verzekeringskaart, als pdf of foto."
        />
      </div>
    </div>
  );
};

const VerzekeringFormulier = ({
  verzekering,
  onKlaar,
  kanAnnuleren,
}: {
  verzekering?: Verzekering;
  onKlaar: () => void;
  kanAnnuleren: boolean;
}) => {
  const { waarden, zet } = useVelden({
    maatschappij: verzekering?.maatschappij ?? '',
    noodnummer: verzekering?.noodnummer ?? '',
    polisnummer: verzekering?.polisnummer ?? '',
    dekking: verzekering?.dekking ?? '',
  });
  const [fouten, setFouten] = useState<Record<string, string>>({});
  const [mislukt, setMislukt] = useState(false);

  const bewaar = async () => {
    const uitkomst = verzekeringSchema.safeParse(
      schoon({ ...waarden, soort: 'verzekering', id: 'verzekering', gewijzigdOp: nu() }),
    );
    if (!uitkomst.success) {
      setFouten(foutenPerVeld(uitkomst.error));
      return;
    }
    setFouten({});
    if (await bewaarGegeven(uitkomst.data)) onKlaar();
    else setMislukt(true);
  };

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void bewaar();
      }}
    >
      <Veld label="Verzekeraar" fout={fouten.maatschappij}>
        <Invoer value={waarden.maatschappij} onChange={zet('maatschappij')} />
      </Veld>
      <Veld
        label="Noodnummer"
        fout={fouten.noodnummer}
        uitleg="Het alarmnummer voor in het buitenland, internationaal geschreven."
      >
        <Invoer
          type="tel"
          inputMode="tel"
          value={waarden.noodnummer}
          onChange={zet('noodnummer')}
          placeholder="+31 70 000 0000"
        />
      </Veld>
      <Veld label="Polisnummer" fout={fouten.polisnummer}>
        <Invoer value={waarden.polisnummer} onChange={zet('polisnummer')} {...CODE_INVOER} />
      </Veld>
      <Veld
        label="Dekking"
        fout={fouten.dekking}
        uitleg="Wat je onthouden wilt: eigen risico, wat wel en niet."
      >
        <Tekstvak value={waarden.dekking} onChange={zet('dekking')} />
      </Veld>
      {mislukt && <p className="text-sm text-zegel">Bewaren lukte niet. Zit het toestel vol?</p>}
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
