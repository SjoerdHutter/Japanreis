import { useState } from 'react';
import {
  MAX_NOODCONTACTEN,
  noodcontactSchema,
  schoon,
  telLink,
  type Noodcontact,
} from '@/domein/schema';
import { bewaarGegeven, verwijderGegeven } from '@/data/gegevens';
import { Kaartje, Knop } from '@/ui/basis';
import { Invoer, Veld, foutenPerVeld } from '@/ui/formulier';
import { nieuweId, nu, useVelden } from './gedeeld';

/** Wie ze thuis moeten bellen, en wie jij belt. Hoogstens drie. */
export const ContactenInhoud = ({ contacten }: { contacten: Noodcontact[] }) => {
  const [bewerken, setBewerken] = useState<string | 'nieuw' | null>(
    contacten.length === 0 ? 'nieuw' : null,
  );

  return (
    <div className="grid gap-2">
      {contacten.map((contact) =>
        bewerken === contact.id ? (
          <ContactFormulier key={contact.id} contact={contact} onKlaar={() => setBewerken(null)} />
        ) : (
          <Kaartje key={contact.id} className="flex items-start gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {contact.naam}
                {contact.relatie && (
                  <span className="font-normal text-inkt-zacht dark:text-papier/60">
                    , {contact.relatie}
                  </span>
                )}
              </p>
              {contact.telefoon && (
                <a
                  href={telLink(contact.telefoon)}
                  className="text-sm font-medium text-zegel underline underline-offset-2 dark:text-zegel-licht"
                >
                  {contact.telefoon}
                </a>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
              <button type="button" onClick={() => setBewerken(contact.id)} className="underline">
                bewerk
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`${contact.naam} verwijderen?`))
                    void verwijderGegeven(contact);
                }}
                className="text-zegel underline dark:text-zegel-licht"
              >
                weg
              </button>
            </div>
          </Kaartje>
        ),
      )}
      {bewerken === 'nieuw' ? (
        <ContactFormulier onKlaar={() => setBewerken(null)} kanAnnuleren={contacten.length > 0} />
      ) : (
        contacten.length < MAX_NOODCONTACTEN && (
          <div>
            <Knop klein onClick={() => setBewerken('nieuw')}>
              Contact toevoegen
            </Knop>
          </div>
        )
      )}
    </div>
  );
};

const ContactFormulier = ({
  contact,
  onKlaar,
  kanAnnuleren = true,
}: {
  contact?: Noodcontact;
  onKlaar: () => void;
  kanAnnuleren?: boolean;
}) => {
  const { waarden, zet } = useVelden({
    naam: contact?.naam ?? '',
    relatie: contact?.relatie ?? '',
    telefoon: contact?.telefoon ?? '',
  });
  const [fouten, setFouten] = useState<Record<string, string>>({});

  const bewaar = async () => {
    const uitkomst = noodcontactSchema.safeParse(
      schoon({
        ...waarden,
        soort: 'noodcontact',
        id: contact?.id ?? nieuweId(),
        gewijzigdOp: nu(),
      }),
    );
    if (!uitkomst.success) {
      setFouten(foutenPerVeld(uitkomst.error));
      return;
    }
    if (await bewaarGegeven(uitkomst.data)) onKlaar();
    else setFouten({ naam: 'Bewaren lukte niet. Zit het toestel vol?' });
  };

  return (
    <form
      className="grid gap-3 rounded-2xl border border-black/10 p-3 dark:border-white/15"
      onSubmit={(e) => {
        e.preventDefault();
        void bewaar();
      }}
    >
      <Veld label="Naam" fout={fouten.naam}>
        <Invoer value={waarden.naam} onChange={zet('naam')} autoComplete="off" />
      </Veld>
      <Veld label="Relatie" fout={fouten.relatie}>
        <Invoer
          value={waarden.relatie}
          onChange={zet('relatie')}
          placeholder="partner, moeder, buurman"
        />
      </Veld>
      <Veld label="Telefoon" fout={fouten.telefoon}>
        <Invoer
          type="tel"
          inputMode="tel"
          value={waarden.telefoon}
          onChange={zet('telefoon')}
          placeholder="+31 6 0000 0000"
        />
      </Veld>
      <div className="flex gap-2">
        <Knop type="submit" soort="nadruk" klein>
          Bewaren
        </Knop>
        {kanAnnuleren && (
          <Knop soort="stil" klein onClick={onKlaar}>
            Annuleren
          </Knop>
        )}
      </div>
    </form>
  );
};
