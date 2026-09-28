import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircleQuestion, Search, TriangleAlert } from 'lucide-react';
import { laadMenu } from '@/data/content';
import { menuFeitId } from '@/data/content/feiten';
import { allergenenVoorJou, zoekOpMenu } from '@/domein/menu/zoek';
import {
  ALLERGEEN_NAAM,
  MENU_CATEGORIEEN,
  MENU_CATEGORIE_NAAM,
  type Allergeen,
  type MenuCategorie,
  type MenuItem,
} from '@/domein/schema';
import { useMijnGegevens } from '@/features/gegevens/gedeeld';
import { AllergieKaart } from '@/features/nood/NoodScherm';
import { Chip } from '@/features/stad/Filterbalk';
import { Kaartje, Knop, Terug } from '@/ui/basis';
import { Controleren } from '@/ui/Controleren';
import { INVOER_KLASSE } from '@/ui/formulier';

/**
 * De menukaart: wat staat er op die kaart aan de muur?
 *
 * Tik over wat je ziet, in kanji, kana of romaji, of zoek op een Nederlands
 * woord. Staan er in Mijn gegevens allergieën, dan krijgt elk gerecht waar die
 * gewoonlijk in zitten een rode rand, en kun je het in één tik aan het personeel
 * vragen. "Gewoonlijk", want dashi en sojasaus zitten op onverwachte plekken en
 * elke zaak kookt anders.
 */
export const MenuScherm = () => {
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [vraag, setVraag] = useState('');
  const [categorie, setCategorie] = useState<MenuCategorie | undefined>();
  const [tonen, setTonen] = useState<{ gerecht?: MenuItem } | null>(null);
  const { gegevens, geladen } = useMijnGegevens();
  const uitgesteld = useDeferredValue(vraag);

  useEffect(() => {
    void laadMenu().then(setItems);
  }, []);

  const jouw: Allergeen[] = gegevens.medisch?.allergenen ?? [];
  const treffers = useMemo(
    () => (items ? zoekOpMenu(items, uitgesteld, categorie) : []),
    [items, uitgesteld, categorie],
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16">
      <Terug naar="/meer" />
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Menukaart</h1>
      <p className="mt-2 mb-4 leading-relaxed text-inkt-zacht dark:text-papier/70">
        Zoek op wat je op de kaart ziet: in kanji, kana of romaji, of op een Nederlands woord. De
        allergenen zijn wat er gewoonlijk in zit, niet wat deze keuken doet. Vraag het na.
      </p>

      {geladen &&
        (jouw.length > 0 ? (
          <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm leading-relaxed text-red-950 dark:bg-red-950/40 dark:text-red-100">
            <p>
              Je allergieën uit Mijn gegevens:{' '}
              <span className="font-medium">{jouw.map((a) => ALLERGEEN_NAAM[a]).join(', ')}</span>.
              Gerechten waar die gewoonlijk in zitten hebben een rode rand.
            </p>
            <div className="mt-2">
              <Knop klein soort="nadruk" onClick={() => setTonen({})}>
                <MessageCircleQuestion className="size-4" aria-hidden />
                Toon aan personeel
              </Knop>
            </div>
          </div>
        ) : (
          <p className="mb-4 rounded-xl bg-papier-diep p-3 text-sm leading-relaxed dark:bg-nacht">
            Heb je een allergie?{' '}
            <Link
              to="/gegevens?sectie=medisch"
              className="font-medium text-zegel underline underline-offset-2 dark:text-zegel-licht"
            >
              Vul hem in bij Mijn gegevens
            </Link>
            , dan waarschuwt de menukaart bij elk gerecht waar hij gewoonlijk in zit.
          </p>
        ))}

      <label className="relative mb-3 block">
        <span className="sr-only">Zoek op de menukaart</span>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-inkt-zacht dark:text-papier/55"
          aria-hidden
        />
        <input
          type="search"
          value={vraag}
          onChange={(e) => setVraag(e.target.value)}
          placeholder="ラーメン, ramen of soep"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          className={`${INVOER_KLASSE} pl-9`}
        />
      </label>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Chip aan={!categorie} onClick={() => setCategorie(undefined)}>
          Alles
        </Chip>
        {MENU_CATEGORIEEN.map((c) => (
          <Chip
            key={c}
            aan={categorie === c}
            onClick={() => setCategorie(categorie === c ? undefined : c)}
          >
            {MENU_CATEGORIE_NAAM[c]}
          </Chip>
        ))}
      </div>

      {items && (
        <p className="mb-2 text-sm text-inkt-zacht dark:text-papier/60" aria-live="polite">
          {treffers.length === 0
            ? 'Niets gevonden. Probeer een deel van het woord, of een ander schrift.'
            : `${treffers.length} ${treffers.length === 1 ? 'gerecht' : 'gerechten'}`}
        </p>
      )}

      <ul className="grid gap-2">
        {treffers.map((item) => (
          <Gerecht
            key={item.id}
            item={item}
            jouw={jouw}
            onVraag={() => setTonen({ gerecht: item })}
          />
        ))}
      </ul>

      {tonen && (
        <AllergieKaart
          medisch={gegevens.medisch}
          land="japan"
          gerecht={tonen.gerecht}
          onSluit={() => setTonen(null)}
        />
      )}
    </div>
  );
};

const Gerecht = ({
  item,
  jouw,
  onVraag,
}: {
  item: MenuItem;
  jouw: readonly Allergeen[];
  onVraag: () => void;
}) => {
  const raak = allergenenVoorJou(item, jouw);
  return (
    <li>
      <Kaartje className={`p-3.5 ${raak.length > 0 ? 'border-red-500! ring-1 ring-red-500' : ''}`}>
        <p lang="ja" className="text-xl leading-snug font-medium">
          {item.kanji ?? item.kana}
          {item.kanji && (
            <span className="ml-2 text-base font-normal text-inkt-zacht dark:text-papier/60">
              {item.kana}
            </span>
          )}
        </p>
        <p className="text-sm font-medium text-indigo-reis dark:text-papier/80">{item.romaji}</p>
        <p className="mt-1 text-sm leading-relaxed">{item.nederlands}</p>

        {raak.length > 0 && (
          <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-red-700 dark:text-red-300">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            Gewoonlijk met {raak.map((a) => ALLERGEEN_NAAM[a]).join(', ')}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          {item.allergenen.map((a) => (
            <span
              key={a}
              className={`rounded-full px-2 py-0.5 font-medium ${
                raak.includes(a)
                  ? 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'
                  : 'bg-papier-diep text-inkt-zacht dark:bg-nacht-diep dark:text-papier/70'
              }`}
            >
              {ALLERGEEN_NAAM[a]}
            </span>
          ))}
          <Controleren id={menuFeitId(item.id)} gecontroleerd={item.gecontroleerd} />
        </div>

        {raak.length > 0 && (
          <div className="mt-2.5">
            <Knop klein onClick={onVraag}>
              <MessageCircleQuestion className="size-4" aria-hidden />
              Vraag het na
            </Knop>
          </div>
        )}
      </Kaartje>
    </li>
  );
};
