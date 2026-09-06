import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Coordinaat, Plaats, Stad } from '@/domein/schema';
import { useApp } from '@/state/useApp';
import { Kaartje, Knop, Label } from '@/ui/basis';
import { formatteerPrijs } from '@/domein/valuta/formatteer';
import { looptijdMinuten } from '@/domein/filters/plaatsen';
import { nuOpen, sluitingswaarschuwing, waarschuwingstekst } from '@/domein/openingstijden/status';
import { tijdlijnVan } from '@/data/content';

/**
 * Eén punt in de lijst, dichtgeklapt tot je erop tikt.
 *
 * De labels bovenaan zijn wat je in één blik moet kunnen zien: wat het is, wat
 * het kost en of er iets aan de hand is. De waarschuwing over sluitingsdagen
 * staat er met opzet tussen en niet verstopt in het uitklapdeel; een museum dat
 * vandaag dicht is hoort je te bereiken voordat je erheen loopt.
 *
 * Vanaf hier zijn de historische context en de stempelinformatie allebei in één
 * tik bereikbaar, wat samen met het tijdlijnscherm de twee tikken oplevert die
 * hoofdstuk 4 vraagt.
 */
export const PlaatsRegel = ({
  plaats,
  stad,
  vanaf,
}: {
  plaats: Plaats;
  stad: Stad;
  /** Vertrekpunt voor de looptijd; meestal je eigen locatie. */
  vanaf?: Coordinaat | null;
}) => {
  const { koersen } = useApp();
  const [open, setOpen] = useState(false);

  const waarschuwing = sluitingswaarschuwing(plaats, stad);
  const openNu = nuOpen(plaats, stad);
  const lopen = vanaf ? looptijdMinuten(vanaf, plaats.coordinaten) : null;
  const tijdlijn = tijdlijnVan(stad);
  const tijdvakken = (plaats.tijdvakken ?? [])
    .map((id) => tijdlijn?.tijdvakken.find((v) => v.id === id))
    .filter((v) => v !== undefined);

  return (
    <Kaartje className="p-3.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 text-left"
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium">{plaats.naam}</span>
            {plaats.naamLokaal && (
              <span className="text-xs text-inkt-zacht dark:text-papier/50">
                {plaats.naamLokaal}
              </span>
            )}
          </span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {plaats.attractie && <Label>{plaats.attractie.type}</Label>}
            {plaats.eten && <Label>{plaats.eten.keuken.replace('-', ' en ')}</Label>}
            {plaats.prijs === 'gratis' ? (
              <Label toon="gratis">gratis</Label>
            ) : (
              plaats.prijs && <Label>{formatteerPrijs(plaats.prijs, koersen)}</Label>
            )}
            {plaats.attractie?.bezoekduurMinuten && (
              <Label>{plaats.attractie.bezoekduurMinuten} min</Label>
            )}
            {lopen !== null && <Label>{lopen} min lopen</Label>}
            {openNu === true && <Label toon="gratis">nu open</Label>}
            {openNu === false && !waarschuwing?.vandaagGesloten && <Label>nu dicht</Label>}
            {waarschuwing && (
              <Label toon={waarschuwing.vandaagGesloten ? 'let-op' : 'gewoon'}>
                {waarschuwingstekst(waarschuwing)}
              </Label>
            )}
            {plaats.eten?.ontbijt && <Label>ontbijt</Label>}
            {plaats.eten?.lateNight && <Label>late night</Label>}
            {plaats.eten?.moeite === 'waardig-een-omweg' && <Label>een omweg waard</Label>}
            {plaats.reservering === 'verplicht' && (
              <Label toon="let-op">reserveren verplicht</Label>
            )}
            {(plaats.ekiStempel || plaats.goshuin) && (
              <Label>{plaats.ekiStempel ? 'eki stamp' : 'goshuin'}</Label>
            )}
            {plaats.tags?.includes('google-maps-lijst') && <Label>op je lijst</Label>}
          </span>
        </span>
        <span aria-hidden className="pt-1 text-inkt-zacht">
          {open ? '–' : '+'}
        </span>
      </button>

      {open && (
        <div className="mt-3 border-t border-black/5 pt-3 text-sm leading-relaxed dark:border-white/10">
          {plaats.beschrijving && <p>{plaats.beschrijving}</p>}

          {plaats.openingstijden && (
            <Regel titel="Open">
              {plaats.openingstijden.standaard ?? 'wisselend'}
              {plaats.openingstijden.laatsteToegang &&
                `, laatste toegang ${plaats.openingstijden.laatsteToegang}`}
              {plaats.openingstijden.opmerking && `. ${plaats.openingstijden.opmerking}`}
            </Regel>
          )}

          {waarschuwing && waarschuwing.sluitingsdagen.length > 0 && (
            <Regel titel="Gesloten">
              Elke {waarschuwing.sluitingsdagen.join(' en ')}.
              {waarschuwing.vandaagGesloten && ' Dat is vandaag.'}
            </Regel>
          )}

          {waarschuwing?.opmerking && <Regel titel="Let op">{waarschuwing.opmerking}</Regel>}

          {plaats.attractie?.drukte?.besteMoment && (
            <Regel titel="Beste moment">{plaats.attractie.drukte.besteMoment}</Regel>
          )}
          {plaats.attractie?.drukte?.drukstMoment && (
            <Regel titel="Drukst">{plaats.attractie.drukte.drukstMoment}</Regel>
          )}

          {plaats.reservering && plaats.reservering !== 'niet-nodig' && (
            <Regel titel="Reserveren">
              {plaats.reservering === 'verplicht' ? 'Verplicht' : 'Aanbevolen'}. De
              reserveringsagenda komt in een latere fase.
            </Regel>
          )}

          {plaats.adres && <Regel titel="Adres">{plaats.adres}</Regel>}

          {plaats.coordinaatGeschat && (
            <Regel titel="Pin">
              Wijst het huizenblok aan en niet de deur, dus hij kan er honderd meter naast zitten.
              Het adres hierboven klopt wel. Een Japans adres is nu eenmaal een wijk met een
              bloknummer en geen straat met een huisnummer.
            </Regel>
          )}

          {plaats.ekiStempel && <Regel titel="Eki stamp">{plaats.ekiStempel.waar}</Regel>}

          {plaats.goshuin && (
            <Regel titel="Goshuin">
              {plaats.goshuin.waar}
              {plaats.goshuin.prijs && `, ${formatteerPrijs(plaats.goshuin.prijs, koersen)}`}
              {plaats.goshuin.openingstijden?.standaard && (
                <>
                  {'. Het stempelkantoor is open '}
                  {plaats.goshuin.openingstijden.standaard}
                  {', vaak korter dan de tempel zelf.'}
                </>
              )}
              {plaats.goshuin.alleenVoorgeschreven &&
                ' Alleen een voorgeschreven vel, geen kalligrafie.'}
            </Regel>
          )}

          {tijdvakken.length > 0 && tijdlijn && (
            <div className="mt-3">
              <span className="mr-2 text-xs font-medium tracking-wide text-inkt-zacht uppercase dark:text-papier/55">
                Tijdvak
              </span>
              <span className="inline-flex flex-wrap gap-1.5 align-middle">
                {tijdvakken.map((v) => (
                  <Link
                    key={v.id}
                    to={`/tijdlijn/${tijdlijn.id}#${v.id}`}
                    className="rounded-full bg-papier-diep px-2 py-0.5 text-xs font-medium text-inkt underline-offset-2 hover:underline dark:bg-nacht-diep dark:text-papier"
                  >
                    {v.naam} {v.van}
                    {v.tot ? ` tot ${v.tot}` : ' tot nu'}
                  </Link>
                ))}
              </span>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Knop
              klein
              soort="stil"
              onClick={() =>
                window.open(
                  `https://www.google.com/maps/search/?api=1&query=${plaats.coordinaten.lat},${plaats.coordinaten.lon}`,
                  '_blank',
                  'noopener',
                )
              }
            >
              Route in Google Maps
            </Knop>
            {plaats.bronnen?.map((bron) =>
              bron.url ? (
                <a
                  key={bron.naam}
                  href={bron.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-center text-xs text-zegel underline underline-offset-2"
                >
                  {bron.naam}
                </a>
              ) : null,
            )}
          </div>

          <p className="mt-3 text-xs text-inkt-zacht/70 dark:text-papier/40">
            {plaats.adres ? `${plaats.adres} · ` : ''}
            {plaats.coordinaten.lat.toFixed(4)}, {plaats.coordinaten.lon.toFixed(4)}
          </p>
        </div>
      )}
    </Kaartje>
  );
};

const Regel = ({ titel, children }: { titel: string; children: React.ReactNode }) => (
  <p className="mt-2 text-inkt-zacht dark:text-papier/65">
    <strong className="font-medium text-inkt dark:text-papier">{titel}:</strong> {children}
  </p>
);
