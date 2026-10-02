import { useState, type ReactNode } from 'react';
import type { Plaats, PrijsRegel, Stad } from '@/domein/schema';
import { zetOverschrijving } from '@/data/overschrijvingen';
import { leesPad } from '@/domein/overschrijven/samenvoegen';
import { osmFout } from '@/domein/openingstijden/osm';
import { tijdenOp } from '@/domein/openingstijden/status';
import { leesCoordinaten, leesSluitingen, sluitingenAlsTekst } from '@/domein/plaatsen/invoer';
import { plusDagen } from '@/domein/tijd/datums';
import { datumIn } from '@/domein/tijd/zones';
import { Knop } from '@/ui/basis';
import { EigenWaarde } from '@/ui/EigenWaarde';
import { Invoer, Keuze, Tekstvak } from '@/ui/formulier';
import { dagTekst, korteDag } from './tekst';

/**
 * Je eigen waarden voor een plek: alles wat je ter plekke beter weet. Het
 * bestaande patroon van de app, nu voor elk veld van een plek. Wat je bewaart
 * gaat naar IndexedDB en ligt over de meegeleverde waarde heen; "terugzetten"
 * haalt het weer weg. Een leeg veld bewaren wist de waarde van de app.
 */

const bewaar = (plaats: Plaats, veld: string, waarde: unknown) =>
  zetOverschrijving('plaats', plaats.id, veld, waarde);

/** De knop en het formulier eromheen, overal hetzelfde. */
const Bewerkblok = ({
  open,
  onOpen,
  onBewaar,
  onAnnuleer,
  label,
  kanBewaren = true,
  children,
}: {
  open: boolean;
  onOpen: () => void;
  onBewaar: () => void;
  onAnnuleer: () => void;
  label: string;
  kanBewaren?: boolean;
  children: ReactNode;
}) =>
  open ? (
    <div className="mt-2 grid gap-2 rounded-lg bg-papier-diep/70 p-2.5 dark:bg-nacht/60">
      {children}
      <div className="flex gap-2">
        <Knop klein soort="nadruk" onClick={onBewaar} disabled={!kanBewaren}>
          Bewaar
        </Knop>
        <Knop klein soort="stil" onClick={onAnnuleer}>
          Annuleer
        </Knop>
      </div>
    </div>
  ) : (
    <button type="button" onClick={onOpen} className="text-xs underline underline-offset-2">
      {label}
    </button>
  );

type Soort = 'tekst' | 'getal' | 'regels' | 'jaNee' | 'status';

const naarInvoer = (waarde: unknown, soort: Soort): string => {
  if (waarde === undefined || waarde === null) return '';
  if (soort === 'regels') return (waarde as string[]).join('\n');
  if (soort === 'jaNee') return waarde ? 'ja' : 'nee';
  return String(waarde);
};

const uitInvoer = (tekst: string, soort: Soort): unknown => {
  const t = tekst.trim();
  if (t === '') return undefined;
  switch (soort) {
    case 'getal':
      return Number.isFinite(Number(t)) && Number(t) > 0 ? Math.round(Number(t)) : undefined;
    case 'regels':
      return t
        .split('\n')
        .map((r) => r.trim())
        .filter(Boolean);
    case 'jaNee':
      return t === 'ja';
    default:
      return t;
  }
};

/**
 * Een eenvoudig veld: tekst, een getal, een lijst zinnen (één per regel), ja of
 * nee, of de status. Toont zelf niets van de waarde; dat doet de pagina. Dit is
 * alleen het knopje "aanpassen" met het label "eigen waarde" ernaast.
 */
export const EigenVeld = ({
  plaats,
  veld,
  soort,
  label,
  eigen,
}: {
  plaats: Plaats;
  veld: string;
  soort: Soort;
  label: string;
  eigen: Set<string>;
}) => {
  const [open, setOpen] = useState(false);
  const [invoer, setInvoer] = useState('');
  const openen = () => {
    setInvoer(naarInvoer(leesPad(plaats, veld), soort));
    setOpen(true);
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {eigen.has(veld) && <EigenWaarde doel="plaats" doelId={plaats.id} veld={veld} />}
      <Bewerkblok
        open={open}
        onOpen={openen}
        onAnnuleer={() => setOpen(false)}
        onBewaar={() =>
          void bewaar(plaats, veld, uitInvoer(invoer, soort)).then(() => setOpen(false))
        }
        label={`${label} aanpassen`}
      >
        {soort === 'regels' ? (
          <Tekstvak
            value={invoer}
            onChange={(e) => setInvoer(e.target.value)}
            rows={4}
            aria-label={label}
            placeholder="Eén per regel"
          />
        ) : soort === 'jaNee' ? (
          <Keuze value={invoer} onChange={(e) => setInvoer(e.target.value)} aria-label={label}>
            <option value="">onbekend</option>
            <option value="ja">ja</option>
            <option value="nee">nee</option>
          </Keuze>
        ) : soort === 'status' ? (
          <Keuze value={invoer} onChange={(e) => setInvoer(e.target.value)} aria-label={label}>
            <option value="">geen bijzonderheden</option>
            <option value="onzeker">onzeker</option>
          </Keuze>
        ) : (
          <Invoer
            value={invoer}
            onChange={(e) => setInvoer(e.target.value)}
            inputMode={soort === 'getal' ? 'numeric' : undefined}
            aria-label={label}
          />
        )}
      </Bewerkblok>
    </span>
  );
};

/**
 * Openingstijden in de notatie van OpenStreetMap, met eronder hoe de app ze
 * de komende week leest. Wat de app niet kan lezen, kun je niet bewaren.
 */
export const OpeningstijdenBewerken = ({
  plaats,
  stad,
  eigen,
}: {
  plaats: Plaats;
  stad: Stad;
  eigen: Set<string>;
}) => {
  const veld = 'openingstijden.osm';
  const [open, setOpen] = useState(false);
  const [invoer, setInvoer] = useState('');
  const fout = invoer.trim() ? osmFout(invoer.trim()) : null;
  const vandaag = datumIn(stad.tijdzone);
  const proef = { openingstijden: { osm: invoer.trim() }, sluitingen: plaats.sluitingen };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {eigen.has(veld) && <EigenWaarde doel="plaats" doelId={plaats.id} veld={veld} />}
      <Bewerkblok
        open={open}
        onOpen={() => {
          setInvoer(plaats.openingstijden?.osm ?? '');
          setOpen(true);
        }}
        onAnnuleer={() => setOpen(false)}
        onBewaar={() =>
          void bewaar(plaats, veld, invoer.trim() || undefined).then(() => setOpen(false))
        }
        kanBewaren={!fout}
        label="openingstijden aanpassen"
      >
        <Invoer
          value={invoer}
          onChange={(e) => setInvoer(e.target.value)}
          placeholder="Mo-Fr 08:00-17:00; Sa,Su 09:00-12:00"
          aria-label="Openingstijden"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <span className="text-xs leading-relaxed text-inkt-zacht dark:text-papier/60">
          In de notatie van OpenStreetMap: dagen als Mo, Tu, We, Th, Fr, Sa, Su, tijden als
          08:00-17:00, meerdere regels met een puntkomma, en "off" voor dicht.
        </span>
        {fout ? (
          <span role="alert" className="text-xs text-zegel dark:text-zegel-licht">
            {fout}
          </span>
        ) : (
          invoer.trim() && (
            <ul className="grid gap-0.5 text-xs">
              {Array.from({ length: 7 }, (_, i) => plusDagen(vandaag, i)).map((datum) => (
                <li key={datum}>
                  <span className="inline-block w-20 font-medium">{korteDag(datum)}</span>
                  {dagTekst(tijdenOp(proef, datum))}
                </li>
              ))}
            </ul>
          )
        )}
      </Bewerkblok>
    </span>
  );
};

/** Sluitingsperiodes, één per regel. */
export const SluitingenBewerken = ({ plaats, eigen }: { plaats: Plaats; eigen: Set<string> }) => {
  const [open, setOpen] = useState(false);
  const [invoer, setInvoer] = useState('');
  const gelezen = leesSluitingen(invoer);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {eigen.has('sluitingen') && (
        <EigenWaarde doel="plaats" doelId={plaats.id} veld="sluitingen" />
      )}
      <Bewerkblok
        open={open}
        onOpen={() => {
          setInvoer(sluitingenAlsTekst(plaats.sluitingen));
          setOpen(true);
        }}
        onAnnuleer={() => setOpen(false)}
        onBewaar={() => {
          if ('fout' in gelezen) return;
          void bewaar(
            plaats,
            'sluitingen',
            gelezen.sluitingen.length ? gelezen.sluitingen : undefined,
          ).then(() => setOpen(false));
        }}
        kanBewaren={!('fout' in gelezen)}
        label="sluitingen aanpassen"
      >
        <Tekstvak
          value={invoer}
          onChange={(e) => setInvoer(e.target.value)}
          rows={3}
          aria-label="Sluitingen"
          placeholder="2026-09-04 tot 2026-11-02: onderhoud"
        />
        {'fout' in gelezen && (
          <span role="alert" className="text-xs text-zegel dark:text-zegel-licht">
            Niet te lezen: "{gelezen.fout}". Schrijf het als 2026-09-04 tot 2026-11-02: reden.
          </span>
        )}
      </Bewerkblok>
    </span>
  );
};

/** De bedragen in de prijslijst. De omschrijvingen blijven zoals ze zijn. */
export const PrijzenBewerken = ({ plaats, eigen }: { plaats: Plaats; eigen: Set<string> }) => {
  const [open, setOpen] = useState(false);
  const [regels, setRegels] = useState<PrijsRegel[]>([]);
  if (!plaats.prijzen || plaats.prijzen.length === 0) return null;

  const zet = (i: number, deel: Partial<PrijsRegel>) =>
    setRegels((oud) => oud.map((r, j) => (j === i ? { ...r, ...deel } : r)));
  const getal = (tekst: string) => (tekst.trim() === '' ? undefined : Number(tekst));
  const goed = regels.every((r) =>
    r.bedrag !== undefined
      ? Number.isFinite(r.bedrag) && r.bedrag >= 0
      : r.van !== undefined && r.tot !== undefined && r.van <= r.tot,
  );

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {eigen.has('prijzen') && <EigenWaarde doel="plaats" doelId={plaats.id} veld="prijzen" />}
      <Bewerkblok
        open={open}
        onOpen={() => {
          setRegels(plaats.prijzen ?? []);
          setOpen(true);
        }}
        onAnnuleer={() => setOpen(false)}
        onBewaar={() => void bewaar(plaats, 'prijzen', regels).then(() => setOpen(false))}
        kanBewaren={goed}
        label="prijzen aanpassen"
      >
        {regels.map((regel, i) => (
          <div key={`${regel.omschrijving}-${i}`} className="grid gap-1">
            <span className="text-xs font-medium">
              {regel.omschrijving}
              {regel.valuta && regel.valuta !== 'VND' && regel.valuta !== 'JPY'
                ? ` (${regel.valuta})`
                : ''}
            </span>
            {regel.bedrag !== undefined ? (
              <Invoer
                value={String(regel.bedrag)}
                inputMode="numeric"
                aria-label={regel.omschrijving}
                onChange={(e) => zet(i, { bedrag: getal(e.target.value) ?? 0 })}
              />
            ) : (
              <span className="flex items-center gap-2">
                <Invoer
                  value={String(regel.van ?? '')}
                  inputMode="numeric"
                  aria-label={`${regel.omschrijving}, van`}
                  onChange={(e) => zet(i, { van: getal(e.target.value) })}
                />
                <span className="text-sm">tot</span>
                <Invoer
                  value={String(regel.tot ?? '')}
                  inputMode="numeric"
                  aria-label={`${regel.omschrijving}, tot`}
                  onChange={(e) => zet(i, { tot: getal(e.target.value) })}
                />
              </span>
            )}
          </div>
        ))}
      </Bewerkblok>
    </span>
  );
};

/**
 * De plek op de kaart: plak coördinaten of een link uit Google Maps. Lang
 * drukken op de kaart kan ook; dat regelt de pagina van de plek.
 */
export const LocatieBewerken = ({ plaats, eigen }: { plaats: Plaats; eigen: Set<string> }) => {
  const [open, setOpen] = useState(false);
  const [invoer, setInvoer] = useState('');
  const plek = leesCoordinaten(invoer);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {eigen.has('coordinaten') && (
        <EigenWaarde doel="plaats" doelId={plaats.id} veld="coordinaten" />
      )}
      <Bewerkblok
        open={open}
        onOpen={() => {
          setInvoer(
            plaats.coordinaten ? `${plaats.coordinaten.lat}, ${plaats.coordinaten.lon}` : '',
          );
          setOpen(true);
        }}
        onAnnuleer={() => setOpen(false)}
        onBewaar={() => {
          if (plek) void bewaar(plaats, 'coordinaten', plek).then(() => setOpen(false));
        }}
        kanBewaren={plek !== null}
        label={plaats.coordinaten ? 'locatie aanpassen' : 'locatie zetten'}
      >
        <Invoer
          value={invoer}
          onChange={(e) => setInvoer(e.target.value)}
          placeholder="21.0287, 105.8524 of een link uit Google Maps"
          aria-label="Coördinaten"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <span className="text-xs text-inkt-zacht dark:text-papier/60">
          {invoer.trim() === ''
            ? 'Of druk lang op de kaart hieronder, op de plek zelf.'
            : plek
              ? `Wordt ${plek.lat}, ${plek.lon}.`
              : 'Hier staan geen coördinaten in.'}
        </span>
      </Bewerkblok>
    </span>
  );
};
