import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Download } from 'lucide-react';
import { STEDEN, laadAllePlaatsen } from '@/data/content';
import { leesReserveringen, type Reservering } from '@/data/db/idb';
import { useOpslag } from '@/data/db/useOpslag';
import { deelOfDownload, download } from '@/data/deel';
import { agendaItems, type Omvang } from '@/domein/agenda/items';
import { maakIcs, type AgendaTijd } from '@/domein/agenda/ics';
import type { Plaats } from '@/domein/schema';
import { useMijnGegevens } from '@/features/gegevens/gedeeld';
import { Kaartje, Knop, Sectiekop, Terug } from '@/ui/basis';
import { Invoer } from '@/ui/formulier';

/**
 * Naar je agenda: vluchten, in- en uitchecken, geboekte reserveringen en het
 * moment dat een kaartverkoop opent, als één .ics-bestand.
 *
 * Met een wekker op de momenten die ertoe doen: een dag en een kwartier voor de
 * kaartverkoop, drie uur voor een vlucht, een uur voor het uitchecken. Adressen
 * en boekingsnummers gaan alleen mee als je dat aanvinkt.
 */

const alsTijd = (tijd: AgendaTijd, zone?: string): string =>
  tijd.soort === 'dag'
    ? `${new Date(`${tijd.datum}T12:00:00Z`).toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      })}, hele dag`
    : new Date(tijd.utc).toLocaleString('nl-NL', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: zone,
      });

export const AgendaScherm = () => {
  const { gegevens, geladen } = useMijnGegevens();
  const { waarde: reserveringen } = useOpslag(leesReserveringen, [] as Reservering[], [
    'reserveringen',
  ]);
  const [plaatsen, setPlaatsen] = useState<Plaats[]>([]);
  const [soort, setSoort] = useState<Omvang['soort']>('alles');
  const [dag, setDag] = useState('');
  const [persoonlijk, setPersoonlijk] = useState(false);

  useEffect(() => {
    void laadAllePlaatsen().then(setPlaatsen);
  }, []);

  const omvang: Omvang =
    soort === 'dag'
      ? { soort: 'dag', datum: dag }
      : soort === 'kaartverkoop'
        ? { soort }
        : { soort: 'alles' };
  const items = useMemo(
    () => agendaItems({ gegevens, reserveringen, steden: STEDEN, plaatsen, persoonlijk, omvang }),
    // omvang is elke render een nieuw object; de onderdelen zelf staan hieronder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gegevens, reserveringen, plaatsen, persoonlijk, soort, dag],
  );

  const bestand = () =>
    new File([maakIcs(items, new Date())], 'japanreis_agenda.ics', {
      type: 'text/calendar',
    });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
      <Terug naar="/meer" />
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Naar je agenda</h1>
      <p className="mt-2 mb-5 leading-relaxed text-inkt-zacht dark:text-papier/70">
        Je vluchten, in- en uitchecken, geboekte reserveringen en de kaartverkoop als één bestand
        voor je agenda, met een herinnering op de momenten die ertoe doen.
      </p>

      <Kaartje className="mb-5 grid gap-3 p-4">
        <fieldset className="grid gap-2 text-sm">
          <legend className="mb-1 font-medium">Wat</legend>
          {(
            [
              ['alles', 'Alles'],
              ['dag', 'Eén dag'],
              ['kaartverkoop', 'Alleen de kaartverkoop'],
            ] as const
          ).map(([id, naam]) => (
            <label key={id} className="flex items-center gap-2">
              <input
                type="radio"
                name="omvang"
                checked={soort === id}
                onChange={() => setSoort(id)}
              />
              {naam}
            </label>
          ))}
          {soort === 'dag' && (
            <Invoer
              type="date"
              aria-label="Welke dag"
              value={dag}
              onChange={(e) => setDag(e.target.value)}
            />
          )}
        </fieldset>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={persoonlijk}
            onChange={(e) => setPersoonlijk(e.target.checked)}
          />
          <span>
            Persoonlijke gegevens meenemen
            <span className="block text-xs text-inkt-zacht dark:text-papier/55">
              Het adres als locatie en je boekingsnummers in de beschrijving. Een agenda wordt vaak
              gesynchroniseerd; laat dit uit als je niet zeker weet waarheen.
            </span>
          </span>
        </label>
      </Kaartje>

      <Sectiekop extra={<span className="text-xs">{items.length} afspraken</span>}>
        Wat er in komt
      </Sectiekop>
      {geladen && items.length === 0 ? (
        <p className="mb-5 text-sm text-inkt-zacht dark:text-papier/60">
          Niets om te exporteren. Vul je vluchten en verblijven in bij Mijn gegevens, of zet een
          reservering op geboekt.
        </p>
      ) : (
        <Kaartje className="mb-5 overflow-hidden">
          <ul className="divide-y divide-black/5 text-sm dark:divide-white/10">
            {items.map((item) => (
              <li key={item.uid} className="px-3.5 py-2.5">
                <span className="block font-medium">{item.titel}</span>
                <span className="block text-inkt-zacht dark:text-papier/60">
                  {alsTijd(item.begin, item.zone)}
                  {item.alarmen.length > 0 && ', met herinnering'}
                </span>
              </li>
            ))}
          </ul>
        </Kaartje>
      )}

      <div className="flex flex-wrap gap-2">
        <Knop
          soort="nadruk"
          disabled={items.length === 0}
          onClick={() => void deelOfDownload(bestand())}
        >
          <CalendarPlus className="size-4" aria-hidden />
          Deel met je agenda
        </Knop>
        <Knop
          disabled={items.length === 0}
          onClick={() => download(bestand(), 'japanreis_agenda.ics')}
        >
          <Download className="size-4" aria-hidden />
          Als bestand
        </Knop>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-inkt-zacht dark:text-papier/55">
        Op een iPhone: staat Agenda niet in het deelvenster, kies dan "Als bestand" en tik in het
        voorbeeld op "Voeg alles toe". De tijden staan in UTC in het bestand; je agenda zet ze om
        naar waar je bent. Exporteer je opnieuw, dan hebben de afspraken dezelfde id; niet elke
        agenda werkt ze dan bij, sommige zetten ze er dubbel in.
      </p>
    </div>
  );
};
