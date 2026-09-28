import { useState } from 'react';
import { STEDEN, stadMet } from '@/data/content';
import { Kaartje, Label, Terug } from '@/ui/basis';
import {
  MAX_VOORBEREIDING,
  dagVanVandaag,
  type Jetlagdag,
  type Jetlagplan,
} from '@/domein/jetlag/protocol';
import { datumIn } from '@/domein/tijd/zones';
import { useJetlag } from './useJetlag';
import { alsDagLabel, alsUren, plekVan, regelsVan, type Regel } from './tekst';

/**
 * Het jetlagplan, heen en terug.
 *
 * Werkt vanaf de bank en hangt nergens van je locatie af: de voorbereiding
 * begint thuis, dagen voordat je vertrekt. Onderweg staat de dag van vandaag
 * gemarkeerd, en het hoofdmenu toont er een regel van.
 *
 * Alle tijden staan in de lokale tijd van de plek waar je die dag bent. Dat is
 * de enige klok die je onderweg voor je ziet, en een plan dat je eerst laat
 * omrekenen volgt niemand om zes uur 's ochtends.
 */

type Deel = 'heen' | 'terug';

const VERANTWOORDING =
  'Het plan rust op het werk van Eastman en Burgess over het vooraf verschuiven van je slaap, en op de Cochrane review over melatonine bij jetlag. Alle lichttijden hangen aan het koudste moment van je nacht, dat de app schat op drie uur voor je gewone wektijd. Dat is een schatting en geen meting, en dit is geen medisch advies.';

const landVan = (tijdzone: string): string => {
  const land = STEDEN.find((s) => s.tijdzone === tijdzone)?.land;
  return land === 'japan' ? 'Japan' : land === 'vietnam' ? 'Vietnam' : 'Je bestemming';
};

const stadNaam = (id: string): string | undefined => stadMet(id)?.naam;

/** "30 september" in een zin, zonder hoofdletter. */
const inZin = (datum: string): string => alsDagLabel(datum).toLowerCase();

export const JetlagScherm = () => {
  const { instellingen, wijzig, plan } = useJetlag();
  const [gekozen, setGekozen] = useState<Deel | null>(null);

  const nu = new Date();
  const vandaag = plan ? dagVanVandaag(plan, nu) : null;
  const voorbereiding = plan ? plan.heen.filter((d) => d.soort === 'voorbereiding').length : 0;
  // Vanaf de dag van de terugreis gaat het om de terugweg; daarvoor om de heenweg.
  const terugBegonnen =
    plan !== null && plan.terug.length > 0 && datumIn(plan.thuis, nu) >= plan.terug[0].datum;
  const deel: Deel = gekozen ?? (terugBegonnen ? 'terug' : 'heen');

  const invoerKlasse =
    'w-full rounded-lg border border-black/10 bg-white px-3 py-2 dark:border-white/15 dark:bg-nacht';

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
      <Terug naar="/meer" />
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Jetlag</h1>
      <p className="mt-2 mb-5 leading-relaxed text-inkt-zacht dark:text-papier/70">
        Een plan per dag voor je lichaamsklok, heen en terug. Licht op het juiste moment is het
        sterkste middel dat er is; licht op het verkeerde moment duwt je klok de verkeerde kant op.
        Alle tijden staan in de lokale tijd van waar je die dag bent.
      </p>

      <Kaartje className="mb-5 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Thuis gewoonlijk naar bed</span>
            <input
              type="time"
              value={instellingen.bedtijd}
              onChange={(e) => wijzig({ ...instellingen, bedtijd: e.target.value })}
              className={invoerKlasse}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Thuis gewoonlijk op</span>
            <input
              type="time"
              value={instellingen.wektijd}
              onChange={(e) => wijzig({ ...instellingen, wektijd: e.target.value })}
              className={invoerKlasse}
            />
          </label>
        </div>

        <div className="mt-4">
          <span className="mb-1.5 block text-sm font-medium">Dagen thuis voorbereiden</span>
          <div className="flex gap-1.5">
            {Array.from({ length: MAX_VOORBEREIDING + 1 }, (_, n) => (
              <button
                key={n}
                type="button"
                onClick={() => wijzig({ ...instellingen, voorbereidingsdagen: n })}
                aria-pressed={instellingen.voorbereidingsdagen === n}
                className={`min-w-10 rounded-full border px-3.5 py-1.5 text-sm ${
                  instellingen.voorbereidingsdagen === n
                    ? 'border-zegel bg-zegel text-white'
                    : 'border-black/10 bg-white/70 dark:border-white/15 dark:bg-nacht-diep/70'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <span className="mt-1.5 block text-xs leading-relaxed text-inkt-zacht dark:text-papier/55">
            Elke dag ga je een uur eerder slapen en sta je een uur eerder op, met direct fel licht.
            Elke dag die je thuis vervroegt, scheelt ter plaatse ongeveer een dag.
          </span>
        </div>

        <label className="mt-4 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={instellingen.melatonine}
            onChange={(e) => wijzig({ ...instellingen, melatonine: e.target.checked })}
            className="mt-1"
          />
          <span>
            Melatonine in het plan
            <span className="block text-xs leading-relaxed text-inkt-zacht dark:text-papier/55">
              Een lage dosis vlak voor het slapengaan helpt vooral na een reis naar het oosten.
              Overleg met je huisarts of apotheker als je medicijnen gebruikt of zwanger bent.
            </span>
          </span>
        </label>
      </Kaartje>

      {!plan ? (
        <p className="text-sm text-inkt-zacht dark:text-papier/60">
          Vul twee geldige tijden in. Zonder datums in het reisschema valt er niets te plannen.
        </p>
      ) : (
        <>
          <div className="mb-4 flex gap-1.5">
            {(['heen', 'terug'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setGekozen(d)}
                aria-pressed={deel === d}
                className={`rounded-full border px-3.5 py-1.5 text-sm ${
                  deel === d
                    ? 'border-zegel bg-zegel text-white'
                    : 'border-black/10 bg-white/70 dark:border-white/15 dark:bg-nacht-diep/70'
                }`}
              >
                {d === 'heen' ? 'heenreis' : 'terugreis'}
              </button>
            ))}
          </div>

          <Samenvatting plan={plan} deel={deel} />

          <div className="grid gap-2">
            {(deel === 'heen' ? plan.heen : plan.terug).map((dag) => (
              <DagKaart
                key={dag.datum}
                dag={dag}
                vandaag={dag === vandaag}
                voorbereidingsdagen={voorbereiding}
              />
            ))}
          </div>
        </>
      )}

      <p className="mt-6 text-xs leading-relaxed text-inkt-zacht dark:text-papier/50">
        {VERANTWOORDING}
      </p>
    </div>
  );
};

/**
 * Twee zinnen boven de dagen: hoe groot het verschil is, en wanneer je klok
 * naar verwachting gelijk loopt. Dat laatste is wat je wil weten als je
 * twijfelt over hoeveel dagen je thuis voorbereidt.
 */
const Samenvatting = ({ plan, deel }: { plan: Jetlagplan; deel: Deel }) => {
  let kop: string;
  let uitkomst: string;

  if (deel === 'heen') {
    const laatste = plan.heen[plan.heen.length - 1];
    const voorbereiding = plan.heen.filter((d) => d.soort === 'voorbereiding').length;
    const richting = plan.verschilHeen >= 0 ? 'voor op' : 'achter op';
    kop = `${landVan(plan.hoofdbestemming)} loopt ${alsUren(plan.verschilHeen)} ${richting} thuis. Je vertrekt op ${inZin(plan.vertrekdag)}, de dag voor je eerste dag in het reisschema.`;

    const metVoorbereiding =
      voorbereiding === 0
        ? 'Zonder voorbereiding'
        : `Met ${voorbereiding} ${voorbereiding === 1 ? 'dag' : 'dagen'} voorbereiding`;
    const waar =
      laatste && laatste.stadIds.length > 0
        ? `, in ${laatste.stadIds.map((id) => stadNaam(id) ?? id).join(' en ')}`
        : '';
    uitkomst = laatste?.aangepast
      ? `${metVoorbereiding} loopt je klok naar verwachting gelijk op ${inZin(laatste.datum)}${waar}.`
      : 'Voor je terugreis loopt je klok niet helemaal gelijk. Kijk bij de terugreis hoe je thuis verder gaat.';
  } else {
    const laatste = plan.terug[plan.terug.length - 1];
    const wissel = plan.klokWisselThuis;
    const richting = plan.verschilTerug <= 0 ? 'achter op' : 'voor op';
    const wisselZin = wissel
      ? ` Op ${inZin(wissel.datum)} gaat de klok in Nederland een uur ${wissel.minuten < 0 ? 'terug' : 'vooruit'}; het plan rekent daarmee.`
      : '';
    kop = `Thuis loopt ${alsUren(plan.verschilTerug)} ${richting} waar je vertrekt.${wisselZin}`;

    const gelijkZin = laatste?.aangepast
      ? ` Naar verwachting loopt je klok weer gelijk op ${inZin(laatste.datum)}.`
      : '';
    uitkomst = `Naar het westen gaat aanpassen sneller, ongeveer anderhalf uur per dag.${gelijkZin}`;
  }

  return (
    <Kaartje className="mb-4 p-4 text-sm leading-relaxed">
      <p>{kop}</p>
      <p className="mt-1.5 text-inkt-zacht dark:text-papier/70">{uitkomst}</p>
    </Kaartje>
  );
};

const DagKaart = ({
  dag,
  vandaag,
  voorbereidingsdagen,
}: {
  dag: Jetlagdag;
  vandaag: boolean;
  voorbereidingsdagen: number;
}) => (
  <Kaartje className={`p-3.5 ${vandaag ? 'ring-2 ring-zegel' : ''}`}>
    <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="font-medium">{alsDagLabel(dag.datum)}</span>
      <span className="text-sm text-inkt-zacht dark:text-papier/60">
        {plekVan(dag, stadNaam, voorbereidingsdagen)}
      </span>
      {vandaag && <Label toon="let-op">vandaag</Label>}
      <span className="ml-auto">
        {dag.aangepast ? (
          <Label toon="gratis">gelijk</Label>
        ) : (
          <Label>nog {alsUren(dag.achterstand)}</Label>
        )}
      </span>
    </div>
    <ul className="grid gap-1.5">
      {regelsVan(dag).map((regel, i) => (
        <RegelRij key={i} regel={regel} />
      ))}
    </ul>
  </Kaartje>
);

const RegelRij = ({ regel }: { regel: Regel }) => {
  const kleur =
    regel.nadruk === 'licht'
      ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
      : regel.nadruk === 'donker'
        ? 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
        : 'bg-papier-diep text-inkt dark:bg-nacht dark:text-papier/85';
  return (
    <li className="flex items-baseline gap-2.5 text-sm leading-relaxed">
      {regel.tijd ? (
        <span
          className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums ${kleur}`}
        >
          {regel.tijd}
        </span>
      ) : null}
      <span className={regel.tijd ? '' : 'text-inkt-zacht dark:text-papier/65'}>{regel.tekst}</span>
    </li>
  );
};
