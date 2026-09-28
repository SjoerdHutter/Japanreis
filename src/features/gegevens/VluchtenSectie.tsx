import { useState } from 'react';
import { Plane } from 'lucide-react';
import {
  VEEL_GEBRUIKTE_ZONES,
  schoon,
  vluchtSchema,
  type Vlucht,
  type VluchtMoment,
} from '@/domein/schema';
import { bewaarGegeven, eigenaarVan, verwijderGegeven } from '@/data/gegevens';
import { alsKorteDatum } from '@/domein/tijd/datums';
import { Kaartje, Knop } from '@/ui/basis';
import { CODE_INVOER, Invoer, Keuze, Veld, foutenPerVeld } from '@/ui/formulier';
import { Verborgen } from '@/ui/Verborgen';
import { Bijlagen } from './Bijlagen';
import { Regel, nieuweId, nu, useVelden } from './gedeeld';

/**
 * Je vluchten, met de tijdzone bij elke tijd.
 *
 * Dat laatste is geen detail. De vlucht van Hanoi naar Osaka vertrekt om kwart
 * over twaalf 's nachts in Vietnam en landt om twintig voor zeven in Japan, en
 * zonder zone valt niet na te gaan of dat klopt. De agenda export rekent er ook
 * mee.
 */

export const zoneNaam = (zone: string): string =>
  VEEL_GEBRUIKTE_ZONES.find((z) => z.zone === zone)?.naam ?? zone;

export const alsVluchtMoment = (moment: VluchtMoment): string =>
  `${alsKorteDatum(moment.datum)}${moment.tijd ? ` ${moment.tijd}` : ''}, ${zoneNaam(moment.tijdzone)}`;

export const VluchtenInhoud = ({ vluchten, openId }: { vluchten: Vlucht[]; openId?: string }) => {
  const [bewerken, setBewerken] = useState<string | null>(
    openId ?? (vluchten.length === 0 ? 'nieuw' : null),
  );

  return (
    <div className="grid gap-3">
      {vluchten.map((vlucht) =>
        bewerken === vlucht.id ? (
          <VluchtFormulier key={vlucht.id} vlucht={vlucht} onKlaar={() => setBewerken(null)} />
        ) : (
          <Kaartje key={vlucht.id} className="p-3.5">
            <div className="flex items-start gap-3">
              <Plane
                className="mt-0.5 size-5 shrink-0 text-indigo-reis dark:text-papier/70"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {vlucht.vluchtnummer}
                  {vlucht.maatschappij && (
                    <span className="font-normal text-inkt-zacht dark:text-papier/60">
                      , {vlucht.maatschappij}
                    </span>
                  )}
                </p>
                <p className="text-sm">
                  {vlucht.van} naar {vlucht.naar}
                </p>
                <dl className="mt-1">
                  <Regel label="Vertrek">{alsVluchtMoment(vlucht.vertrek)}</Regel>
                  <Regel label="Aankomst">{alsVluchtMoment(vlucht.aankomst)}</Regel>
                  {vlucht.boekingsnummer && (
                    <Regel label="Boeking">
                      <Verborgen waarde={vlucht.boekingsnummer} wat="Boekingsnummer" />
                    </Regel>
                  )}
                </dl>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                <button type="button" onClick={() => setBewerken(vlucht.id)} className="underline">
                  bewerk
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(`Vlucht ${vlucht.vluchtnummer} en zijn bijlagen verwijderen?`)
                    )
                      void verwijderGegeven(vlucht);
                  }}
                  className="text-zegel underline dark:text-zegel-licht"
                >
                  weg
                </button>
              </div>
            </div>
            <div className="mt-3 border-t border-black/5 pt-3 dark:border-white/10">
              <Bijlagen
                eigenaar={eigenaarVan(vlucht)}
                uitleg="Je e-ticket en je instapkaart."
                helder
              />
            </div>
          </Kaartje>
        ),
      )}
      {bewerken === 'nieuw' ? (
        <VluchtFormulier onKlaar={() => setBewerken(null)} kanAnnuleren={vluchten.length > 0} />
      ) : (
        <div>
          <Knop klein onClick={() => setBewerken('nieuw')}>
            Vlucht toevoegen
          </Knop>
        </div>
      )}
    </div>
  );
};

/** Een tijdzone kiezen: de drie van deze reis, of een andere. */
const ZoneKeuze = ({
  waarde,
  onWijzig,
  fout,
  label,
}: {
  waarde: string;
  onWijzig: (zone: string) => void;
  fout?: string;
  label: string;
}) => {
  const bekend = VEEL_GEBRUIKTE_ZONES.some((z) => z.zone === waarde);
  const [anders, setAnders] = useState(!bekend && waarde !== '');
  return (
    <Veld label={label} fout={fout}>
      <Keuze
        value={anders ? 'anders' : waarde}
        onChange={(e) => {
          if (e.target.value === 'anders') {
            setAnders(true);
            onWijzig('');
          } else {
            setAnders(false);
            onWijzig(e.target.value);
          }
        }}
      >
        <option value="">kies</option>
        {VEEL_GEBRUIKTE_ZONES.map((z) => (
          <option key={z.zone} value={z.zone}>
            {z.naam}
          </option>
        ))}
        <option value="anders">andere tijdzone</option>
      </Keuze>
      {anders && (
        <Invoer
          className="mt-2"
          value={waarde}
          onChange={(e) => onWijzig(e.target.value)}
          placeholder="Asia/Seoul"
          autoCapitalize="off"
          autoCorrect="off"
        />
      )}
    </Veld>
  );
};

const VluchtFormulier = ({
  vlucht,
  onKlaar,
  kanAnnuleren = true,
}: {
  vlucht?: Vlucht;
  onKlaar: () => void;
  kanAnnuleren?: boolean;
}) => {
  const { waarden, zet, setWaarden } = useVelden({
    vluchtnummer: vlucht?.vluchtnummer ?? '',
    maatschappij: vlucht?.maatschappij ?? '',
    van: vlucht?.van ?? '',
    naar: vlucht?.naar ?? '',
    vertrekDatum: vlucht?.vertrek.datum ?? '',
    vertrekTijd: vlucht?.vertrek.tijd ?? '',
    vertrekZone: vlucht?.vertrek.tijdzone ?? '',
    aankomstDatum: vlucht?.aankomst.datum ?? '',
    aankomstTijd: vlucht?.aankomst.tijd ?? '',
    aankomstZone: vlucht?.aankomst.tijdzone ?? '',
    boekingsnummer: vlucht?.boekingsnummer ?? '',
  });
  const [fouten, setFouten] = useState<Record<string, string>>({});

  const bewaar = async () => {
    const w = waarden;
    const uitkomst = vluchtSchema.safeParse(
      schoon({
        soort: 'vlucht',
        id: vlucht?.id ?? nieuweId(),
        vluchtnummer: w.vluchtnummer,
        maatschappij: w.maatschappij,
        van: w.van,
        naar: w.naar,
        vertrek: { datum: w.vertrekDatum, tijd: w.vertrekTijd, tijdzone: w.vertrekZone },
        aankomst: { datum: w.aankomstDatum, tijd: w.aankomstTijd, tijdzone: w.aankomstZone },
        boekingsnummer: w.boekingsnummer,
        gewijzigdOp: nu(),
      }),
    );
    if (!uitkomst.success) {
      setFouten(foutenPerVeld(uitkomst.error));
      return;
    }
    if (await bewaarGegeven(uitkomst.data)) onKlaar();
    else setFouten({ vluchtnummer: 'Bewaren lukte niet. Zit het toestel vol?' });
  };

  const moment = (soort: 'vertrek' | 'aankomst') => (
    <fieldset className="grid gap-2 rounded-xl bg-papier-diep/60 p-3 dark:bg-nacht/40">
      <legend className="px-1 text-sm font-medium">
        {soort === 'vertrek' ? 'Vertrek' : 'Aankomst'}
      </legend>
      {fouten[soort] && <p className="text-xs text-zegel dark:text-zegel-licht">{fouten[soort]}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Veld label="Datum" fout={fouten[`${soort}.datum`]}>
          <Invoer type="date" value={waarden[`${soort}Datum`]} onChange={zet(`${soort}Datum`)} />
        </Veld>
        <Veld label="Tijd" fout={fouten[`${soort}.tijd`]}>
          <Invoer type="time" value={waarden[`${soort}Tijd`]} onChange={zet(`${soort}Tijd`)} />
        </Veld>
      </div>
      <ZoneKeuze
        label="Tijdzone van die tijd"
        waarde={waarden[`${soort}Zone`]}
        onWijzig={(zone) => setWaarden((oud) => ({ ...oud, [`${soort}Zone`]: zone }))}
        fout={fouten[`${soort}.tijdzone`]}
      />
    </fieldset>
  );

  return (
    <form
      className="grid gap-3 rounded-2xl border border-black/10 p-3 dark:border-white/15"
      onSubmit={(e) => {
        e.preventDefault();
        void bewaar();
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <Veld label="Vluchtnummer" fout={fouten.vluchtnummer}>
          <Invoer value={waarden.vluchtnummer} onChange={zet('vluchtnummer')} {...CODE_INVOER} />
        </Veld>
        <Veld label="Maatschappij" fout={fouten.maatschappij}>
          <Invoer value={waarden.maatschappij} onChange={zet('maatschappij')} />
        </Veld>
        <Veld label="Van" fout={fouten.van}>
          <Invoer value={waarden.van} onChange={zet('van')} placeholder="AMS" />
        </Veld>
        <Veld label="Naar" fout={fouten.naar}>
          <Invoer value={waarden.naar} onChange={zet('naar')} placeholder="HAN" />
        </Veld>
      </div>
      {moment('vertrek')}
      {moment('aankomst')}
      <Veld label="Boekingsnummer" fout={fouten.boekingsnummer}>
        <Invoer value={waarden.boekingsnummer} onChange={zet('boekingsnummer')} {...CODE_INVOER} />
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
