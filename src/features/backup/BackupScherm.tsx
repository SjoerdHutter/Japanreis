import { useEffect, useState } from 'react';
import { Archive, ArchiveRestore, Share } from 'lucide-react';
import {
  BackupFout,
  leesBackup,
  maakBackup,
  schatBackup,
  telTerugzetting,
  zetTerug,
  type Schatting,
  type Telling,
  type Terugzetting,
} from '@/data/backup';
import { schrijf } from '@/data/db/idb';
import { deelOfDownload } from '@/data/deel';
import type { BackupOpties } from '@/domein/backup/backup';
import { alsGrootte } from '@/domein/fotos/miniatuur';
import { Melding } from '@/features/gegevens/gedeeld';
import { Kaartje, Knop, Sectiekop, Terug } from '@/ui/basis';
import { Invoer } from '@/ui/formulier';
import { OpslagStatus } from './OpslagStatus';

/**
 * Backup maken en terugzetten.
 *
 * Alles wat je in de app hebt gezet staat alleen op deze telefoon. Valt hij in
 * een rivier, of ruimt de browser de opslag op, dan is het weg. Eén zip met
 * alles erin, die je via het deelvenster in iCloud Drive zet, en die je op een
 * ander toestel weer terugzet.
 */
export const BackupScherm = () => (
  <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
    <Terug naar="/meer" />
    <h1 className="mt-1 text-2xl font-semibold tracking-tight">Backup</h1>
    <p className="mt-2 mb-5 leading-relaxed text-inkt-zacht dark:text-papier/70">
      Alles wat je in de app hebt gezet staat alleen op deze telefoon. Een backup zet het in één
      bestand, dat je in iCloud Drive of op je laptop bewaart.
    </p>
    <BackupMaken />
    <BackupTerugzetten />
    <section className="mt-8">
      <OpslagStatus />
    </section>
  </div>
);

const BackupMaken = () => {
  const [opties, setOpties] = useState<BackupOpties>({ fotos: true, documenten: true });
  const [schatting, setSchatting] = useState<Schatting | null>(null);
  const [voortgang, setVoortgang] = useState<{ klaar: number; totaal: number } | null>(null);
  const [bestand, setBestand] = useState<File | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [bewaard, setBewaard] = useState(false);

  useEffect(() => {
    let levend = true;
    void schatBackup(opties).then((s) => {
      if (levend) setSchatting(s);
    });
    return () => {
      levend = false;
    };
  }, [opties]);

  const maak = async () => {
    setFout(null);
    setBestand(null);
    setBewaard(false);
    setVoortgang({ klaar: 0, totaal: 1 });
    try {
      setBestand(await maakBackup(opties, (klaar, totaal) => setVoortgang({ klaar, totaal })));
    } catch {
      setFout('De backup lukte niet. Is er nog genoeg ruimte op de telefoon?');
    } finally {
      setVoortgang(null);
    }
  };

  // Delen mag alleen direct na een tik, dus eerst inpakken en dan pas deze knop.
  const bewaar = async () => {
    if (!bestand) return;
    const uitkomst = await deelOfDownload(bestand);
    if (uitkomst !== 'geannuleerd') {
      await schrijf('backup.laatste', new Date().toISOString());
      setBewaard(true);
    }
  };

  const zet = (deel: Partial<BackupOpties>) => {
    setOpties((oud) => ({ ...oud, ...deel }));
    setBestand(null);
  };

  return (
    <section className="mb-8">
      <Sectiekop>Backup maken</Sectiekop>
      <Kaartje className="grid gap-3 p-4">
        <fieldset className="grid gap-2 text-sm">
          <legend className="sr-only">Wat gaat erin</legend>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={opties.fotos}
              onChange={(e) => zet({ fotos: e.target.checked })}
            />
            <span>Met foto's van de fotokaart</span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={opties.documenten}
              onChange={(e) => zet({ documenten: e.target.checked })}
            />
            <span>Met persoonlijke documenten: paspoort, tickets, vouchers en andere bijlagen</span>
          </label>
        </fieldset>

        {schatting && (
          <div className="text-sm">
            <p className="font-medium">Ongeveer {alsGrootte(schatting.bytes)}</p>
            <ul className="mt-1 grid gap-0.5 text-inkt-zacht dark:text-papier/60">
              {schatting.perStore
                .filter((s) => s.aantal > 0)
                .map((s) => (
                  <li key={s.store}>
                    {s.naam} ({s.aantal}): {alsGrootte(s.bytes)}
                  </li>
                ))}
            </ul>
          </div>
        )}

        <Melding>
          Een backup bevat je polisnummer, boekingsnummers en noodcontacten. Bewaar hem op een plek
          die alleen van jou is, zoals je eigen iCloud Drive.
        </Melding>
        {opties.documenten && (
          <p className="rounded-xl bg-red-50 p-3 text-sm leading-relaxed font-medium text-red-900 dark:bg-red-950/50 dark:text-red-100">
            Met persoonlijke documenten zitten ook de foto van je paspoort en je tickets in het
            bestand. Stuur het naar niemand en zet het niet in een gedeelde map.
          </p>
        )}

        {voortgang ? (
          <p className="text-sm">
            Inpakken: {voortgang.klaar} van {voortgang.totaal}
          </p>
        ) : bestand ? (
          <div className="grid gap-2">
            <p className="text-sm">
              <span className="font-medium">{bestand.name}</span>, {alsGrootte(bestand.size)}
            </p>
            <div>
              <Knop soort="nadruk" onClick={() => void bewaar()}>
                <Share className="size-4" aria-hidden />
                Bewaar of deel
              </Knop>
            </div>
            <p className="text-xs text-inkt-zacht dark:text-papier/55">
              Kies in het deelvenster "Bewaar in Bestanden" en dan iCloud Drive.
            </p>
            {bewaard && <Melding toon="goed">Backup bewaard.</Melding>}
          </div>
        ) : (
          <div>
            <Knop soort="nadruk" onClick={() => void maak()}>
              <Archive className="size-4" aria-hidden />
              Backup maken
            </Knop>
          </div>
        )}
        {fout && <Melding>{fout}</Melding>}
      </Kaartje>
    </section>
  );
};

const BackupTerugzetten = () => {
  const [bezig, setBezig] = useState(false);
  const [terugzetting, setTerugzetting] = useState<Terugzetting | null>(null);
  const [tellingen, setTellingen] = useState<Telling[]>([]);
  const [fouten, setFouten] = useState<string[]>([]);
  const [vervangen, setVervangen] = useState(false);
  const [bevestiging, setBevestiging] = useState('');
  const [klaar, setKlaar] = useState<number | null>(null);

  const lees = async (bestand: File) => {
    setFouten([]);
    setTerugzetting(null);
    setKlaar(null);
    setVervangen(false);
    setBevestiging('');
    setBezig(true);
    try {
      const gelezen = await leesBackup(bestand);
      setTellingen(await telTerugzetting(gelezen));
      setTerugzetting(gelezen);
    } catch (fout) {
      setFouten(fout instanceof BackupFout ? fout.fouten : ['Dit bestand is niet te lezen.']);
    } finally {
      setBezig(false);
    }
  };

  const zet = async (modus: 'samenvoegen' | 'vervangen') => {
    if (!terugzetting) return;
    setBezig(true);
    try {
      setKlaar(await zetTerug(terugzetting, modus));
      setTerugzetting(null);
    } catch {
      setFouten(['Terugzetten lukte niet. Is er nog genoeg ruimte op de telefoon?']);
    } finally {
      setBezig(false);
    }
  };

  const manifest = terugzetting?.manifest;

  return (
    <section>
      <Sectiekop>Backup terugzetten</Sectiekop>
      <Kaartje className="grid gap-3 p-4">
        <p className="text-sm leading-relaxed text-inkt-zacht dark:text-papier/65">
          Kies een backup. Je ziet eerst wat erin zit; er verandert pas iets als je kiest.
        </p>
        <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-full bg-papier-diep px-3 py-1.5 text-sm font-medium dark:bg-nacht-diep">
          <ArchiveRestore className="size-4" aria-hidden />
          {bezig ? 'Bezig…' : 'Backup kiezen'}
          <input
            type="file"
            accept=".zip,application/zip"
            className="sr-only"
            disabled={bezig}
            onChange={(e) => {
              const bestand = e.target.files?.[0];
              if (bestand) void lees(bestand);
              e.target.value = '';
            }}
          />
        </label>

        {fouten.length > 0 && (
          <div className="grid gap-2">
            <Melding>Deze backup kan niet worden teruggezet:</Melding>
            <ul className="grid list-disc gap-1 pl-5 text-sm">
              {fouten.slice(0, 10).map((f) => (
                <li key={f}>{f}</li>
              ))}
              {fouten.length > 10 && <li>en nog {fouten.length - 10}</li>}
            </ul>
          </div>
        )}

        {klaar !== null && (
          <div className="grid gap-2">
            <Melding toon="goed">
              Klaar: {klaar} {klaar === 1 ? 'regel' : 'regels'} teruggezet.
            </Melding>
            <div>
              <Knop onClick={() => window.location.reload()}>App opnieuw laden</Knop>
            </div>
          </div>
        )}

        {manifest && (
          <div className="grid gap-3">
            <p className="text-sm">
              Gemaakt op{' '}
              <span className="font-medium">
                {new Date(manifest.gemaaktOp).toLocaleString('nl-NL', {
                  dateStyle: 'long',
                  timeStyle: 'short',
                })}
              </span>
              , versie {manifest.appVersie}.{!manifest.opties.fotos && " Zonder foto's."}
              {!manifest.opties.documenten && ' Zonder persoonlijke documenten.'}
            </p>
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-inkt-zacht dark:text-papier/55">
                <tr>
                  <th className="py-1 font-medium">Onderdeel</th>
                  <th className="py-1 text-right font-medium">In backup</th>
                  <th className="py-1 text-right font-medium">Nieuw</th>
                  <th className="py-1 text-right font-medium">Nieuwer</th>
                </tr>
              </thead>
              <tbody>
                {tellingen.map((t) => (
                  <tr key={t.store} className="border-t border-black/5 dark:border-white/10">
                    <td className="py-1">{t.naam}</td>
                    <td className="py-1 text-right tabular-nums">{t.inBackup}</td>
                    <td className="py-1 text-right tabular-nums">{t.nieuw}</td>
                    <td className="py-1 text-right tabular-nums">{t.nieuwer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs leading-relaxed text-inkt-zacht dark:text-papier/55">
              Samenvoegen voegt toe wat er nog niet is, en vervangt een regel alleen als die in de
              backup nieuwer is. Vervangen maakt de onderdelen die in de backup zitten eerst leeg.
            </p>

            {vervangen ? (
              <div className="grid gap-2">
                <Melding>
                  Vervangen gooit weg wat nu op dit toestel staat in{' '}
                  {tellingen.map((t) => t.naam.toLowerCase()).join(', ')}. Typ VERVANGEN om door te
                  gaan.
                </Melding>
                <Invoer
                  value={bevestiging}
                  onChange={(e) => setBevestiging(e.target.value)}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  aria-label="Typ VERVANGEN"
                />
                <div className="flex gap-2">
                  <Knop
                    soort="nadruk"
                    disabled={bevestiging !== 'VERVANGEN' || bezig}
                    onClick={() => void zet('vervangen')}
                  >
                    Vervangen
                  </Knop>
                  <Knop soort="stil" onClick={() => setVervangen(false)}>
                    Annuleren
                  </Knop>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Knop soort="nadruk" disabled={bezig} onClick={() => void zet('samenvoegen')}>
                  Samenvoegen
                </Knop>
                <Knop disabled={bezig} onClick={() => setVervangen(true)}>
                  Vervangen
                </Knop>
              </div>
            )}
          </div>
        )}
      </Kaartje>
    </section>
  );
};
