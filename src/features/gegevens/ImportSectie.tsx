import { useState } from 'react';
import { FileDown, FileUp } from 'lucide-react';
import { STEDEN } from '@/data/content';
import { bewaarGegevens } from '@/data/gegevens';
import { bewaarIn, leesReserveringen } from '@/data/db/idb';
import { meldWijziging } from '@/data/db/wijzigingen';
import { datumVoorBestand, deelOfDownload } from '@/data/deel';
import { SECTIE_NAAM, leesImport, type ImportVoorstel } from '@/domein/gegevens/importeer';
import { maakSjabloon } from '@/domein/gegevens/sjabloon';
import type { MijnGegevens } from '@/domein/gegevens/orden';
import type { Gegeven, OpgeslagenReservering } from '@/domein/schema';
import { Kaartje, Knop, Label } from '@/ui/basis';
import { Melding, nieuweId, nu } from './gedeeld';

/**
 * Invullen op je laptop, inlezen op je telefoon.
 *
 * Het sjabloon is een JSON-bestand met elk veld en een voorbeeld. Inlezen laat
 * eerst zien wat er verandert; pas na "importeren" gaat er iets de database in.
 */

const STAD_IDS = STEDEN.map((s) => s.id);

const ACTIE_TEKST = {
  nieuw: { tekst: 'nieuw', toon: 'gratis' as const },
  gewijzigd: { tekst: 'gewijzigd', toon: 'let-op' as const },
  ongewijzigd: { tekst: 'ongewijzigd', toon: 'gewoon' as const },
};

export const ImportInhoud = ({ gegevens }: { gegevens: MijnGegevens }) => {
  const [metHuidige, setMetHuidige] = useState(false);
  const [voorstel, setVoorstel] = useState<ImportVoorstel | null>(null);
  const [leesfout, setLeesfout] = useState<string | null>(null);
  const [klaar, setKlaar] = useState<number | null>(null);

  const downloadSjabloon = async () => {
    const reserveringen = metHuidige ? await leesReserveringen() : [];
    const inhoud = maakSjabloon(STAD_IDS, metHuidige ? { gegevens, reserveringen } : undefined);
    const naam = metHuidige
      ? `japanreis_gegevens_${datumVoorBestand()}.json`
      : 'japanreis_gegevens_sjabloon.json';
    await deelOfDownload(
      new File([JSON.stringify(inhoud, null, 2)], naam, { type: 'application/json' }),
    );
  };

  const leesBestand = async (bestand: File) => {
    setLeesfout(null);
    setVoorstel(null);
    setKlaar(null);
    let json: unknown;
    try {
      json = JSON.parse(await bestand.text());
    } catch {
      setLeesfout(
        'Dit bestand is geen geldige JSON. Vaak is het een komma te veel of te weinig; een JSON-controle op je laptop wijst de plek aan.',
      );
      return;
    }
    const reserveringen = await leesReserveringen();
    setVoorstel(
      leesImport(json, { gegevens, reserveringen }, { nieuweId, nu: nu(), stadIds: STAD_IDS }),
    );
  };

  const importeer = async () => {
    if (!voorstel) return;
    const teDoen = voorstel.regels.filter((r) => r.actie !== 'ongewijzigd');
    const nieuweGegevens: Gegeven[] = [];
    const nieuweReserveringen: OpgeslagenReservering[] = [];
    for (const regel of teDoen) {
      if (regel.record.soort === 'gegeven') nieuweGegevens.push(regel.record.waarde);
      else nieuweReserveringen.push(regel.record.waarde);
    }
    const gelukt =
      (await bewaarGegevens(nieuweGegevens)) &&
      (nieuweReserveringen.length === 0 ||
        (await bewaarIn('reserveringen', ...nieuweReserveringen)));
    meldWijziging('reserveringen');
    if (gelukt) {
      setKlaar(teDoen.length);
      setVoorstel(null);
    } else {
      setLeesfout('Bewaren lukte niet. Zit het toestel vol?');
    }
  };

  const wijzigingen = voorstel?.regels.filter((r) => r.actie !== 'ongewijzigd').length ?? 0;
  const metVoorbeeld = voorstel?.regels.filter((r) => r.voorbeeld).length ?? 0;

  return (
    <div className="grid gap-4">
      <div>
        <p className="mb-2 text-sm leading-relaxed text-inkt-zacht dark:text-papier/65">
          Download het sjabloon, vul het op je laptop in met je boekingsmails ernaast, en lees het
          hier weer in. Bijlagen zet je daarna in de app zelf.
        </p>
        <label className="mb-2 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={metHuidige}
            onChange={(e) => setMetHuidige(e.target.checked)}
            className="mt-1"
          />
          <span>
            Met wat ik al heb ingevuld, in plaats van voorbeelden
            {metHuidige && (
              <span className="block text-xs text-amber-800 dark:text-amber-200">
                Dit bestand bevat dan je polisnummer en boekingsnummers. Bewaar het niet op een
                gedeelde plek.
              </span>
            )}
          </span>
        </label>
        <Knop klein onClick={() => void downloadSjabloon()}>
          <FileDown className="size-4" aria-hidden />
          Sjabloon downloaden
        </Knop>
      </div>

      <div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-papier-diep px-3 py-1.5 text-sm font-medium dark:bg-nacht-diep">
          <FileUp className="size-4" aria-hidden />
          Ingevuld sjabloon inlezen
          <input
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(e) => {
              const bestand = e.target.files?.[0];
              if (bestand) void leesBestand(bestand);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {leesfout && <Melding>{leesfout}</Melding>}
      {klaar !== null && (
        <Melding toon="goed">
          {klaar === 0
            ? 'Er was niets nieuws.'
            : `${klaar} ${klaar === 1 ? 'regel' : 'regels'} bijgewerkt.`}
        </Melding>
      )}

      {voorstel && (
        <div className="grid gap-3">
          {voorstel.fouten.length > 0 ? (
            <>
              <Melding>
                Er zitten {voorstel.fouten.length}{' '}
                {voorstel.fouten.length === 1 ? 'fout' : 'fouten'} in het bestand. Er is niets
                geïmporteerd; pas ze aan en lees het opnieuw in.
              </Melding>
              <ul className="grid list-disc gap-1 pl-5 text-sm">
                {voorstel.fouten.map((fout) => (
                  <li key={fout}>{fout}</li>
                ))}
              </ul>
            </>
          ) : (
            <>
              {metVoorbeeld > 0 && (
                <Melding>
                  In {metVoorbeeld} {metVoorbeeld === 1 ? 'regel' : 'regels'} staat nog VOORBEELD.
                  Die zijn waarschijnlijk niet ingevuld.
                </Melding>
              )}
              <Kaartje className="p-3">
                <ul className="grid gap-2">
                  {voorstel.regels.map((regel, i) => (
                    <li
                      key={`${regel.sectie}-${i}`}
                      className="flex flex-wrap items-baseline gap-2 text-sm"
                    >
                      <Label toon={ACTIE_TEKST[regel.actie].toon}>
                        {ACTIE_TEKST[regel.actie].tekst}
                      </Label>
                      <span className="text-inkt-zacht dark:text-papier/60">
                        {SECTIE_NAAM[regel.sectie]}
                      </span>
                      <span className="min-w-0 font-medium">{regel.omschrijving}</span>
                      {regel.voorbeeld && <Label toon="let-op">voorbeeld</Label>}
                    </li>
                  ))}
                  {voorstel.regels.length === 0 && (
                    <li className="text-sm">Het bestand is leeg.</li>
                  )}
                </ul>
              </Kaartje>
              <div className="flex gap-2">
                <Knop soort="nadruk" disabled={wijzigingen === 0} onClick={() => void importeer()}>
                  {wijzigingen === 0 ? 'Niets te importeren' : `Importeer ${wijzigingen}`}
                </Knop>
                <Knop soort="stil" onClick={() => setVoorstel(null)}>
                  Annuleren
                </Knop>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
