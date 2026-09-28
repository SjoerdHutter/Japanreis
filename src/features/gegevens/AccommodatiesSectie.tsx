import { useState } from 'react';
import { BedDouble } from 'lucide-react';
import {
  accommodatieSchema,
  schoon,
  telLink,
  type Accommodatie,
  type Coordinaat,
  type DagMetTijd,
} from '@/domein/schema';
import { STEDEN, stadMet } from '@/data/content';
import { bewaarGegeven, eigenaarVan, verwijderGegeven } from '@/data/gegevens';
import { alsKorteDatum } from '@/domein/tijd/datums';
import { Kaart } from '@/features/kaart/Kaart';
import { Kaartje, Knop } from '@/ui/basis';
import { CODE_INVOER, Invoer, Keuze, Veld, foutenPerVeld } from '@/ui/formulier';
import { Verborgen } from '@/ui/Verborgen';
import { Bijlagen } from './Bijlagen';
import { Regel, nieuweId, nu, useVelden } from './gedeeld';

/**
 * Waar je slaapt, met het adres zoals een taxichauffeur het leest.
 *
 * Een Japans adres in het Latijnse schrift zegt een chauffeur weinig; in het
 * Japans kan hij het in zijn navigatie tikken. Daarom twee adresvelden. Het
 * terugstation is het station waar je 's avonds heen moet, voor de
 * waarschuwing over de laatste trein.
 */

export const alsDagMetTijd = (moment: DagMetTijd): string =>
  `${alsKorteDatum(moment.datum)}${moment.tijd ? ` om ${moment.tijd}` : ''}`;

export interface Voorinvulling {
  stadId: string;
  van: string;
  tot: string;
}

export const AccommodatiesInhoud = ({
  accommodaties,
  openId,
  voorinvulling,
}: {
  accommodaties: Accommodatie[];
  openId?: string;
  voorinvulling?: Voorinvulling;
}) => {
  const [bewerken, setBewerken] = useState<string | null>(
    openId ?? (voorinvulling || accommodaties.length === 0 ? 'nieuw' : null),
  );

  return (
    <div className="grid gap-3">
      {accommodaties.map((verblijf) =>
        bewerken === verblijf.id ? (
          <VerblijfFormulier
            key={verblijf.id}
            verblijf={verblijf}
            onKlaar={() => setBewerken(null)}
          />
        ) : (
          <Kaartje key={verblijf.id} className="p-3.5">
            <div className="flex items-start gap-3">
              <BedDouble
                className="mt-0.5 size-5 shrink-0 text-indigo-reis dark:text-papier/70"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {verblijf.naam}
                  {verblijf.naamLokaal && (
                    <span className="ml-1.5 font-normal text-inkt-zacht dark:text-papier/60">
                      {verblijf.naamLokaal}
                    </span>
                  )}
                </p>
                <p className="text-sm text-inkt-zacht dark:text-papier/60">
                  {stadMet(verblijf.stadId)?.naam ?? verblijf.stadId}
                </p>
                <dl className="mt-1">
                  <Regel label="Incheck">{alsDagMetTijd(verblijf.incheck)}</Regel>
                  <Regel label="Uitcheck">{alsDagMetTijd(verblijf.uitcheck)}</Regel>
                  {verblijf.adresLokaal && (
                    <Regel label="Adres lokaal">
                      <span className="text-base">{verblijf.adresLokaal}</span>
                    </Regel>
                  )}
                  {verblijf.adresLatijn && <Regel label="Adres">{verblijf.adresLatijn}</Regel>}
                  {(verblijf.station || verblijf.uitgang) && (
                    <Regel label="Station">
                      {[verblijf.station, verblijf.uitgang].filter(Boolean).join(', ')}
                    </Regel>
                  )}
                  {verblijf.terugstation && (
                    <Regel label="Terugstation">{verblijf.terugstation}</Regel>
                  )}
                  {verblijf.telefoon && (
                    <Regel label="Telefoon">
                      <a
                        href={telLink(verblijf.telefoon)}
                        className="font-medium text-zegel underline underline-offset-2 dark:text-zegel-licht"
                      >
                        {verblijf.telefoon}
                      </a>
                    </Regel>
                  )}
                  {verblijf.boekingsnummer && (
                    <Regel label="Boeking">
                      <Verborgen waarde={verblijf.boekingsnummer} wat="Boekingsnummer" />
                    </Regel>
                  )}
                  <Regel label="Op de kaart">{verblijf.coordinaten ? 'ja' : 'nog niet'}</Regel>
                </dl>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setBewerken(verblijf.id)}
                  className="underline"
                >
                  bewerk
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`${verblijf.naam} en de bijlagen verwijderen?`))
                      void verwijderGegeven(verblijf);
                  }}
                  className="text-zegel underline dark:text-zegel-licht"
                >
                  weg
                </button>
              </div>
            </div>
            <div className="mt-3 border-t border-black/5 pt-3 dark:border-white/10">
              <Bijlagen
                eigenaar={eigenaarVan(verblijf)}
                uitleg="De bevestiging, als pdf of foto."
              />
            </div>
          </Kaartje>
        ),
      )}
      {bewerken === 'nieuw' ? (
        <VerblijfFormulier
          voorinvulling={voorinvulling}
          onKlaar={() => setBewerken(null)}
          kanAnnuleren={accommodaties.length > 0}
        />
      ) : (
        <div>
          <Knop klein onClick={() => setBewerken('nieuw')}>
            Accommodatie toevoegen
          </Knop>
        </div>
      )}
    </div>
  );
};

const VerblijfFormulier = ({
  verblijf,
  voorinvulling,
  onKlaar,
  kanAnnuleren = true,
}: {
  verblijf?: Accommodatie;
  voorinvulling?: Voorinvulling;
  onKlaar: () => void;
  kanAnnuleren?: boolean;
}) => {
  const { waarden, zet } = useVelden({
    naam: verblijf?.naam ?? '',
    naamLokaal: verblijf?.naamLokaal ?? '',
    adresLokaal: verblijf?.adresLokaal ?? '',
    adresLatijn: verblijf?.adresLatijn ?? '',
    stadId: verblijf?.stadId ?? voorinvulling?.stadId ?? '',
    incheckDatum: verblijf?.incheck.datum ?? voorinvulling?.van ?? '',
    incheckTijd: verblijf?.incheck.tijd ?? '',
    uitcheckDatum: verblijf?.uitcheck.datum ?? voorinvulling?.tot ?? '',
    uitcheckTijd: verblijf?.uitcheck.tijd ?? '',
    telefoon: verblijf?.telefoon ?? '',
    station: verblijf?.station ?? '',
    uitgang: verblijf?.uitgang ?? '',
    terugstation: verblijf?.terugstation ?? '',
    boekingsnummer: verblijf?.boekingsnummer ?? '',
  });
  const [coordinaten, setCoordinaten] = useState<Coordinaat | undefined>(verblijf?.coordinaten);
  const [kaartOpen, setKaartOpen] = useState(false);
  const [fouten, setFouten] = useState<Record<string, string>>({});
  const stad = stadMet(waarden.stadId);

  const bewaar = async () => {
    const w = waarden;
    const uitkomst = accommodatieSchema.safeParse(
      schoon({
        soort: 'accommodatie',
        id: verblijf?.id ?? nieuweId(),
        naam: w.naam,
        naamLokaal: w.naamLokaal,
        adresLokaal: w.adresLokaal,
        adresLatijn: w.adresLatijn,
        stadId: w.stadId,
        incheck: { datum: w.incheckDatum, tijd: w.incheckTijd },
        uitcheck: { datum: w.uitcheckDatum, tijd: w.uitcheckTijd },
        telefoon: w.telefoon,
        station: w.station,
        uitgang: w.uitgang,
        terugstation: w.terugstation,
        boekingsnummer: w.boekingsnummer,
        coordinaten,
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
        <Invoer value={waarden.naam} onChange={zet('naam')} />
      </Veld>
      <Veld label="Naam in lokaal schrift" fout={fouten.naamLokaal}>
        <Invoer value={waarden.naamLokaal} onChange={zet('naamLokaal')} lang="ja" />
      </Veld>
      <Veld label="Stad" fout={fouten.stadId}>
        <Keuze value={waarden.stadId} onChange={zet('stadId')}>
          <option value="">kies</option>
          {STEDEN.map((s) => (
            <option key={s.id} value={s.id}>
              {s.naam}
            </option>
          ))}
        </Keuze>
      </Veld>
      <div className="grid grid-cols-2 gap-2">
        <Veld label="Incheck" fout={fouten['incheck.datum'] ?? fouten.incheck}>
          <Invoer type="date" value={waarden.incheckDatum} onChange={zet('incheckDatum')} />
        </Veld>
        <Veld label="Vanaf" fout={fouten['incheck.tijd']}>
          <Invoer type="time" value={waarden.incheckTijd} onChange={zet('incheckTijd')} />
        </Veld>
        <Veld label="Uitcheck" fout={fouten['uitcheck.datum'] ?? fouten.uitcheck}>
          <Invoer type="date" value={waarden.uitcheckDatum} onChange={zet('uitcheckDatum')} />
        </Veld>
        <Veld label="Uiterlijk" fout={fouten['uitcheck.tijd']}>
          <Invoer type="time" value={waarden.uitcheckTijd} onChange={zet('uitcheckTijd')} />
        </Veld>
      </div>
      <Veld
        label="Adres in lokaal schrift"
        fout={fouten.adresLokaal}
        uitleg="In het Japans of Vietnamees, zoals in de bevestiging. Dit laat je aan een taxichauffeur zien."
      >
        <Invoer value={waarden.adresLokaal} onChange={zet('adresLokaal')} lang="ja" />
      </Veld>
      <Veld label="Adres in Latijns schrift" fout={fouten.adresLatijn}>
        <Invoer value={waarden.adresLatijn} onChange={zet('adresLatijn')} />
      </Veld>
      <Veld label="Telefoon" fout={fouten.telefoon}>
        <Invoer
          type="tel"
          inputMode="tel"
          value={waarden.telefoon}
          onChange={zet('telefoon')}
          placeholder="+81 75 000 0000"
        />
      </Veld>
      <div className="grid grid-cols-2 gap-2">
        <Veld label="Dichtstbijzijnde station" fout={fouten.station}>
          <Invoer value={waarden.station} onChange={zet('station')} />
        </Veld>
        <Veld label="Uitgang" fout={fouten.uitgang}>
          <Invoer value={waarden.uitgang} onChange={zet('uitgang')} />
        </Veld>
      </div>
      <Veld
        label="Terugstation"
        fout={fouten.terugstation}
        uitleg="Waar je 's avonds met de trein naartoe moet. Hiermee waarschuwt de dagplanner voor de laatste trein."
      >
        <Invoer value={waarden.terugstation} onChange={zet('terugstation')} />
      </Veld>
      <Veld label="Boekingsnummer" fout={fouten.boekingsnummer}>
        <Invoer value={waarden.boekingsnummer} onChange={zet('boekingsnummer')} {...CODE_INVOER} />
      </Veld>

      <div>
        <p className="mb-1.5 text-sm font-medium">Plek op de kaart</p>
        <p className="mb-2 text-xs leading-relaxed text-inkt-zacht dark:text-papier/55">
          {coordinaten
            ? `Staat op ${coordinaten.lat.toFixed(4)}, ${coordinaten.lon.toFixed(4)}.`
            : 'Nog geen plek. Met een plek toont de taxikaart een pin en rekent de app looptijden uit.'}
        </p>
        {stad ? (
          kaartOpen ? (
            <>
              <Kaart
                punten={
                  coordinaten
                    ? [
                        {
                          id: 'verblijf',
                          naam: waarden.naam || 'Verblijf',
                          coordinaten,
                          laag: 'eigen',
                        },
                      ]
                    : []
                }
                gebied={stad.kaartgebied}
                hoogte="16rem"
                clusteren={false}
                onTikOpKaart={setCoordinaten}
              />
              <p className="mt-1 text-xs text-inkt-zacht dark:text-papier/55">
                Tik op de kaart waar het verblijf is.
              </p>
            </>
          ) : (
            <Knop klein onClick={() => setKaartOpen(true)}>
              {coordinaten ? 'Plek wijzigen' : 'Plek aanwijzen'}
            </Knop>
          )
        ) : (
          <p className="text-xs text-inkt-zacht dark:text-papier/55">Kies eerst een stad.</p>
        )}
        {coordinaten && (
          <button
            type="button"
            onClick={() => setCoordinaten(undefined)}
            className="mt-1 ml-2 text-xs underline"
          >
            plek wissen
          </button>
        )}
      </div>

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
