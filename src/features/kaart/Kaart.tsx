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

export type Laag = 'attractie' | 'eten' | 'stempel' | 'eigen' | 'overig';

const KLEUR: Record<Laag, string> = {
  attractie: '#8c2f39',
  eten: '#b45309',
  stempel: '#2f4858',
  eigen: '#4338ca',
  overig: '#5c554c',
};

export const laagVan = (plaats: Plaats): Laag => {
  if (plaats.ekiStempel || plaats.goshuin) return 'stempel';
  if (plaats.categorie === 'eten') return 'eten';
  if (plaats.categorie === 'attractie') return 'attractie';
  return 'overig';
};

const speld = (laag: Laag): L.DivIcon =>
  L.divIcon({
    className: '',
    html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${KLEUR[laag]};border:2.5px solid #fff;box-shadow:0 1px 4px rgb(0 0 0 / .4)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

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
  onKies,
  onTikOpKaart,
}: {
  punten: KaartPunt[];
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
}) => {
  const houder = useRef<HTMLDivElement>(null);
  const kaart = useRef<L.Map | null>(null);
  const groep = useRef<L.MarkerClusterGroup | null>(null);
  const ikRef = useRef<L.CircleMarker | null>(null);
  // In een ref, zodat een nieuwe onKies de markers niet opnieuw laat bouwen.
  const kiesRef = useRef(onKies);
  useEffect(() => {
    kiesRef.current = onKies;
  }, [onKies]);
  const tikRef = useRef(onTikOpKaart);
  useEffect(() => {
    tikRef.current = onTikOpKaart;
  }, [onTikOpKaart]);

  useEffect(() => {
    if (!houder.current || kaart.current) return;

    const m = L.map(houder.current, { zoomControl: true, attributionControl: true });
    L.tileLayer(TEGEL_URL, { maxZoom: 19, attribution: TEGEL_BRONVERMELDING }).addTo(m);

    groep.current = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 48,
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
    kaart.current = m;

    return () => {
      m.remove();
      kaart.current = null;
      groep.current = null;
      ikRef.current = null;
    };
  }, []);

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
