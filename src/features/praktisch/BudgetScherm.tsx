import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Valuta } from '@/domein/schema';
import { STEDEN } from '@/data/content';
import { useApp } from '@/state/useApp';
import { Kaartje, Knop, Label, Sectiekop } from '@/ui/basis';
import { formatteerBedrag, formatteerEuro, formatteerLokaal } from '@/domein/valuta/formatteer';
import { ouderdomInDagen } from '@/domein/valuta/koers';
import {
  CATEGORIEEN,
  TAX_FREE_DREMPEL,
  contantVoorraad,
  perDag,
  totalen,
  type Categorie,
  type Opname,
  type Uitgave,
} from '@/domein/budget/uitgaven';
import {
  bewaarOpname,
  bewaarUitgave,
  leesOpnames,
  leesUitgaven,
  verwijderOpname,
  verwijderUitgave,
} from '@/data/db/idb';

/**
 * Budget en uitgaven, met een aparte teller voor contant geld.
 *
 * Die tweedeling is de reden dat dit scherm bestaat en niet één getal toont. In
 * Japan gaat veel met kaart, maar kleine tempels, lockers, marktkraampjes en de
 * bus willen munten. Wie alleen een totaal bijhoudt staat op een dag zonder
 * pinautomaat voor een tempel die geen kaart aanneemt, terwijl zijn app zegt dat
 * hij ruim in het budget zit.
 */

const NIEUWE_ID = () =>
  globalThis.crypto?.randomUUID?.() ?? `post-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const VANDAAG = () => new Date().toISOString().slice(0, 10);

export const BudgetScherm = () => {
  const { koersen, koersVerversen } = useApp();
  const [uitgaven, setUitgaven] = useState<Uitgave[]>([]);
  const [opnames, setOpnames] = useState<Opname[]>([]);

  const [omschrijving, setOmschrijving] = useState('');
  const [bedrag, setBedrag] = useState('');
  const [valuta, setValuta] = useState<Valuta>('JPY');
  const [categorie, setCategorie] = useState<Categorie>('eten');
  const [contant, setContant] = useState(false);
  const [opnameBedrag, setOpnameBedrag] = useState('');

  const haalOp = useCallback(async () => {
    const [u, o] = await Promise.all([leesUitgaven(), leesOpnames()]);
    return { uitgaven: u, opnames: o };
  }, []);
  const toon = useCallback((x: { uitgaven: Uitgave[]; opnames: Opname[] }) => {
    setUitgaven(x.uitgaven);
    setOpnames(x.opnames);
  }, []);

  useEffect(() => {
    void haalOp().then(toon);
  }, [haalOp, toon]);

  const cijfers = useMemo(() => totalen(uitgaven, koersen), [uitgaven, koersen]);
  const voorraad = useMemo(() => contantVoorraad(opnames, uitgaven), [opnames, uitgaven]);
  const dagen = useMemo(() => perDag(uitgaven), [uitgaven]);

  const voegToe = async () => {
    const getal = Number(bedrag.replace(',', '.'));
    if (!Number.isFinite(getal) || getal <= 0) return;
    await bewaarUitgave({
      id: NIEUWE_ID(),
      omschrijving: omschrijving.trim() || categorie,
      bedrag: { bedrag: getal, valuta },
      categorie,
      contant,
      datum: VANDAAG(),
    });
    setOmschrijving('');
    setBedrag('');
    toon(await haalOp());
  };

  const neemOp = async () => {
    const getal = Number(opnameBedrag.replace(',', '.'));
    if (!Number.isFinite(getal) || getal <= 0) return;
    await bewaarOpname({
      id: NIEUWE_ID(),
      bedrag: { bedrag: getal, valuta },
      datum: VANDAAG(),
    });
    setOpnameBedrag('');
    toon(await haalOp());
  };

  const koersOuderdom = ouderdomInDagen(koersen);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
      <Link to="/" className="text-sm text-zegel underline underline-offset-2">
        Alle steden
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Budget en uitgaven</h1>

      <Kaartje className="mt-4 mb-5 p-4">
        <p className="text-sm text-inkt-zacht dark:text-papier/70">Uitgegeven tot nu toe</p>
        <p className="mt-0.5 text-3xl font-semibold">{formatteerEuro(cijfers.euro)}</p>
        <p className="mt-1.5 text-sm text-inkt-zacht dark:text-papier/65">
          {formatteerEuro(cijfers.contantEuro)} contant, {formatteerEuro(cijfers.kaartEuro)} met
          kaart.
        </p>
        {cijfers.perValuta.size > 0 && (
          <p className="mt-1 flex flex-wrap gap-1.5">
            {[...cijfers.perValuta.entries()].map(([v, b]) => (
              <Label key={v}>{formatteerLokaal(b, v)}</Label>
            ))}
          </p>
        )}
        <p className="mt-2.5 text-xs text-inkt-zacht dark:text-papier/50">
          Koers van {koersen.datum}
          {koersen.bron === 'ingebakken' && ', ingebakken in de app'}
          {koersen.bron === 'opgeslagen' && ', laatst opgehaalde'}
          {koersOuderdom > 30 && ` (${koersOuderdom} dagen oud)`}.{' '}
          <button
            type="button"
            onClick={koersVerversen}
            className="text-zegel underline underline-offset-2"
          >
            ververs
          </button>
        </p>
      </Kaartje>

      <section className="mb-6">
        <Sectiekop>Uitgave toevoegen</Sectiekop>
        <Kaartje className="p-4">
          <div className="grid gap-3">
            <input
              value={omschrijving}
              onChange={(e) => setOmschrijving(e.target.value)}
              placeholder="Waar ging het aan op"
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 dark:border-white/15 dark:bg-nacht"
            />
            <div className="flex gap-2">
              <input
                value={bedrag}
                onChange={(e) => setBedrag(e.target.value)}
                inputMode="decimal"
                placeholder="Bedrag"
                className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 dark:border-white/15 dark:bg-nacht"
              />
              <select
                value={valuta}
                onChange={(e) => setValuta(e.target.value as Valuta)}
                className="rounded-lg border border-black/10 bg-white px-3 py-2 dark:border-white/15 dark:bg-nacht"
              >
                <option value="JPY">yen</option>
                <option value="VND">dong</option>
                <option value="EUR">euro</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {CATEGORIEEN.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategorie(c)}
                  aria-pressed={categorie === c}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    categorie === c
                      ? 'border-zegel bg-zegel text-white'
                      : 'border-black/10 bg-white/70 dark:border-white/15 dark:bg-nacht-diep/70'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={contant}
                onChange={(e) => setContant(e.target.checked)}
              />
              Contant betaald
            </label>

            <div>
              <Knop soort="nadruk" disabled={!bedrag.trim()} onClick={() => void voegToe()}>
                Toevoegen
              </Knop>
            </div>
          </div>
        </Kaartje>
      </section>

      <section className="mb-6">
        <Sectiekop>Contant geld</Sectiekop>
        <Kaartje className="p-4">
          {voorraad.size === 0 ? (
            <p className="text-sm text-inkt-zacht dark:text-papier/65">
              Voer een opname in zodra je geld pint, dan houdt de app bij wat je nog in je
              portemonnee zou moeten hebben.
            </p>
          ) : (
            <>
              <p className="text-sm text-inkt-zacht dark:text-papier/70">
                Zou nog in je zak zitten
              </p>
              <p className="mt-1 flex flex-wrap gap-1.5">
                {[...voorraad.entries()].map(([v, b]) => (
                  <Label key={v} toon={b < 0 ? 'let-op' : 'gewoon'}>
                    {formatteerBedrag({ bedrag: Math.abs(b), valuta: v }, koersen)}
                    {b < 0 && ' tekort'}
                  </Label>
                ))}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-inkt-zacht dark:text-papier/50">
                Dit is een boekhouding en geen meting. Klopt hij niet, dan is er een uitgave niet
                ingevoerd.
              </p>
            </>
          )}

          <div className="mt-3 flex gap-2">
            <input
              value={opnameBedrag}
              onChange={(e) => setOpnameBedrag(e.target.value)}
              inputMode="decimal"
              placeholder={`Opgenomen in ${valuta === 'JPY' ? 'yen' : valuta === 'VND' ? 'dong' : 'euro'}`}
              className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 dark:border-white/15 dark:bg-nacht"
            />
            <Knop disabled={!opnameBedrag.trim()} onClick={() => void neemOp()}>
              Opnemen
            </Knop>
          </div>
          {opnames.length > 0 && (
            <ul className="mt-3 grid gap-1 text-sm text-inkt-zacht dark:text-papier/65">
              {opnames.map((o) => (
                <li key={o.id} className="flex items-center gap-2">
                  <span>
                    {o.datum}: {formatteerBedrag(o.bedrag, koersen)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void verwijderOpname(o.id).then(haalOp).then(toon)}
                    className="text-xs text-zegel underline underline-offset-2"
                  >
                    weg
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Kaartje>
      </section>

      {cijfers.perCategorie.size > 0 && (
        <section className="mb-6">
          <Sectiekop>Per categorie</Sectiekop>
          <Kaartje className="p-4">
            <ul className="grid gap-1.5 text-sm">
              {[...cijfers.perCategorie.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([c, euro]) => (
                  <li key={c} className="flex items-baseline justify-between gap-3">
                    <span>{c}</span>
                    <span className="tabular-nums">{formatteerEuro(euro)}</span>
                  </li>
                ))}
            </ul>
          </Kaartje>
        </section>
      )}

      {dagen.length > 0 && (
        <section className="mb-6">
          <Sectiekop>Per dag</Sectiekop>
          <div className="grid gap-3">
            {dagen.map((dag) => (
              <div key={dag.datum}>
                <p className="mb-1.5 text-sm font-medium">{dag.datum}</p>
                <div className="grid gap-1.5">
                  {dag.uitgaven.map((u) => (
                    <Kaartje key={u.id} className="flex items-center gap-3 p-2.5 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{u.omschrijving}</span>
                        <span className="text-xs text-inkt-zacht dark:text-papier/55">
                          {u.categorie}
                          {u.contant && ', contant'}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatteerBedrag(u.bedrag, koersen)}
                      </span>
                      <button
                        type="button"
                        onClick={() => void verwijderUitgave(u.id).then(haalOp).then(toon)}
                        className="shrink-0 text-xs text-zegel underline underline-offset-2"
                      >
                        weg
                      </button>
                    </Kaartje>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-6">
        <Sectiekop>Tax free winkelen</Sectiekop>
        <Kaartje className="p-4 text-sm leading-relaxed">
          <p>
            Vanaf {formatteerBedrag(TAX_FREE_DREMPEL, koersen)} per winkel per dag kun je de
            omzetbelasting van tien procent terugkrijgen. Dat gaat aan de kassa, niet achteraf op
            het vliegveld.
          </p>
          <p className="mt-2">
            <strong className="font-medium">Neem je paspoort mee.</strong> Zonder paspoort kan het
            niet, en een foto ervan wordt niet geaccepteerd. Dit is de meest gemaakte fout.
          </p>
          <p className="mt-2">
            Verbruiksgoederen (eten, cosmetica, medicijnen) worden verzegeld en moeten ongeopend het
            land uit. Algemene goederen (kleding, elektronica) mag je gewoon gebruiken. Grote
            warenhuizen, elektronicaketens en drogisterijen doen bijna allemaal mee; kleine winkels
            vaak niet.
          </p>
        </Kaartje>
      </section>

      <section>
        <Sectiekop>Bagage</Sectiekop>
        <Kaartje className="p-4 text-sm leading-relaxed">
          <p>
            <strong className="font-medium">Takkyubin</strong> is koffervervoer van hotel naar
            hotel, meestal binnen een dag en voor ongeveer{' '}
            {formatteerBedrag({ bedrag: 2000, tot: 2500, valuta: 'JPY' }, koersen)} per koffer. Je
            geeft hem 's ochtends af bij de receptie of een konbini en reist zelf met handbagage. Op
            een dag met een treinreis en een tempelbezoek scheelt dat het verschil tussen wel en
            niet doorlopen. Geef hem een dag van tevoren af als het naar een afgelegen plek gaat.
          </p>
          <p className="mt-2">
            <strong className="font-medium">Lockers</strong> staan op vrijwel elk station, in drie
            maten: klein (ruwweg {formatteerBedrag({ bedrag: 400, valuta: 'JPY' }, koersen)}, past
            een rugzak), middel ({formatteerBedrag({ bedrag: 600, valuta: 'JPY' }, koersen)},
            handbagagekoffer) en groot ({formatteerBedrag({ bedrag: 800, valuta: 'JPY' }, koersen)},
            ruimbagage). Betalen kan meestal met je IC-kaart. Op drukke dagen zijn ze rond het
            middaguur vol; dan is Ecbo Cloak uit de appgids de uitweg.
          </p>
          <p className="mt-2 text-inkt-zacht dark:text-papier/60">
            De {STEDEN.filter((s) => s.land === 'japan').length} Japanse steden in deze app hebben
            allemaal lockers op het hoofdstation.
          </p>
        </Kaartje>
      </section>
    </div>
  );
};
