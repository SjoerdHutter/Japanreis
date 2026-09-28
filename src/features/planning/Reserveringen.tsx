import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { QrCode } from 'lucide-react';
import { REISSCHEMA, STEDEN, stadMet } from '@/data/content';
import {
  bewaarReservering,
  leesReserveringen,
  verwijderReservering,
  type Reservering,
} from '@/data/db/idb';
import { useOpslag } from '@/data/db/useOpslag';
import { leesBijlagen } from '@/data/gegevens';
import { vandaagOpReis } from '@/domein/highlight/vandaag';
import { reserveringRecordSchema, schoon, type Bijlage } from '@/domein/schema';
import { alsKorteDatum } from '@/domein/tijd/datums';
import { datumIn } from '@/domein/tijd/zones';
import { Bijlagen } from '@/features/gegevens/Bijlagen';
import { BijlageWeergave } from '@/features/gegevens/BijlageWeergave';
import { nieuweId, nu, useVelden } from '@/features/gegevens/gedeeld';
import { Kaartje, Knop, Label, Sectiekop } from '@/ui/basis';
import { CODE_INVOER, Invoer, Keuze, Tekstvak, Veld, foutenPerVeld } from '@/ui/formulier';
import { Verborgen } from '@/ui/Verborgen';

/**
 * De reserveringsagenda: restaurants, ryokan, het Ghibli Museum en teamLab.
 *
 * Eerst stond dit als los blok in de dagplanner. Nu kan er meer bij: de tijd
 * van het bezoek, hoe laat de verkoop opengaat, het boekingsnummer, en de
 * voucher of QR-code als pdf of foto. Die opent over het hele scherm, wit en
 * helder, zodat een scanner hem bij de ingang in één keer leest, ook zonder
 * bereik.
 */
export const Reserveringen = ({ stadId }: { stadId?: string }) => {
  const { waarde: reserveringen } = useOpslag(leesReserveringen, [] as Reservering[], [
    'reserveringen',
  ]);
  const [bewerken, setBewerken] = useState<string | null>(null);

  const teRegelen = reserveringen
    .filter((r) => r.status === 'te-regelen')
    .sort((a, b) =>
      (a.verkoopVanaf ?? a.datum ?? '9').localeCompare(b.verkoopVanaf ?? b.datum ?? '9'),
    );
  const geboekt = reserveringen
    .filter((r) => r.status === 'geboekt')
    .sort((a, b) => (a.datum ?? '9').localeCompare(b.datum ?? '9'));

  const wisselStatus = (reservering: Reservering) =>
    void bewaarReservering({
      ...reservering,
      status: reservering.status === 'geboekt' ? 'te-regelen' : 'geboekt',
      gewijzigdOp: nu(),
    });

  const regel = (r: Reservering) =>
    bewerken === r.id ? (
      <ReserveringFormulier key={r.id} reservering={r} onKlaar={() => setBewerken(null)} />
    ) : (
      <ReserveringRegel
        key={r.id}
        reservering={r}
        onWissel={() => wisselStatus(r)}
        onBewerk={() => setBewerken(r.id)}
        onWeg={() => {
          if (window.confirm(`${r.wat} en de vouchers verwijderen?`))
            void verwijderReservering(r.id);
        }}
      />
    );

  return (
    <section id="reserveringen" className="scroll-mt-4">
      <Sectiekop>Reserveringen</Sectiekop>
      <p className="mb-3 text-sm leading-relaxed text-inkt-zacht dark:text-papier/65">
        Eén plek voor restaurants, ryokan, het Ghibli Museum en teamLab. Vul in wanneer de
        kaartverkoop opengaat: het Ghibli Museum verkoopt op de tiende van de maand ervoor en is
        binnen minuten weg. Je voucher of QR-code zet je erbij, dan heb je hem ook zonder bereik.{' '}
        <Link
          to="/agenda"
          className="text-zegel underline underline-offset-2 dark:text-zegel-licht"
        >
          Zet de kaartverkoop in je agenda
        </Link>
        .
      </p>

      {bewerken === 'nieuw' ? (
        <div className="mb-4">
          <ReserveringFormulier stadId={stadId} onKlaar={() => setBewerken(null)} />
        </div>
      ) : (
        <div className="mb-4">
          <Knop soort="nadruk" klein onClick={() => setBewerken('nieuw')}>
            Reservering toevoegen
          </Knop>
        </div>
      )}

      {teRegelen.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-sm font-medium">Nog te regelen</p>
          <div className="grid gap-2">{teRegelen.map(regel)}</div>
        </div>
      )}

      {geboekt.length > 0 && (
        <div>
          <p className="mb-1.5 text-sm font-medium">Geboekt</p>
          <div className="grid gap-2">{geboekt.map(regel)}</div>
        </div>
      )}

      {reserveringen.length === 0 && (
        <p className="text-sm text-inkt-zacht dark:text-papier/60">Nog niets in de agenda.</p>
      )}
    </section>
  );
};

const ReserveringRegel = ({
  reservering,
  onWissel,
  onBewerk,
  onWeg,
}: {
  reservering: Reservering;
  onWissel: () => void;
  onBewerk: () => void;
  onWeg: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [voucher, setVoucher] = useState<Bijlage | null>(null);
  const eigenaar = `reservering:${reservering.id}` as const;
  const lader = useCallback(() => leesBijlagen(eigenaar), [eigenaar]);
  const { waarde: bijlagen } = useOpslag(lader, [] as Bijlage[], ['bijlagen']);

  // Een kaartverkoop opent op een dag van de plek zelf: het Ghibli Museum op de
  // tiende in Japan, niet op de tiende thuis. Zonder stad telt waar je bent.
  const zone = stadMet(reservering.stadId ?? '')?.tijdzone;
  const vandaag = zone ? datumIn(zone, new Date()) : vandaagOpReis(STEDEN, REISSCHEMA);
  const verkoopOpen = reservering.verkoopVanaf !== undefined && reservering.verkoopVanaf <= vandaag;

  return (
    <Kaartje className="p-3">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-medium">{reservering.wat}</span>
            {reservering.datum && (
              <Label>
                {alsKorteDatum(reservering.datum)}
                {reservering.tijd && ` ${reservering.tijd}`}
              </Label>
            )}
            {reservering.status === 'geboekt' && <Label toon="gratis">geboekt</Label>}
            {reservering.verkoopVanaf && reservering.status === 'te-regelen' && (
              <Label toon={verkoopOpen ? 'let-op' : 'gewoon'}>
                {verkoopOpen
                  ? `verkoop staat open sinds ${alsKorteDatum(reservering.verkoopVanaf)}`
                  : `verkoop opent ${alsKorteDatum(reservering.verkoopVanaf)}${
                      reservering.verkoopTijd ? ` om ${reservering.verkoopTijd}` : ''
                    }`}
              </Label>
            )}
          </span>
          {reservering.stadId && (
            <span className="mt-1 block text-xs text-inkt-zacht dark:text-papier/50">
              {stadMet(reservering.stadId)?.naam ?? reservering.stadId}
              {bijlagen.length > 0 &&
                `, ${bijlagen.length} ${bijlagen.length === 1 ? 'bijlage' : 'bijlagen'}`}
            </span>
          )}
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {bijlagen.length > 0 && (
            <Knop klein soort="nadruk" onClick={() => setVoucher(bijlagen[0])}>
              <QrCode className="size-4" aria-hidden />
              Toon voucher
            </Knop>
          )}
          <Knop
            klein
            soort={reservering.status === 'geboekt' || bijlagen.length > 0 ? 'gewoon' : 'nadruk'}
            onClick={onWissel}
          >
            {reservering.status === 'geboekt' ? 'Terugzetten' : 'Geboekt'}
          </Knop>
        </div>
      </div>

      {open && (
        <div className="mt-3 grid gap-3 border-t border-black/5 pt-3 text-sm dark:border-white/10">
          {reservering.boekingsnummer && (
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-inkt-zacht dark:text-papier/60">Boekingsnummer</span>
              <Verborgen waarde={reservering.boekingsnummer} wat="Boekingsnummer" />
            </p>
          )}
          {reservering.notitie && <p className="whitespace-pre-line">{reservering.notitie}</p>}
          <Bijlagen
            eigenaar={eigenaar}
            helder
            uitleg="Voucher, QR-code of bevestiging, als pdf of foto."
          />
          <p className="flex gap-3 text-xs">
            <button type="button" onClick={onBewerk} className="underline">
              bewerk
            </button>
            <button
              type="button"
              onClick={onWeg}
              className="text-zegel underline dark:text-zegel-licht"
            >
              weg
            </button>
          </p>
        </div>
      )}

      {voucher && <BijlageWeergave bijlage={voucher} helder onSluit={() => setVoucher(null)} />}
    </Kaartje>
  );
};

const ReserveringFormulier = ({
  reservering,
  stadId,
  onKlaar,
}: {
  reservering?: Reservering;
  stadId?: string;
  onKlaar: () => void;
}) => {
  const { waarden, zet } = useVelden({
    wat: reservering?.wat ?? '',
    datum: reservering?.datum ?? '',
    tijd: reservering?.tijd ?? '',
    verkoopVanaf: reservering?.verkoopVanaf ?? '',
    verkoopTijd: reservering?.verkoopTijd ?? '',
    stadId: reservering?.stadId ?? stadId ?? '',
    boekingsnummer: reservering?.boekingsnummer ?? '',
    notitie: reservering?.notitie ?? '',
  });
  const [fouten, setFouten] = useState<Record<string, string>>({});

  const bewaar = async () => {
    const uitkomst = reserveringRecordSchema.safeParse(
      schoon({
        ...reservering,
        ...waarden,
        id: reservering?.id ?? nieuweId(),
        status: reservering?.status ?? 'te-regelen',
        gewijzigdOp: nu(),
      }),
    );
    if (!uitkomst.success) {
      setFouten(foutenPerVeld(uitkomst.error));
      return;
    }
    await bewaarReservering(uitkomst.data);
    onKlaar();
  };

  return (
    <Kaartje className="p-4">
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void bewaar();
        }}
      >
        <Veld label="Wat" fout={fouten.wat}>
          <Invoer value={waarden.wat} onChange={zet('wat')} placeholder="Ghibli Museum" />
        </Veld>
        <div className="grid grid-cols-2 gap-2">
          <Veld label="Datum van het bezoek" fout={fouten.datum}>
            <Invoer type="date" value={waarden.datum} onChange={zet('datum')} />
          </Veld>
          <Veld label="Tijd" fout={fouten.tijd}>
            <Invoer type="time" value={waarden.tijd} onChange={zet('tijd')} />
          </Veld>
          <Veld label="Kaartverkoop opent" fout={fouten.verkoopVanaf}>
            <Invoer type="date" value={waarden.verkoopVanaf} onChange={zet('verkoopVanaf')} />
          </Veld>
          <Veld label="Om" fout={fouten.verkoopTijd}>
            <Invoer type="time" value={waarden.verkoopTijd} onChange={zet('verkoopTijd')} />
          </Veld>
        </div>
        <p className="-mt-1 text-xs text-inkt-zacht dark:text-papier/55">
          Tijden in de tijdzone van de stad. Met een tijd bij de verkoop krijg je in de agenda een
          herinnering op het goede moment.
        </p>
        <Veld label="Stad" fout={fouten.stadId}>
          <Keuze value={waarden.stadId} onChange={zet('stadId')}>
            <option value="">geen</option>
            {STEDEN.map((s) => (
              <option key={s.id} value={s.id}>
                {s.naam}
              </option>
            ))}
          </Keuze>
        </Veld>
        <Veld label="Boekingsnummer" fout={fouten.boekingsnummer}>
          <Invoer
            value={waarden.boekingsnummer}
            onChange={zet('boekingsnummer')}
            {...CODE_INVOER}
          />
        </Veld>
        <Veld label="Notitie" fout={fouten.notitie}>
          <Tekstvak rows={2} value={waarden.notitie} onChange={zet('notitie')} />
        </Veld>
        <div className="flex gap-2">
          <Knop type="submit" soort="nadruk" klein>
            Bewaren
          </Knop>
          <Knop soort="stil" klein onClick={onKlaar}>
            Annuleren
          </Knop>
        </div>
      </form>
    </Kaartje>
  );
};
