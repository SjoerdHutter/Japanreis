import { Link } from 'react-router-dom';
import { MapPinOff } from 'lucide-react';
import type { Plaats, Stad } from '@/domein/schema';
import { nuOpen, volgendeVoorstelling, minutenIn } from '@/domein/openingstijden/status';
import { alsKlok } from '@/domein/planning/dagplanner';
import { top20 } from '@/domein/plaatsen/buurt';
import { formatteerPrijs } from '@/domein/valuta/formatteer';
import { PlaatsLabels } from '@/features/plaats/PlaatsLabels';
import { useApp } from '@/state/useApp';
import { Kaartje, Label } from '@/ui/basis';

/**
 * De Top 20 van een stad, op volgorde van rang. Een plek die onder een andere
 * valt (de Ngoc Son tempel onder het Hoan Kiem meer) staat ingesprongen onder
 * zijn hoofdplek. Elke regel: naam, korte beschrijving, open of dicht, prijs en
 * de labels; een tik opent alles over de plek.
 */

const Rij = ({ plaats, stad, nummer }: { plaats: Plaats; stad: Stad; nummer?: number }) => {
  const { koersen } = useApp();
  const open = nuOpen(plaats, stad);
  const volgende =
    plaats.voorstellingen && volgendeVoorstelling(plaats, minutenIn(stad.tijdzone, new Date()));
  return (
    <Kaartje className="p-3.5">
      <Link to={`/plaats/${plaats.id}`} className="flex gap-3">
        {nummer !== undefined && (
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-zegel text-sm font-semibold text-white dark:bg-zegel-licht dark:text-nacht">
            {nummer}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{plaats.naam}</span>
          {plaats.beschrijving && (
            <span className="mt-0.5 line-clamp-2 block text-sm leading-relaxed text-inkt-zacht dark:text-papier/65">
              {plaats.beschrijving}
            </span>
          )}
        </span>
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {open === true && <Label toon="gratis">nu open</Label>}
        {open === false && <Label>nu dicht</Label>}
        {volgende !== null && volgende !== undefined && (
          <Label>volgende voorstelling {alsKlok(volgende)}</Label>
        )}
        {plaats.prijs && <Label>{formatteerPrijs(plaats.prijs, koersen)}</Label>}
        {!plaats.coordinaten && <Label toon="let-op">locatie ontbreekt</Label>}
        <PlaatsLabels plaats={plaats} />
      </div>
    </Kaartje>
  );
};

export const Top20 = ({ plaatsen, stad }: { plaatsen: Plaats[]; stad: Stad }) => (
  <ol className="grid gap-2">
    {top20(plaatsen).map(({ plaats, onderdelen }) => (
      <li key={plaats.id}>
        <Rij plaats={plaats} stad={stad} nummer={plaats.rang} />
        {onderdelen.length > 0 && (
          <ul className="mt-2 ml-5 grid gap-2 border-l-2 border-black/10 pl-3 dark:border-white/15">
            {onderdelen.map((o) => (
              <li key={o.id}>
                <Rij plaats={o} stad={stad} />
              </li>
            ))}
          </ul>
        )}
      </li>
    ))}
  </ol>
);

/**
 * Plekken die nog geen pin hebben. Ze staan in de lijsten maar niet op de
 * kaart; vanaf hier zet je ze erop, met coördinaten of lang drukken op de kaart.
 */
export const LocatieOntbreekt = ({ plaatsen }: { plaatsen: Plaats[] }) => {
  const zonder = plaatsen.filter((p) => !p.coordinaten);
  if (zonder.length === 0) return null;
  return (
    <details className="mb-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
      <summary className="flex cursor-pointer items-center gap-2 font-medium">
        <MapPinOff className="size-4 shrink-0" aria-hidden />
        Locatie ontbreekt bij {zonder.length} {zonder.length === 1 ? 'plek' : 'plekken'}
      </summary>
      <p className="mt-2 leading-relaxed">
        Ze staan in de lijsten maar nog niet op de kaart. Open er een en zet hem op de kaart, of
        draai <code>npm run geocodeer</code> om ze allemaal op te zoeken.
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {zonder.map((p) => (
          <li key={p.id}>
            <Link
              to={`/plaats/${p.id}`}
              className="inline-block rounded-full bg-white/70 px-2.5 py-1 font-medium underline-offset-2 hover:underline dark:bg-nacht-diep/70"
            >
              {p.naam}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
};
