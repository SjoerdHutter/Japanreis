import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BedDouble,
  Building2,
  ExternalLink,
  FileText,
  HeartPulse,
  Phone,
  Pill,
  ShieldAlert,
  Siren,
} from 'lucide-react';
import { ALLERGEEN_VERTALINGEN, NOOD, REISSCHEMA, STEDEN, ZINNEN } from '@/data/content';
import { appFeitId, allergeenFeitId, noodFeitId, zinFeitId } from '@/data/content/feiten';
import { useOpslag } from '@/data/db/useOpslag';
import { leesBijlagen } from '@/data/gegevens';
import { stadVolgensSchema } from '@/domein/highlight/bepaal';
import { vandaagOpReis } from '@/domein/highlight/vandaag';
import { verblijfVanNacht } from '@/domein/gegevens/orden';
import {
  ALLERGEEN_NAAM,
  telLink,
  type Bijlage,
  type Land,
  type Medisch,
  type Noodnummer,
} from '@/domein/schema';
import { BijlageWeergave } from '@/features/gegevens/BijlageWeergave';
import { useMijnGegevens } from '@/features/gegevens/gedeeld';
import { Kaartje, Knop, Label, Sectiekop } from '@/ui/basis';
import { Controleren } from '@/ui/Controleren';
import { Toonscherm } from '@/ui/Toonscherm';
import { Verborgen } from '@/ui/Verborgen';

/**
 * Het noodscherm, één tik vanaf elk scherm.
 *
 * Het land van vandaag staat vooraan: in Japan 110 en 119, in Vietnam 113 tot
 * en met 115. Daaronder wat alleen jij weet: je verzekering, wie je thuis belt,
 * je allergieën, en het adres waar je vannacht slaapt. Alles werkt zonder
 * bereik, en elk nummer is een knop die belt.
 */

const landVanVandaag = (): Land =>
  stadVolgensSchema(STEDEN, REISSCHEMA, new Date())?.stad.land ?? 'japan';

type Toonkaart =
  | { soort: 'zin'; id: string }
  | { soort: 'allergie' }
  | { soort: 'verblijf'; naam: string; adres: string };

export const NoodScherm = () => {
  const [vandaagLand] = useState<Land>(landVanVandaag);
  const [land, setLand] = useState<Land>(vandaagLand);
  const [kaart, setKaart] = useState<Toonkaart | null>(null);
  const { gegevens, geladen } = useMijnGegevens();
  const noodLand = NOOD.landen.find((l) => l.land === land) ?? NOOD.landen[0];
  const taal = land === 'japan' ? 'ja' : 'vi';

  const volgorde = [...NOOD.landen].sort((a, b) =>
    a.land === vandaagLand ? -1 : b.land === vandaagLand ? 1 : 0,
  );

  const vannacht = verblijfVanNacht(vandaagOpReis(STEDEN, REISSCHEMA), gegevens.accommodaties);
  const { verzekering, medisch, noodcontacten } = gegevens;
  const heeftAllergie = Boolean(
    medisch && (medisch.allergenen.length > 0 || medisch.allergieOverig),
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-5 pb-16">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Siren className="size-6 text-red-700 dark:text-red-400" aria-hidden />
        Nood
      </h1>
      <p className="mt-1 mb-4 text-sm text-inkt-zacht dark:text-papier/60">
        Werkt zonder bereik. Tik op een nummer om te bellen.
      </p>

      <div className="mb-5 flex gap-1.5" role="tablist" aria-label="Land">
        {volgorde.map((l) => (
          <button
            key={l.land}
            type="button"
            role="tab"
            aria-selected={land === l.land}
            onClick={() => setLand(l.land)}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${
              land === l.land
                ? 'border-zegel bg-zegel text-white'
                : 'border-black/10 bg-white/70 dark:border-white/15 dark:bg-nacht-diep/70'
            }`}
          >
            {l.naam}
            {l.land === vandaagLand && <span className="opacity-70"> (vandaag)</span>}
          </button>
        ))}
      </div>

      <section className="mb-6">
        <Sectiekop>Alarmnummers in {noodLand.naam}</Sectiekop>
        <div className="grid gap-2">
          {noodLand.nummers.map((n) => (
            <NummerKnop key={n.id} nummer={n} groot={!n.nummer.startsWith('+')} />
          ))}
        </div>
      </section>

      {geladen && (
        <section className="mb-6">
          <Sectiekop>Je verzekering</Sectiekop>
          {verzekering?.noodnummer ? (
            <Kaartje className="grid gap-3 p-4">
              <a
                href={telLink(verzekering.noodnummer)}
                className="flex items-center gap-3 rounded-xl bg-indigo-reis p-3.5 text-white"
              >
                <Phone className="size-6 shrink-0" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm opacity-80">
                    Alarmnummer {verzekering.maatschappij ?? 'verzekeraar'}
                  </span>
                  <span className="block text-xl font-semibold tabular-nums">
                    {verzekering.noodnummer}
                  </span>
                </span>
              </a>
              {verzekering.polisnummer && (
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-inkt-zacht dark:text-papier/60">Polisnummer</span>
                  <Verborgen waarde={verzekering.polisnummer} wat="Polisnummer" />
                </p>
              )}
              <PolisBijlagen />
            </Kaartje>
          ) : (
            <Kaartje className="p-4">
              <p className="mb-3 text-sm leading-relaxed">
                Het alarmnummer van je verzekeraar staat er nog niet in. Dat is het nummer dat je in
                een ziekenhuis als eerste nodig hebt.
              </p>
              <Link
                to="/gegevens?sectie=verzekering"
                className="inline-flex rounded-full bg-zegel px-4 py-2.5 font-medium text-white"
              >
                Vul je verzekering in
              </Link>
            </Kaartje>
          )}
        </section>
      )}

      <section className="mb-6">
        <Sectiekop>Toon dit</Sectiekop>
        <div className="grid grid-cols-2 gap-2">
          {noodLand.toonkaarten.map((id) => {
            const zin = ZINNEN.find((z) => z.id === id);
            if (!zin) return null;
            return (
              <ToonKnop
                key={id}
                icoon={
                  id.includes('apotheek')
                    ? Pill
                    : id.includes('ziekenhuis')
                      ? HeartPulse
                      : ShieldAlert
                }
                titel={zin.nederlands}
                onClick={() => setKaart({ soort: 'zin', id })}
              />
            );
          })}
          <ToonKnop
            icoon={FileText}
            titel={heeftAllergie ? 'Mijn allergieën' : 'Allergieën (nog niet ingevuld)'}
            onClick={() => setKaart({ soort: 'allergie' })}
          />
        </div>
      </section>

      {geladen && vannacht && (
        <section className="mb-6">
          <Sectiekop>Vannacht slaap je in</Sectiekop>
          <Kaartje className="p-4">
            <p className="flex items-center gap-2 font-medium">
              <BedDouble className="size-5 text-indigo-reis dark:text-papier/70" aria-hidden />
              {vannacht.naam}
            </p>
            {vannacht.adresLokaal ? (
              <p lang={taal} className="mt-2 text-xl leading-snug">
                {vannacht.adresLokaal}
              </p>
            ) : (
              <p className="mt-2 text-sm">
                Nog geen adres in lokaal schrift.{' '}
                <Link
                  to={`/gegevens?sectie=accommodaties&id=${vannacht.id}`}
                  className="text-zegel underline dark:text-zegel-licht"
                >
                  Vul het aan
                </Link>
              </p>
            )}
            {vannacht.adresLatijn && (
              <p className="mt-1 text-sm text-inkt-zacht dark:text-papier/60">
                {vannacht.adresLatijn}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {vannacht.telefoon && (
                <a
                  href={telLink(vannacht.telefoon)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-papier-diep px-3 py-1.5 text-sm font-medium dark:bg-nacht-diep"
                >
                  <Phone className="size-4" aria-hidden />
                  {vannacht.telefoon}
                </a>
              )}
              {vannacht.adresLokaal && (
                <Knop
                  klein
                  onClick={() =>
                    setKaart({
                      soort: 'verblijf',
                      naam: vannacht.naamLokaal ?? vannacht.naam,
                      adres: vannacht.adresLokaal!,
                    })
                  }
                >
                  Toon het adres
                </Knop>
              )}
            </div>
          </Kaartje>
        </section>
      )}

      <section className="mb-6">
        <Sectiekop>Thuis bellen</Sectiekop>
        <div className="grid gap-2">
          {geladen && noodcontacten.length === 0 && (
            <p className="text-sm">
              Nog geen noodcontacten.{' '}
              <Link
                to="/gegevens?sectie=noodcontacten"
                className="text-zegel underline dark:text-zegel-licht"
              >
                Voeg er een toe
              </Link>
            </p>
          )}
          {noodcontacten.map((c) =>
            c.telefoon ? (
              <a
                key={c.id}
                href={telLink(c.telefoon)}
                className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white/70 p-3.5 dark:border-white/10 dark:bg-nacht-diep/70"
              >
                <Phone className="size-5 shrink-0 text-zegel dark:text-zegel-licht" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {c.naam}
                    {c.relatie && <span className="font-normal opacity-70">, {c.relatie}</span>}
                  </span>
                  <span className="block text-sm tabular-nums">{c.telefoon}</span>
                </span>
              </a>
            ) : null,
          )}
          {NOOD.algemeen.map((n) => (
            <NummerKnop key={n.id} nummer={n} groot={false} />
          ))}
        </div>
      </section>

      {geladen && (
        <section className="mb-6">
          <Sectiekop
            extra={
              <Link
                to="/gegevens?sectie=medisch"
                className="text-xs text-zegel underline underline-offset-2 dark:text-zegel-licht"
              >
                bewerken
              </Link>
            }
          >
            Medische info
          </Sectiekop>
          <MedischBlok medisch={medisch} />
        </section>
      )}

      <section className="mb-6">
        <Sectiekop>Ambassade</Sectiekop>
        <Kaartje className="p-4 text-sm leading-relaxed">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <Building2 className="size-4" aria-hidden />
            {noodLand.ambassade.naam}
            <Controleren
              id={noodFeitId(noodLand.ambassade.id)}
              gecontroleerd={noodLand.ambassade.gecontroleerd}
            />
          </p>
          <p className="mt-1.5">{noodLand.ambassade.adres}</p>
          {noodLand.ambassade.adresLokaal && (
            <p lang={taal} className="text-inkt-zacht dark:text-papier/60">
              {noodLand.ambassade.adresLokaal}
            </p>
          )}
          <p className="mt-2 flex flex-wrap gap-3">
            <a
              href={telLink(noodLand.ambassade.telefoon)}
              className="font-medium text-zegel underline underline-offset-2 dark:text-zegel-licht"
            >
              {noodLand.ambassade.telefoon}
            </a>
            <a
              href={noodLand.ambassade.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-zegel underline underline-offset-2 dark:text-zegel-licht"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              netherlandsworldwide.nl
            </a>
          </p>
        </Kaartje>
      </section>

      <section>
        <Sectiekop>Aardbeving en tyfoon</Sectiekop>
        <div className="grid gap-2">
          {NOOD.rampen
            .filter((r) => r.land.includes(land))
            .map((ramp) => (
              <Kaartje key={ramp.id} className="p-4 text-sm leading-relaxed">
                <details>
                  <summary className="cursor-pointer font-medium">
                    {ramp.titel}{' '}
                    <Controleren id={noodFeitId(ramp.id)} gecontroleerd={ramp.gecontroleerd} />
                  </summary>
                  {ramp.inleiding && <p className="mt-2">{ramp.inleiding}</p>}
                  <ul className="mt-2 grid list-disc gap-1.5 pl-5">
                    {ramp.stappen.map((stap) => (
                      <li key={stap}>{stap}</li>
                    ))}
                  </ul>
                </details>
              </Kaartje>
            ))}
          {land === 'japan' && (
            <p className="text-sm">
              Installeer vooraf de app{' '}
              <Link
                to="/apps?app=safety-tips"
                className="font-medium text-zegel underline underline-offset-2 dark:text-zegel-licht"
              >
                Safety tips
              </Link>{' '}
              uit Handige apps; die waarschuwt in het Engels.{' '}
              <Controleren id={appFeitId('safety-tips')} gecontroleerd={false} />
            </p>
          )}
        </div>
      </section>

      {kaart?.soort === 'zin' && (
        <ZinKaart id={kaart.id} taal={taal} onSluit={() => setKaart(null)} />
      )}
      {kaart?.soort === 'allergie' && (
        <AllergieKaart medisch={medisch} land={land} onSluit={() => setKaart(null)} />
      )}
      {kaart?.soort === 'verblijf' && (
        <Toonscherm
          titel="Adres van vannacht"
          taal={taal}
          lokaal={
            <>
              <span className="block text-2xl text-black/70">{kaart.naam}</span>
              {kaart.adres}
            </>
          }
          nederlands="Breng me alstublieft naar dit adres."
          onSluit={() => setKaart(null)}
        />
      )}
    </div>
  );
};

const NummerKnop = ({ nummer, groot }: { nummer: Noodnummer; groot: boolean }) => (
  <div>
    <a
      href={telLink(nummer.nummer)}
      className={`flex items-center gap-3 rounded-2xl p-3.5 ${
        groot
          ? 'bg-red-700 text-white dark:bg-red-800'
          : 'border border-black/5 bg-white/70 dark:border-white/10 dark:bg-nacht-diep/70'
      }`}
    >
      <Phone className="size-6 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className={`block ${groot ? 'text-sm opacity-90' : 'font-medium'}`}>
          {nummer.naam}
        </span>
        <span className={`block tabular-nums ${groot ? 'text-3xl font-bold' : 'text-sm'}`}>
          {nummer.nummer}
        </span>
      </span>
    </a>
    {(nummer.wanneer || !nummer.gecontroleerd) && (
      <p className="mt-1 px-1 text-xs leading-relaxed text-inkt-zacht dark:text-papier/60">
        {nummer.wanneer}{' '}
        <Controleren id={noodFeitId(nummer.id)} gecontroleerd={nummer.gecontroleerd} />
      </p>
    )}
  </div>
);

const ToonKnop = ({
  icoon: Icoon,
  titel,
  onClick,
}: {
  icoon: typeof Pill;
  titel: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex min-h-24 flex-col items-start gap-1.5 rounded-2xl border border-black/5 bg-white/70 p-3.5 text-left shadow-sm dark:border-white/10 dark:bg-nacht-diep/70"
  >
    <Icoon className="size-6 text-zegel dark:text-zegel-licht" aria-hidden />
    <span className="text-sm leading-tight font-medium">{titel}</span>
  </button>
);

const PolisBijlagen = () => {
  const lader = useCallback(() => leesBijlagen('verzekering'), []);
  const { waarde: bijlagen } = useOpslag(lader, [] as Bijlage[], ['bijlagen']);
  const [open, setOpen] = useState<Bijlage | null>(null);
  if (bijlagen.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {bijlagen.map((b) => (
        <Knop key={b.id} klein onClick={() => setOpen(b)}>
          <FileText className="size-4" aria-hidden />
          {bijlagen.length === 1 ? 'Open je polis' : (b.label ?? b.naam)}
        </Knop>
      ))}
      {open && <BijlageWeergave bijlage={open} onSluit={() => setOpen(null)} />}
    </div>
  );
};

const MedischBlok = ({ medisch }: { medisch?: Medisch }) => {
  if (!medisch) {
    return (
      <p className="text-sm">
        Nog niets ingevuld.{' '}
        <Link to="/gegevens?sectie=medisch" className="text-zegel underline dark:text-zegel-licht">
          Vul je allergieën en medicijnen in
        </Link>
      </p>
    );
  }
  return (
    <Kaartje className="grid gap-2 p-4 text-sm leading-relaxed">
      <p className="flex flex-wrap items-center gap-1.5">
        <span className="text-inkt-zacht dark:text-papier/60">Allergisch voor</span>
        {medisch.allergenen.length === 0 && !medisch.allergieOverig && <span>niets opgegeven</span>}
        {medisch.allergenen.map((a) => (
          <Label key={a} toon="let-op">
            {ALLERGEEN_NAAM[a]}
          </Label>
        ))}
        {medisch.allergieOverig && <span>{medisch.allergieOverig}</span>}
      </p>
      {medisch.medicatie && (
        <p>
          <span className="text-inkt-zacht dark:text-papier/60">Medicatie: </span>
          <span className="whitespace-pre-line">{medisch.medicatie}</span>
        </p>
      )}
      {medisch.bloedgroep && (
        <p>
          <span className="text-inkt-zacht dark:text-papier/60">Bloedgroep: </span>
          {medisch.bloedgroep}
        </p>
      )}
      {medisch.notities && <p className="whitespace-pre-line">{medisch.notities}</p>}
    </Kaartje>
  );
};

const ZinKaart = ({
  id,
  taal,
  onSluit,
}: {
  id: string;
  taal: 'ja' | 'vi';
  onSluit: () => void;
}) => {
  const zin = ZINNEN.find((z) => z.id === id);
  if (!zin) return null;
  return (
    <Toonscherm
      titel={zin.nederlands}
      taal={taal}
      lokaal={zin.lokaal}
      nederlands={
        <>
          {zin.nederlands}. Uitspraak: {zin.uitspraak}.{' '}
          <Controleren id={zinFeitId(zin.id)} gecontroleerd={zin.gecontroleerd} />
        </>
      }
      onSluit={onSluit}
    />
  );
};

/**
 * De allergiekaart: een zin in de taal van het land en je allergenen eronder,
 * elk op een eigen regel en in groot schrift. Wat je zelf in vrije tekst schreef
 * staat er klein onder, want dat heeft niemand vertaald.
 */
export const AllergieKaart = ({
  medisch,
  land,
  onSluit,
}: {
  medisch?: Medisch;
  land: Land;
  onSluit: () => void;
}) => {
  const taal = land === 'japan' ? 'ja' : 'vi';
  const kop = ZINNEN.find(
    (z) => z.id === (land === 'japan' ? 'allergie-lijst-ja' : 'allergie-lijst-vn'),
  );
  const allergenen = medisch?.allergenen ?? [];
  if (allergenen.length === 0 && !medisch?.allergieOverig) {
    return (
      <Toonscherm
        titel="Allergieën"
        taal={taal}
        lokaal=""
        nederlands={
          <>
            Je hebt nog geen allergieën ingevuld.{' '}
            <Link to="/gegevens?sectie=medisch" className="text-zegel underline" onClick={onSluit}>
              Vul ze in bij Mijn gegevens
            </Link>
            .
          </>
        }
        onSluit={onSluit}
      />
    );
  }
  return (
    <Toonscherm
      titel="Mijn allergieën"
      taal={taal}
      lokaal={<span className="block text-2xl leading-snug">{kop?.lokaal}</span>}
      nederlands={
        <>
          {kop?.nederlands} Allergisch voor: {allergenen.map((a) => ALLERGEEN_NAAM[a]).join(', ')}.
          {medisch?.allergieOverig && (
            <span className="mt-2 block">
              In je eigen woorden, niet vertaald: {medisch.allergieOverig}
            </span>
          )}
        </>
      }
      onSluit={onSluit}
    >
      <ul lang={taal} className="mt-5 grid gap-3">
        {allergenen.map((a) => {
          const vertaling = ALLERGEEN_VERTALINGEN.find((v) => v.id === a);
          return (
            <li key={a} className="text-[2rem] leading-tight font-bold text-black">
              {land === 'japan' ? vertaling?.japans : vertaling?.vietnamees}
              <span className="ml-2 align-middle text-sm font-normal">
                <Controleren id={allergeenFeitId(a)} gecontroleerd={vertaling?.gecontroleerd} />
              </span>
            </li>
          );
        })}
      </ul>
    </Toonscherm>
  );
};
