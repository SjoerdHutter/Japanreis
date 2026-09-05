import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { STEDEN, VERVOER, stadMet } from '@/data/content';
import { useApp } from '@/state/useApp';
import { Kaartje, Knop, Label, Sectiekop } from '@/ui/basis';
import { formatteerBedrag } from '@/domein/valuta/formatteer';
import { rekenAlles, reistijdMinuten, type GekozenRit } from '@/domein/vervoer/jrpass';

/**
 * De JR Pass rekentool uit hoofdstuk 10.
 *
 * Je vinkt je ritten aan en de app zegt of de pas zich terugverdient, in beide
 * valuta. Dat is nuttiger dan het klinkt: sinds de prijsverhoging van 2023 kan
 * de pas op een gewone route van twee weken vaak niet meer uit, terwijl vrijwel
 * elke reisgids hem nog als vanzelfsprekend aanraadt.
 *
 * De uitkomst staat er als indicatie bij, en dat is geen slag om de arm maar
 * een feit: de prijzen staan in de app en die verouderen.
 */
export const VervoerScherm = () => {
  const { koersen } = useApp();
  const [aantallen, setAantallen] = useState<Record<string, number>>({});

  const sleutel = (van: string, naar: string) => `${van}>${naar}`;

  const ritten = useMemo<GekozenRit[]>(
    () =>
      VERVOER.trajecten
        .map((traject) => ({
          traject,
          aantal: aantallen[sleutel(traject.van, traject.naar)] ?? 0,
        }))
        .filter((rit) => rit.aantal > 0),
    [aantallen],
  );

  const uitkomsten = useMemo(
    () => (ritten.length > 0 ? rekenAlles(ritten, VERVOER.passen) : []),
    [ritten],
  );

  const beste = uitkomsten[0];
  const minuten = reistijdMinuten(ritten);
  const uren = Math.floor(minuten / 60);

  const wijzig = (van: string, naar: string, stap: number) => {
    const s = sleutel(van, naar);
    setAantallen((oud) => {
      const nieuw = Math.max(0, (oud[s] ?? 0) + stap);
      return { ...oud, [s]: nieuw };
    });
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
      <Link to="/" className="text-sm text-zegel underline underline-offset-2">
        Alle steden
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Vervoer en JR Pass</h1>
      <p className="mt-2 mb-5 leading-relaxed text-inkt-zacht dark:text-papier/70">
        Vink je ritten aan; heen en terug telt als twee. De app rekent uit of een pas zich
        terugverdient.
      </p>

      <Sectiekop>Je ritten</Sectiekop>
      <div className="mb-6 grid gap-2">
        {VERVOER.trajecten.map((traject) => {
          const aantal = aantallen[sleutel(traject.van, traject.naar)] ?? 0;
          return (
            <Kaartje key={sleutel(traject.van, traject.naar)} className="p-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {stadMet(traject.van)?.naam ?? traject.van} naar{' '}
                    {stadMet(traject.naar)?.naam ?? traject.naar}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    <Label>{formatteerBedrag(traject.enkeleReis, koersen)}</Label>
                    <Label>
                      {Math.floor(traject.minuten / 60)}u {traject.minuten % 60}m
                    </Label>
                  </p>
                  {traject.opmerking && (
                    <p className="mt-1.5 text-xs leading-relaxed text-inkt-zacht dark:text-papier/55">
                      {traject.opmerking}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Knop
                    klein
                    soort="stil"
                    disabled={aantal === 0}
                    onClick={() => wijzig(traject.van, traject.naar, -1)}
                  >
                    –
                  </Knop>
                  <span className="w-5 text-center tabular-nums">{aantal}</span>
                  <Knop klein soort="gewoon" onClick={() => wijzig(traject.van, traject.naar, 1)}>
                    +
                  </Knop>
                </div>
              </div>
            </Kaartje>
          );
        })}
      </div>

      {ritten.length === 0 ? (
        <p className="text-sm text-inkt-zacht dark:text-papier/60">
          Vink hierboven ritten aan om de rekensom te zien.
        </p>
      ) : (
        <section className="mb-6">
          <Sectiekop
            extra={
              <span className="text-xs text-inkt-zacht dark:text-papier/50">
                {ritten.reduce((t, r) => t + r.aantal, 0)} ritten, {uren}u {minuten % 60}m reistijd
              </span>
            }
          >
            De rekensom
          </Sectiekop>

          <Kaartje className="mb-3 p-4">
            <p className="text-sm text-inkt-zacht dark:text-papier/70">Losse kaartjes samen</p>
            <p className="mt-0.5 text-xl font-semibold">
              {formatteerBedrag(beste.losseKaartjes, koersen)}
            </p>
          </Kaartje>

          <div className="grid gap-2">
            {uitkomsten.map((uitkomst) => (
              <Kaartje
                key={uitkomst.pas.id}
                className={`p-3.5 ${uitkomst.loont ? 'ring-1 ring-emerald-500/40' : ''}`}
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-medium">{uitkomst.pas.naam}</span>
                  <Label>{formatteerBedrag(uitkomst.pas.prijs, koersen)}</Label>
                  {uitkomst.loont ? (
                    <Label toon="gratis">verdient zich terug</Label>
                  ) : (
                    <Label toon="let-op">kan niet uit</Label>
                  )}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-inkt-zacht dark:text-papier/70">
                  {uitkomst.loont
                    ? `Je bespaart ${formatteerBedrag(uitkomst.verschil, koersen)} op deze ritten.`
                    : `Je komt ${formatteerBedrag(uitkomst.tekort!, koersen)} tekort. Met deze ritten zijn losse kaartjes goedkoper.`}
                </p>
              </Kaartje>
            ))}
          </div>

          <p className="mt-3 text-xs leading-relaxed text-inkt-zacht dark:text-papier/50">
            Indicatief, met de prijzen die in <code>data/vervoer.yaml</code> staan. De JR Pass werd
            in oktober 2023 in één keer ongeveer zeventig procent duurder en losse kaartjes stijgen
            ook; controleer beide voordat je boekt.
          </p>
        </section>
      )}

      <section>
        <Sectiekop>IC-kaarten</Sectiekop>
        <Kaartje className="p-4 text-sm leading-relaxed">
          <p>
            Suica en Pasmo zijn hetzelfde soort kaart en werken door elkaar heen. Je tikt ermee door
            de poortjes van vrijwel elk stedelijk net, en betaalt er in konbini, automaten en veel
            winkels mee. Zet er een in je telefoon voordat je vertrekt; opwaarderen gaat dan
            rechtstreeks vanaf je toestel in plaats van bij een automaat.
          </p>
          <p className="mt-2">
            <strong className="font-medium">Waar ze niet werken:</strong> op de Shinkansen zelf koop
            je een apart kaartje, en in bergstreken en op kleine private lijnen kom je nog automaten
            tegen die alleen munten willen. In Vietnam bestaat dit systeem niet; daar is het contant
            of Grab.
          </p>
          <p className="mt-2">
            De {STEDEN.filter((s) => s.land === 'japan').length} Japanse steden in deze app liggen
            allemaal aan een net waar een IC-kaart werkt.
          </p>
        </Kaartje>
      </section>
    </div>
  );
};
