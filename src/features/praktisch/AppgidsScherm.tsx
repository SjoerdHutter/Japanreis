import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { App } from '@/domein/schema';
import { APPS } from '@/data/content';
import { Kaartje, Label, Sectiekop } from '@/ui/basis';

/**
 * De appgids uit hoofdstuk 9.
 *
 * Het onderscheid dat er het meest toe doet staat vooraan: werkt hij offline, en
 * moet je hem vooraf downloaden. Dat tweede is de val waar iedereen in trapt.
 * Google Translate met het Japanse taalpakket is onmisbaar en werkt zonder
 * bereik; zonder dat pakket is hij in een tempelkelder een leeg scherm.
 */

const OFFLINE_LABEL: Record<
  App['offline'],
  { tekst: string; toon: 'gratis' | 'let-op' | 'gewoon' }
> = {
  ja: { tekst: 'werkt offline', toon: 'gratis' },
  deels: { tekst: 'deels offline', toon: 'gewoon' },
  nee: { tekst: 'heeft bereik nodig', toon: 'let-op' },
};

const CATEGORIE_NAAM: Record<App['categorie'], string> = {
  vervoer: 'Vervoer',
  betalen: 'Betalen',
  taal: 'Taal',
  eten: 'Eten',
  besparen: 'Besparen',
  overig: 'Overig',
};

const VOLGORDE: App['categorie'][] = ['vervoer', 'betalen', 'taal', 'eten', 'besparen', 'overig'];

export const AppgidsScherm = () => {
  const [land, setLand] = useState<'alles' | 'japan' | 'vietnam'>('alles');
  const [alleenVooraf, setAlleenVooraf] = useState(false);

  const zichtbaar = useMemo(
    () =>
      APPS.filter((app) => land === 'alles' || app.land.includes(land)).filter(
        (app) => !alleenVooraf || app.voorafDownloaden === 'ja',
      ),
    [land, alleenVooraf],
  );

  const vooraf = APPS.filter((a) => a.voorafDownloaden === 'ja').length;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
      <Link to="/" className="text-sm text-zegel underline underline-offset-2">
        Alle steden
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Handige apps</h1>
      <p className="mt-2 mb-4 leading-relaxed text-inkt-zacht dark:text-papier/70">
        Wat je nodig hebt, of het zonder bereik werkt, en of je het vooraf moet downloaden. Dat
        laatste is de val: {vooraf} van deze apps zijn onderweg pas nuttig als je ze thuis al hebt
        klaargezet.
      </p>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {(
          [
            ['alles', 'alles'],
            ['japan', 'Japan'],
            ['vietnam', 'Vietnam'],
          ] as const
        ).map(([id, naam]) => (
          <Chip key={id} aan={land === id} onClick={() => setLand(id)}>
            {naam}
          </Chip>
        ))}
        <Chip aan={alleenVooraf} onClick={() => setAlleenVooraf((v) => !v)}>
          alleen vooraf downloaden
        </Chip>
      </div>

      {VOLGORDE.map((categorie) => {
        const inCategorie = zichtbaar.filter((a) => a.categorie === categorie);
        if (inCategorie.length === 0) return null;
        return (
          <section key={categorie} className="mb-6">
            <Sectiekop>{CATEGORIE_NAAM[categorie]}</Sectiekop>
            <div className="grid gap-2">
              {inCategorie.map((app) => (
                <Kaartje key={app.id} className="p-3.5">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-medium">{app.naam}</span>
                    <Label toon={OFFLINE_LABEL[app.offline].toon}>
                      {OFFLINE_LABEL[app.offline].tekst}
                    </Label>
                    {app.voorafDownloaden === 'ja' && (
                      <Label toon="let-op">vooraf downloaden</Label>
                    )}
                    <Label>bespaart {app.bespaart}</Label>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-inkt-zacht dark:text-papier/70">
                    {app.waarvoor}
                  </p>
                  {app.opmerking && (
                    <p className="mt-1.5 text-sm leading-relaxed text-zegel">{app.opmerking}</p>
                  )}
                </Kaartje>
              ))}
            </div>
          </section>
        );
      })}

      <p className="mt-6 text-xs leading-relaxed text-inkt-zacht dark:text-papier/50">
        Deze lijst is redactionele content en niet ter plaatse geverifieerd. Apps veranderen van
        naam, van eigenaar en soms van prijs; controleer voor vertrek of ze nog bestaan.
      </p>
    </div>
  );
};

const Chip = ({
  aan,
  onClick,
  children,
}: {
  aan: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={aan}
    className={`rounded-full border px-3 py-1.5 text-sm transition ${
      aan
        ? 'border-zegel bg-zegel text-white'
        : 'border-black/10 bg-white/70 dark:border-white/15 dark:bg-nacht-diep/70'
    }`}
  >
    {children}
  </button>
);
