import type { Dagnotitie, OpgeslagenSpoor, Plaats, Stad } from '@/domein/schema';
import {
  groepeerPerDag,
  plaatsVoorFoto,
  stadVoorPunt,
  type Foto,
  type Reisoverzicht,
} from '@/domein/fotos/reis';
import { alsAfstand, alsSamenvatting, alsSvg } from '@/domein/sporen/spoor';
import { alsDagLabel } from '@/features/jetlag/tekst';

/**
 * Het reisverslag: de reis als één pagina die je kunt bewaren of doorsturen.
 *
 * Dag voor dag, van de eerste tot de laatste dag van de reis: waar je was, je
 * hoogtepunt en je notitie, waar je fotografeerde en welke route je liep.
 *
 * Bewust zonder foto's. Die staan op je toestel en horen daar te blijven; een
 * bestand van tweehonderd megabyte doorsturen is bovendien onhandig. Gelopen
 * routes staan er als kleine SVG in, zonder kaart eronder: de vorm van de dag
 * en de cijfers. Waar je sliep komt er alleen in als je daar zelf voor kiest.
 *
 * Eén los HTML-bestand zonder verwijzingen naar buiten, zodat het over tien jaar
 * nog opent.
 */

export interface Verslaginvoer {
  fotos: Foto[];
  steden: Stad[];
  plaatsen: Plaats[];
  cijfers: Reisoverzicht;
  sporen?: readonly OpgeslagenSpoor[];
  notities?: readonly Dagnotitie[];
  /** De dagen van de reis volgens het schema, met de steden van die dag. */
  reisdagen?: readonly { datum: string; steden: string[] }[];
  /**
   * Waar je elke nacht sliep, per datum. Alleen gevuld als je "persoonlijke
   * gegevens meenemen" aanzette; anders staat er niets over je verblijven in.
   */
  verblijven?: ReadonlyMap<string, string>;
}

const ontsnap = (tekst: string): string =>
  tekst.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Alinea's bij een lege regel, een gewone regelovergang blijft er een. */
const alsAlineas = (tekst: string): string =>
  tekst
    .trim()
    .split(/\n\s*\n/)
    .map((alinea) => `<p class="notitie">${ontsnap(alinea.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');

const alsDatum = (datum: string | undefined): string => {
  if (!datum) return 'onbekend';
  return new Date(datum.length === 10 ? `${datum}T12:00:00Z` : datum).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

export const maakReisverslag = ({
  fotos,
  steden,
  plaatsen,
  cijfers,
  sporen = [],
  notities = [],
  reisdagen = [],
  verblijven,
}: Verslaginvoer): string => {
  const fotodagen = groepeerPerDag(fotos, steden);
  const naamVan = (id: string): string => steden.find((s) => s.id === id)?.naam ?? id;

  // Elke dag van de reis, plus elke dag daarbuiten waar iets van jou bij hoort.
  const datums = [
    ...new Set([
      ...reisdagen.map((d) => d.datum),
      ...fotodagen.map((d) => d.datum),
      ...sporen.flatMap((s) => (s.datum ? [s.datum] : [])),
      ...notities.map((n) => n.datum),
    ]),
  ].sort();

  const routeBlok = (routes: readonly OpgeslagenSpoor[]): string => {
    if (routes.length === 0) return '';
    const regels = routes
      .map(
        (r) =>
          `<li><span class="stip" style="background:${ontsnap(r.kleur)}"></span>${ontsnap(r.naam)}: ${ontsnap(alsSamenvatting(r.statistiek))}</li>`,
      )
      .join('');
    return `<div class="routes">${alsSvg(routes)}<ul>${regels}</ul></div>`;
  };

  const dagRegels = datums
    .map((datum) => {
      const reisdag = reisdagen.find((d) => d.datum === datum);
      const fotodag = fotodagen.find((d) => d.datum === datum);
      const routes = sporen.filter((s) => s.datum === datum);
      const notitie = notities.find((n) => n.datum === datum);
      const begin = routes[0]?.lijnen[0]?.[0];

      const stadIds =
        reisdag && reisdag.steden.length > 0
          ? reisdag.steden
          : fotodag?.stadId
            ? [fotodag.stadId]
            : begin
              ? [stadVoorPunt({ lat: begin[0], lon: begin[1] }, steden)?.id].filter(
                  (id): id is string => !!id,
                )
              : [];
      const stad = stadIds.length > 0 ? stadIds.map(naamVan).join(' en ') : 'onderweg';
      const dagnummer = reisdagen.findIndex((d) => d.datum === datum);

      // Welke plekken je die dag gefotografeerd hebt. Dubbele eruit, want tien
      // foto's van dezelfde tempel is één bezoek.
      const bezocht = new Set<string>();
      for (const foto of fotodag?.fotos ?? []) {
        const plaats = foto.plaatsId
          ? plaatsen.find((p) => p.id === foto.plaatsId)
          : plaatsVoorFoto(foto, plaatsen);
        if (plaats) bezocht.add(plaats.naam);
      }
      const aantal = fotodag?.fotos.length ?? 0;
      const fotoregel =
        aantal > 0
          ? `<p class="telling">${aantal} ${aantal === 1 ? 'foto' : "foto's"}${
              bezocht.size > 0 ? `: ${[...bezocht].map(ontsnap).join(' · ')}` : ''
            }</p>`
          : '';

      const hoogtepunt = notitie?.hoogtepunt
        ? `<p class="hoogtepunt">${ontsnap(notitie.hoogtepunt)}</p>`
        : '';
      const tekst = notitie?.notitie.trim() ? alsAlineas(notitie.notitie) : '';
      const nacht = verblijven?.get(datum);
      const verblijf = nacht ? `<p class="telling">Geslapen in ${ontsnap(nacht)}</p>` : '';

      return `<li>
        <h3><time datetime="${datum}">${ontsnap(alsDagLabel(datum))}</time> <span>${ontsnap(stad)}</span></h3>
        ${dagnummer >= 0 ? `<p class="dagnummer">Dag ${dagnummer + 1}</p>` : ''}
        ${hoogtepunt}
        ${tekst}
        ${fotoregel}
        ${routeBlok(routes)}
        ${verblijf}
      </li>`;
    })
    .join('\n');

  const zonderDag = sporen.filter((s) => !s.datum);
  const zonderDagBlok =
    zonderDag.length > 0 ? `<h2>Routes zonder dag</h2>${routeBlok(zonderDag)}` : '';

  const eerste = reisdagen[0]?.datum ?? cijfers.eersteFoto ?? datums[0];
  const laatste = reisdagen[reisdagen.length - 1]?.datum ?? cijfers.laatsteFoto ?? datums.at(-1);
  const totaalRoutes = sporen.reduce((som, s) => som + s.statistiek.afstandM, 0);
  const geschreven = notities.filter((n) => n.notitie.trim() || n.hoogtepunt).length;
  const cijferregels = [
    cijfers.aantalFotos > 0 &&
      `${cijfers.aantalFotos} foto's over ${cijfers.aantalDagen} ${cijfers.aantalDagen === 1 ? 'dag' : 'dagen'}`,
    cijfers.aantalFotos > 0 &&
      `${cijfers.hemelsbredeAfstandKm.toLocaleString('nl-NL')} kilometer hemelsbreed, van de eerste tot de laatste foto`,
    sporen.length > 0 &&
      `${sporen.length} ${sporen.length === 1 ? 'gelopen route' : 'gelopen routes'}, samen ${alsAfstand(totaalRoutes)}`,
    geschreven > 0 && `${geschreven} ${geschreven === 1 ? 'dag' : 'dagen'} met een notitie`,
    cijfers.stedenBezocht.length > 0 &&
      `Steden op de route: ${cijfers.stedenBezocht.map(naamVan).join(', ')}`,
  ]
    .filter((r): r is string => !!r)
    .map((r) => `<li>${ontsnap(r)}</li>`)
    .join('\n    ');

  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reisverslag Japan en Hanoi</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0 auto; padding: 2rem 1.25rem 4rem; max-width: 40rem;
    font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    background: #faf7f2; color: #24201c;
  }
  @media (prefers-color-scheme: dark) { body { background: #17150f; color: #faf7f2; } }
  h1 { font-size: 1.8rem; margin: 0 0 .25rem; letter-spacing: -.01em; }
  .onder { color: #8c2f39; margin: 0 0 2rem; }
  .cijfers { list-style: none; padding: 0; margin: 0 0 2.5rem; display: grid; gap: .35rem; }
  ol { list-style: none; padding: 0; margin: 0; display: grid; gap: 1.5rem; }
  ol li { border-left: 2px solid #8c2f39; padding-left: 1rem; }
  h3 { font-size: 1rem; margin: 0; }
  h3 span { font-weight: 400; opacity: .65; margin-left: .35rem; }
  .dagnummer { margin: 0; font-size: .8rem; opacity: .55; }
  .hoogtepunt { margin: .4rem 0 0; font-weight: 600; color: #8c2f39; }
  .notitie { margin: .4rem 0 0; }
  .telling { margin: .35rem 0 0; font-size: .9rem; opacity: .75; }
  h2 { font-size: 1.1rem; margin: 2.5rem 0 .75rem; }
  .routes { margin: .6rem 0 0; }
  .routes svg { display: block; max-width: 100%; height: auto; margin-bottom: .35rem; }
  .routes ul { list-style: none; padding: 0; margin: 0; font-size: .9rem; }
  .stip { display: inline-block; width: .6rem; height: .6rem; border-radius: 50%; margin-right: .4rem; }
  footer { margin-top: 3rem; font-size: .8rem; opacity: .55; }
</style>
</head>
<body>
  <h1>Japan en Hanoi</h1>
  <p class="onder">${ontsnap(alsDatum(eerste))} tot ${ontsnap(alsDatum(laatste))}</p>

  <ul class="cijfers">
    ${cijferregels}
  </ul>

  <ol>
${dagRegels}
  </ol>
  ${zonderDagBlok}

  <footer>
    Gemaakt met de reisapp. Dit verslag bevat de route, de plekken en je notities, en geen
    foto's: die staan op het toestel waar ze gemaakt zijn.${
      verblijven && verblijven.size > 0 ? ' Met de namen van de verblijven.' : ''
    }
  </footer>
</body>
</html>`;
};
