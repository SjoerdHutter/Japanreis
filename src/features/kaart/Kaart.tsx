import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import type { Coordinaat, Kaartgebied, Plaats } from '@/domein/schema';
import { TEGEL_BRONVERMELDING, TEGEL_URL } from '@/kaart/constanten';

/**
 * De kaart.
 *
 * Clustering zit er vanaf het begin in en niet als latere toevoeging. Straks
 * liggen hier attracties, eetlocaties, stempels, eigen punten uit Google Maps,
 * Instagram-tips en foto's op één kaart; zonder clustering is dat in een
 * stadscentrum één onleesbare kluit spelden.
 *
 * De laag waar een punt bij hoort bepaalt zijn kleur. De persoonlijke laag
 * (eigen punten en tips) krijgt met opzet een andere kleur dan de redactionele
 * content, zodat altijd zichtbaar blijft wat van jou is en wat van de app.
 */

export type Laag =
  'attractie' | 'eten' | 'spa' | 'stempel' | 'eigen' | 'foto' | 'uitgang' | 'overig';

const KLEUR: Record<Laag, string> = {
  attractie: '#8c2f39',
  eten: '#b45309',
  spa: '#a21caf',
  stempel: '#2f4858',
  eigen: '#4338ca',
  foto: '#0f766e',
  // De uitgangen van een station, in het blauw van de reis.
  uitgang: '#2f4858',
  overig: '#5c554c',
};

/**
 * Een teken in de speld, voor de lagen die je anders niet uit elkaar houdt. Een
 * spa krijgt het teken voor warme bronnen, dat je in heel Azië op badhuizen
 * en spa's ziet.
 */
const TEKEN: Partial<Record<Laag, string>> = { spa: '♨' };

export const laagVan = (plaats: Plaats): Laag => {
  if (plaats.ekiStempel || plaats.goshuin) return 'stempel';
  if (plaats.categorie === 'eten') return 'eten';
  if (plaats.categorie === 'attractie') return 'attractie';
  if (plaats.categorie === 'spa') return 'spa';
  return 'overig';
};

const speld = (laag: Laag): L.DivIcon => {
  const teken = TEKEN[laag];
  if (teken) {
    return L.divIcon({
      className: '',
      html: `<span style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:9999px;background:${KLEUR[laag]};border:2px solid #fff;box-shadow:0 1px 4px rgb(0 0 0 / .4);color:#fff;font-size:12px;line-height:1">${teken}</span>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  }
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${KLEUR[laag]};border:2.5px solid #fff;box-shadow:0 1px 4px rgb(0 0 0 / .4)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

/**
 * Een laag die je in de lagenknop aan en uit zet: geldautomaten, kluisjes,
 * toiletten. Staat standaard uit, en de spelden worden pas gemaakt als je hem
 * aanzet; een stadskaart met drieduizend toiletten erop is anders traag op
 * een telefoon.
 */
export interface KaartOverlay {
  id: string;
  naam: string;
  kleur: string;
  /** Eén of twee tekens in het rondje, zoals ¥ of WC. */
  teken: string;
  punten: { lat: number; lon: number; titel: string; regels: string[] }[];
}

const LAGEN_SLEUTEL = 'japanreis.kaartlagen';

const leesAanstaand = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(LAGEN_SLEUTEL) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
};

const bewaarAanstaand = (ids: Set<string>) => {
  try {
    localStorage.setItem(LAGEN_SLEUTEL, JSON.stringify([...ids]));
  } catch {
    /* geen localStorage: dan staan de lagen de volgende keer weer uit */
  }
};

const laagIcoon = (laag: KaartOverlay): L.DivIcon =>
  L.divIcon({
    className: '',
    html: `<span class="kaartlaag-icoon" style="background:${laag.kleur}">${laag.teken}</span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

const laagBallon = (punt: KaartOverlay['punten'][number]): HTMLElement => {
  const ballon = document.createElement('div');
  const titel = document.createElement('strong');
  titel.textContent = punt.titel;
  ballon.append(titel);
  for (const regel of punt.regels) {
    const p = document.createElement('p');
    p.className = 'mt-1 text-xs';
    p.textContent = regel;
    ballon.append(p);
  }
  return ballon;
};

/** Een gelopen route: een of meer lijnen in één kleur. */
export interface KaartSpoor {
  id: string;
  naam: string;
  kleur: string;
  lijnen: [number, number][][];
}

export interface KaartPunt {
  id: string;
  naam: string;
  coordinaten: Coordinaat;
  laag: Laag;
  /** Wat er in de ballon komt te staan, als platte tekst. */
  toelichting?: string;
}

export const Kaart = ({
  punten,
  gebied,
  positie,
  hoogte = '20rem',
  lijn,
  onKies,
  onTikOpKaart,
  onLangDrukken,
  clusteren = true,
  lagen,
  sporen,
}: {
  punten: KaartPunt[];
  /** Gelopen routes uit GPX-bestanden, als doorgetrokken lijnen. */
  sporen?: KaartSpoor[];
  /** Lagen voor de lagenknop rechtsboven. */
  lagen?: KaartOverlay[];
  /**
   * De reis als doorlopende lijn. Met opzet niet per stad geknipt: dan zou de
   * vlucht van Hanoi naar Tokio uit de kaart verdwijnen en zou de reis eruitzien
   * als losse eilanden.
   */
  lijn?: Coordinaat[];
  /** Waar de kaart op begint. Meestal het kaartgebied van de stad. */
  gebied: Kaartgebied;
  positie?: Coordinaat | null;
  hoogte?: string;
  onKies?: (id: string) => void;
  /**
   * Een tik op de kaart zelf, voor het handmatig plaatsen van een punt of een
   * foto zonder GPS. Tikken en niet slepen: op een telefoon is een speld van
   * zestien pixels lastig te pakken, en het resultaat is hetzelfde.
   */
  onTikOpKaart?: (plek: Coordinaat) => void;
  /**
   * Lang drukken op de kaart, om een plek zonder locatie neer te zetten. Lang en
   * niet kort: dan zet je niet per ongeluk een pin als je de kaart wilt schuiven.
   * Leaflet maakt van lang drukken op een telefoon hetzelfde als een rechtsklik.
   */
  onLangDrukken?: (plek: Coordinaat) => void;
  /**
   * Punten die dicht bij elkaar liggen samenvoegen tot een bolletje met een
   * getal. Op een stadskaart onmisbaar, op de kaart van een station juist niet:
   * daar gaat het erom dat je de twee uitgangen naast elkaar ziet liggen.
   */
  clusteren?: boolean;
}) => {
  const houder = useRef<HTMLDivElement>(null);
  const kaart = useRef<L.Map | null>(null);
  const groep = useRef<L.MarkerClusterGroup | null>(null);
  const ikRef = useRef<L.CircleMarker | null>(null);
  const lijnRef = useRef<L.Polyline | null>(null);
  const sporenRef = useRef<L.LayerGroup | null>(null);
  const lagenRef = useRef<{ knop: L.Control.Layers; groepen: L.Layer[] } | null>(null);
  // In een ref, zodat een nieuwe onKies de markers niet opnieuw laat bouwen.
  const kiesRef = useRef(onKies);
  useEffect(() => {
    kiesRef.current = onKies;
  }, [onKies]);
  // Alleen bij het opbouwen van de kaart gelezen; wisselen daarna doet niets.
  const clusterenRef = useRef(clusteren);
  const tikRef = useRef(onTikOpKaart);
  useEffect(() => {
    tikRef.current = onTikOpKaart;
  }, [onTikOpKaart]);
  const langRef = useRef(onLangDrukken);
  useEffect(() => {
    langRef.current = onLangDrukken;
  }, [onLangDrukken]);

  useEffect(() => {
    if (!houder.current || kaart.current) return;

    const m = L.map(houder.current, { zoomControl: true, attributionControl: true });
    L.tileLayer(TEGEL_URL, { maxZoom: 19, attribution: TEGEL_BRONVERMELDING }).addTo(m);

    groep.current = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 48,
      // Vanaf zoomniveau 1 niet meer samenvoegen is in de praktijk: nooit.
      ...(clusterenRef.current ? {} : { disableClusteringAtZoom: 1 }),
      iconCreateFunction: (cluster) => {
        const aantal = cluster.getChildCount();
        const maat = aantal < 10 ? 30 : aantal < 50 ? 36 : 42;
        return L.divIcon({
          html: `<span class="reis-cluster" style="width:${maat}px;height:${maat}px;background:${KLEUR.attractie}">${aantal}</span>`,
          className: '',
          iconSize: L.point(maat, maat),
        });
      },
    });
    m.addLayer(groep.current);
    m.on('click', (gebeurtenis) => {
      tikRef.current?.({ lat: gebeurtenis.latlng.lat, lon: gebeurtenis.latlng.lng });
    });
    m.on('contextmenu', (gebeurtenis) => {
      langRef.current?.({ lat: gebeurtenis.latlng.lat, lon: gebeurtenis.latlng.lng });
    });
    kaart.current = m;

    return () => {
      // Eerst loslaten, dan opruimen: zo telt het weghalen van de lagen bij het
      // sluiten van de kaart niet als "laag uitgezet".
      kaart.current = null;
      m.remove();
      groep.current = null;
      ikRef.current = null;
      lijnRef.current = null;
      sporenRef.current = null;
      lagenRef.current = null;
    };
  }, []);

  // De lagenknop. Opnieuw opgebouwd als de lagen veranderen, bijvoorbeeld bij
  // een andere stad; welke lagen aan staan onthoudt het toestel.
  useEffect(() => {
    const m = kaart.current;
    if (!m) return;
    if (lagenRef.current) {
      lagenRef.current.knop.remove();
      for (const groep of lagenRef.current.groepen) {
        groep.off('remove');
        groep.remove();
      }
      lagenRef.current = null;
    }
    if (!lagen || lagen.length === 0) return;

    const aan = leesAanstaand();
    const overlays: Record<string, L.Layer> = {};
    const groepen: L.Layer[] = [];
    for (const laag of lagen) {
      const groep = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 40,
        disableClusteringAtZoom: 17,
        iconCreateFunction: (cluster) => {
          const aantal = cluster.getChildCount();
          const maat = aantal < 10 ? 24 : aantal < 100 ? 30 : 36;
          return L.divIcon({
            html: `<span class="reis-cluster" style="width:${maat}px;height:${maat}px;background:${laag.kleur}">${aantal}</span>`,
            className: '',
            iconSize: L.point(maat, maat),
          });
        },
      });
      let gevuld = false;
      groep.on('add', () => {
        if (gevuld) return;
        gevuld = true;
        const icoon = laagIcoon(laag);
        groep.addLayers(
          laag.punten.map((punt) =>
            L.marker([punt.lat, punt.lon], { icon: icoon, title: punt.titel }).bindPopup(
              laagBallon(punt),
            ),
          ),
        );
      });
      groep.on('add', () => {
        aan.add(laag.id);
        bewaarAanstaand(aan);
      });
      groep.on('remove', () => {
        if (!kaart.current) return;
        aan.delete(laag.id);
        bewaarAanstaand(aan);
      });
      overlays[
        `<span class="kaartlaag-label"><span class="kaartlaag-icoon" style="background:${laag.kleur}">${laag.teken}</span>${laag.naam} <span class="kaartlaag-aantal">${laag.punten.length}</span></span>`
      ] = groep;
      groepen.push(groep);
      if (aan.has(laag.id)) groep.addTo(m);
    }
    const knop = L.control.layers(undefined, overlays, { collapsed: true, position: 'topright' });
    knop.addTo(m);
    lagenRef.current = { knop, groepen };
  }, [lagen]);

  // Het beeld op het gebied van de stad zetten. Apart van de opbouw, zodat
  // wisselen van stad de kaart niet opnieuw laat opbouwen.
  useEffect(() => {
    kaart.current?.fitBounds(
      L.latLngBounds(
        [gebied.zuidwest.lat, gebied.zuidwest.lon],
        [gebied.noordoost.lat, gebied.noordoost.lon],
      ),
      { padding: [16, 16] },
    );
  }, [gebied]);

  useEffect(() => {
    const g = groep.current;
    if (!g) return;
    g.clearLayers();
    for (const punt of punten) {
      const marker = L.marker([punt.coordinaten.lat, punt.coordinaten.lon], {
        icon: speld(punt.laag),
        title: punt.naam,
      });
      const naam = document.createElement('strong');
      naam.textContent = punt.naam;
      const ballon = document.createElement('div');
      ballon.append(naam);
      if (punt.toelichting) {
        const p = document.createElement('p');
        p.className = 'mt-1 text-xs';
        p.textContent = punt.toelichting;
        ballon.append(p);
      }
      marker.bindPopup(ballon);
      marker.on('click', () => kiesRef.current?.(punt.id));
      g.addLayer(marker);
    }
  }, [punten]);

  useEffect(() => {
    const m = kaart.current;
    if (!m) return;
    lijnRef.current?.remove();
    lijnRef.current = null;
    if (!lijn || lijn.length < 2) return;
    lijnRef.current = L.polyline(
      lijn.map((p) => [p.lat, p.lon] as [number, number]),
      { color: KLEUR.foto, weight: 2.5, opacity: 0.85, dashArray: '1 6', lineCap: 'round' },
    ).addTo(m);
  }, [lijn]);

  // De sporen onder de spelden, zodat een foto op de route aanklikbaar blijft.
  useEffect(() => {
    const m = kaart.current;
    if (!m) return;
    sporenRef.current?.remove();
    sporenRef.current = null;
    if (!sporen || sporen.length === 0) return;
    const groep = L.layerGroup();
    for (const spoor of sporen) {
      const lijnen = spoor.lijnen.filter((l) => l.length >= 2);
      if (lijnen.length === 0) continue;
      const titel = document.createElement('strong');
      titel.textContent = spoor.naam;
      L.polyline(lijnen, {
        color: spoor.kleur,
        weight: 4,
        opacity: 0.85,
        lineJoin: 'round',
        lineCap: 'round',
      })
        .bindPopup(titel)
        .addTo(groep);
    }
    groep.addTo(m);
    sporenRef.current = groep;
  }, [sporen]);

  // Je eigen positie als apart bolletje. Geen speld, want het is geen plaats.
  useEffect(() => {
    const m = kaart.current;
    if (!m) return;
    if (!positie) {
      ikRef.current?.remove();
      ikRef.current = null;
      return;
    }
    if (ikRef.current) {
      ikRef.current.setLatLng([positie.lat, positie.lon]);
      return;
    }
    ikRef.current = L.circleMarker([positie.lat, positie.lon], {
      radius: 7,
      color: '#fff',
      weight: 2.5,
      fillColor: '#1d4ed8',
      fillOpacity: 1,
    }).addTo(m);
  }, [positie]);

  return (
    <div
      ref={houder}
      style={{ height: hoogte }}
      className="w-full overflow-hidden rounded-2xl border border-black/10 dark:border-white/10"
      role="application"
      aria-label="Kaart"
    />
  );
};
