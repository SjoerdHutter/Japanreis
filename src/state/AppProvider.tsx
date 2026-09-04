import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Coordinaat, Stad } from '@/domein/schema';
import { REISSCHEMA, STEDEN } from '@/data/content';
import { INGEBAKKEN_KOERS, haalKoersOp, type Koersen } from '@/domein/valuta/koers';
import {
  bepaalHighlight,
  keuzeGeldig,
  maakKeuze,
  type Keuze,
  type Uitkomst,
} from '@/domein/highlight/bepaal';
import { lees, schrijf, verwijder } from '@/data/db/idb';

/**
 * De toestand die de hele app deelt: de wisselkoers, waar je bent, en welke
 * stad bovenaan staat.
 *
 * Bewust klein gehouden. Alles wat per scherm verschilt (filters, welke kaart
 * je open hebt) hoort in dat scherm zelf; hier staat alleen wat overal nodig
 * is en wat het toestel moet onthouden.
 */

export interface AppToestand {
  steden: Stad[];
  koersen: Koersen;
  koersVerversen: () => void;
  /** De GPS-positie, als die er is. Ontbreken is een normale toestand. */
  positie: Coordinaat | null;
  locatieStatus: 'uit' | 'vragen' | 'aan' | 'geweigerd' | 'mislukt';
  vraagLocatie: () => void;
  zetLocatieUit: () => void;
  highlight: Uitkomst;
  /** Zet een stad bovenaan. `vastgezet` als er geen conflict was om op te lossen. */
  kiesStad: (stadId: string, opties?: { tweedeStadId?: string; vastgezet?: boolean }) => void;
  /** Terug naar de automatische bepaling. */
  laatLos: () => void;
  onthoudBezoek: (stadId: string) => void;
}

export const AppContext = createContext<AppToestand | null>(null);

/** Elke minuut opnieuw kijken; dan valt de keuze om middernacht vanzelf weg. */
const TIK = 60_000;

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [koersen, setKoersen] = useState<Koersen>(INGEBAKKEN_KOERS);
  const [positie, setPositie] = useState<Coordinaat | null>(null);
  const [locatieStatus, setLocatieStatus] = useState<AppToestand['locatieStatus']>('uit');
  const [keuze, setKeuze] = useState<Keuze | undefined>();
  const [laatstBekeken, setLaatstBekeken] = useState<string | undefined>();
  const [nu, setNu] = useState(() => new Date());
  const kijker = useRef<number | null>(null);

  // De klok laten lopen. Zonder dit blijft een keuze na middernacht hangen tot
  // je de app opnieuw opent, en dat is precies de ochtend waarop je in een
  // andere stad wakker wordt.
  useEffect(() => {
    const id = window.setInterval(() => setNu(new Date()), TIK);
    // Terugkomen in de app telt ook als een tik: de timer staat stil terwijl
    // het scherm uit is.
    const bijTerugkeer = () => {
      if (!document.hidden) setNu(new Date());
    };
    document.addEventListener('visibilitychange', bijTerugkeer);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', bijTerugkeer);
    };
  }, []);

  // Wat het toestel onthouden heeft, terughalen bij het opstarten.
  useEffect(() => {
    void (async () => {
      const [bewaardeKoers, bewaardeKeuze, bewaardeStad] = await Promise.all([
        lees('koers.laatste'),
        lees('highlight.keuze'),
        lees('stad.laatstBekeken'),
      ]);
      if (bewaardeKoers) setKoersen({ ...bewaardeKoers, bron: 'opgeslagen' });
      if (bewaardeKeuze) setKeuze(bewaardeKeuze);
      if (bewaardeStad) setLaatstBekeken(bewaardeStad);
    })();
  }, []);

  const koersVerversen = useCallback(() => {
    void (async () => {
      const vers = await haalKoersOp();
      if (!vers) return;
      setKoersen(vers);
      await schrijf('koers.laatste', vers);
    })();
  }, []);

  // Bij het opstarten één poging tot een verse koers. Mislukt hij, dan blijft
  // staan wat er al was; de gebruiker ziet in de instellingen van wanneer die is.
  useEffect(() => koersVerversen(), [koersVerversen]);

  const zetLocatieUit = useCallback(() => {
    if (kijker.current !== null) {
      navigator.geolocation.clearWatch(kijker.current);
      kijker.current = null;
    }
    setPositie(null);
    setLocatieStatus('uit');
  }, []);

  const vraagLocatie = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocatieStatus('mislukt');
      return;
    }
    setLocatieStatus('vragen');
    kijker.current = navigator.geolocation.watchPosition(
      (p) => {
        setPositie({ lat: p.coords.latitude, lon: p.coords.longitude });
        setLocatieStatus('aan');
      },
      (fout) => {
        // Geweigerd is iets anders dan mislukt: het eerste vraag je niet nog
        // een keer, het tweede kan onderweg vanzelf goed komen.
        setLocatieStatus(fout.code === fout.PERMISSION_DENIED ? 'geweigerd' : 'mislukt');
      },
      { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 20_000 },
    );
  }, []);

  useEffect(() => () => zetLocatieUit(), [zetLocatieUit]);

  const highlight = useMemo(
    () =>
      bepaalHighlight({
        steden: STEDEN,
        reisschema: REISSCHEMA,
        positie: positie ?? undefined,
        keuze: keuzeGeldig(keuze, nu) ? keuze : undefined,
        laatstBekekenStadId: laatstBekeken,
        nu,
      }),
    [positie, keuze, laatstBekeken, nu],
  );

  const kiesStad = useCallback<AppToestand['kiesStad']>((stadId, opties = {}) => {
    const stad = STEDEN.find((s) => s.id === stadId);
    if (!stad) return;
    const nieuw = maakKeuze(stad, opties);
    setKeuze(nieuw);
    void schrijf('highlight.keuze', nieuw);
  }, []);

  const laatLos = useCallback(() => {
    setKeuze(undefined);
    void verwijder('highlight.keuze');
  }, []);

  const onthoudBezoek = useCallback((stadId: string) => {
    setLaatstBekeken(stadId);
    void schrijf('stad.laatstBekeken', stadId);
  }, []);

  const waarde = useMemo<AppToestand>(
    () => ({
      steden: STEDEN,
      koersen,
      koersVerversen,
      positie,
      locatieStatus,
      vraagLocatie,
      zetLocatieUit,
      highlight,
      kiesStad,
      laatLos,
      onthoudBezoek,
    }),
    [
      koersen,
      koersVerversen,
      positie,
      locatieStatus,
      vraagLocatie,
      zetLocatieUit,
      highlight,
      kiesStad,
      laatLos,
      onthoudBezoek,
    ],
  );

  return <AppContext.Provider value={waarde}>{children}</AppContext.Provider>;
};
