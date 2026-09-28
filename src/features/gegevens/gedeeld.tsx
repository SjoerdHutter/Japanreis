import { useState, useSyncExternalStore, type ChangeEvent, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { leesGegevens } from '@/data/gegevens';
import { opWijziging } from '@/data/db/wijzigingen';
import { orden, type MijnGegevens } from '@/domein/gegevens/orden';
import { Kaartje } from '@/ui/basis';

/**
 * Mijn gegevens, op volgorde, en bijgewerkt zodra er ergens iets verandert.
 *
 * Eén gedeelde kopie in het geheugen: de reisdagen hebben twintig kaarten die
 * elk willen weten waar je slaapt, en die gaan niet elk apart de database langs.
 */
let gedeeld: { gegevens: MijnGegevens; geladen: boolean } = {
  gegevens: orden([]),
  geladen: false,
};
let bezig: Promise<void> | null = null;
const luisteraars = new Set<() => void>();

const laad = (): Promise<void> =>
  (bezig ??= leesGegevens().then((regels) => {
    gedeeld = { gegevens: orden(regels), geladen: true };
    for (const luisteraar of luisteraars) luisteraar();
  }));

opWijziging(['gegevens'], () => {
  bezig = null;
  void laad();
});

const abonneer = (luisteraar: () => void) => {
  luisteraars.add(luisteraar);
  if (!gedeeld.geladen) void laad();
  return () => luisteraars.delete(luisteraar);
};

export const useMijnGegevens = (): { gegevens: MijnGegevens; geladen: boolean } =>
  useSyncExternalStore(abonneer, () => gedeeld);

export const nu = (): string => new Date().toISOString();

export const nieuweId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Formulierwaarden als platte tekst per veld. Het schema maakt er bij het
 * bewaren het echte model van; tot die tijd is alles gewoon wat je typt.
 */
export const useVelden = <T extends Record<string, string>>(begin: T) => {
  const [waarden, setWaarden] = useState<T>(begin);
  const zet =
    (veld: keyof T) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setWaarden((oud) => ({ ...oud, [veld]: e.target.value }));
  return { waarden, zet, setWaarden };
};

/** Een sectie die je open en dicht klapt, met een regel samenvatting. */
export const Sectie = ({
  id,
  titel,
  samenvatting,
  open,
  onWissel,
  children,
}: {
  id: string;
  titel: string;
  samenvatting: ReactNode;
  open: boolean;
  onWissel: () => void;
  children: ReactNode;
}) => (
  <Kaartje className="scroll-mt-4 overflow-hidden">
    <section id={`gegevens-${id}`} aria-labelledby={`gegevens-${id}-kop`}>
      <button
        type="button"
        onClick={onWissel}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="min-w-0 flex-1">
          <span id={`gegevens-${id}-kop`} className="block font-semibold">
            {titel}
          </span>
          <span className="block text-sm text-inkt-zacht dark:text-papier/60">{samenvatting}</span>
        </span>
        <ChevronDown
          className={`size-5 shrink-0 text-inkt-zacht transition ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open && <div className="border-t border-black/5 p-4 dark:border-white/10">{children}</div>}
    </section>
  </Kaartje>
);

/** Eén regel in de weergave: een label en een waarde. */
export const Regel = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid grid-cols-[7.5rem_1fr] gap-2 py-1 text-sm">
    <dt className="text-inkt-zacht dark:text-papier/60">{label}</dt>
    <dd className="min-w-0 break-words">{children}</dd>
  </div>
);

export const Melding = ({
  children,
  toon = 'let-op',
}: {
  children: ReactNode;
  toon?: 'let-op' | 'goed';
}) => (
  <p
    className={`rounded-xl p-3 text-sm leading-relaxed ${
      toon === 'goed'
        ? 'bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100'
        : 'bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100'
    }`}
  >
    {children}
  </p>
);
