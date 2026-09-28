import { zetTerugNaarApp } from '@/data/overschrijvingen';

/**
 * Het label "eigen waarde" bij iets wat jij hebt aangepast, met een knop om
 * terug te gaan naar wat de app meebracht. In dezelfde kleur als de rest van je
 * persoonlijke laag, zodat je ziet wat van jou is.
 */
export const EigenWaarde = ({
  doel,
  doelId,
  veld,
}: {
  doel: string;
  doelId: string;
  veld: string;
}) => (
  <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200">
      eigen waarde
    </span>
    <button
      type="button"
      onClick={() => void zetTerugNaarApp(doel, doelId, veld)}
      className="text-xs text-inkt-zacht underline underline-offset-2 dark:text-papier/60"
    >
      terugzetten
    </button>
  </span>
);
