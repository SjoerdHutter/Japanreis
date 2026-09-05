import type { Plaats, Stad } from '@/domein/schema';
import { groepeerPerDag, plaatsVoorFoto, type Foto, type Reisoverzicht } from '@/domein/fotos/reis';

/**
 * Het reisverslag: de reis als één pagina die je kunt bewaren of doorsturen.
 *
 * Bewust zonder foto's. Die staan op je toestel en horen daar te blijven; een
 * bestand van tweehonderd megabyte doorsturen is bovendien onhandig. Wat er wel
 * in staat is de route: welke dagen, welke steden, welke plekken. Dat is precies
 * wat een vriend die later gaat eraan heeft.
 *
 * Eén los HTML-bestand zonder verwijzingen naar buiten, zodat het over tien jaar
 * nog opent.
 */

const ontsnap = (tekst: string): string =>
  tekst.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const alsDatum = (iso: string | undefined): string => {
  if (!iso) return 'onbekend';
  return new Date(iso).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const maakReisverslag = (
  fotos: Foto[],
  steden: Stad[],
  plaatsen: Plaats[],
  cijfers: Reisoverzicht,
): string => {
  const dagen = groepeerPerDag(fotos, steden);
  const naamVan = (id: string): string => steden.find((s) => s.id === id)?.naam ?? id;

  const dagRegels = dagen
    .map((dag) => {
      const stad = dag.stadId ? naamVan(dag.stadId) : 'onderweg';

      // Welke plekken je die dag gefotografeerd hebt. Dubbele eruit, want tien
      // foto's van dezelfde tempel is één bezoek.
      const bezocht = new Set<string>();
      for (const foto of dag.fotos) {
        const plaats = foto.plaatsId
          ? plaatsen.find((p) => p.id === foto.plaatsId)
          : plaatsVoorFoto(foto, plaatsen);
        if (plaats) bezocht.add(plaats.naam);
      }

      const plekken =
        bezocht.size > 0 ? `<p class="plekken">${[...bezocht].map(ontsnap).join(' · ')}</p>` : '';

      return `<li>
        <h3>${ontsnap(dag.datum)} <span>${ontsnap(stad)}</span></h3>
        <p class="telling">${dag.fotos.length} ${dag.fotos.length === 1 ? 'foto' : "foto's"}</p>
        ${plekken}
      </li>`;
    })
    .join('\n');

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
  ol { list-style: none; padding: 0; margin: 0; display: grid; gap: 1.25rem; }
  ol li { border-left: 2px solid #8c2f39; padding-left: 1rem; }
  h3 { font-size: 1rem; margin: 0; }
  h3 span { font-weight: 400; opacity: .65; margin-left: .35rem; }
  .telling, .plekken { margin: .25rem 0 0; font-size: .9rem; opacity: .75; }
  footer { margin-top: 3rem; font-size: .8rem; opacity: .55; }
</style>
</head>
<body>
  <h1>Japan en Hanoi</h1>
  <p class="onder">${ontsnap(alsDatum(cijfers.eersteFoto))} tot ${ontsnap(alsDatum(cijfers.laatsteFoto))}</p>

  <ul class="cijfers">
    <li>${cijfers.aantalFotos} foto's over ${cijfers.aantalDagen} ${cijfers.aantalDagen === 1 ? 'dag' : 'dagen'}</li>
    <li>${cijfers.hemelsbredeAfstandKm.toLocaleString('nl-NL')} kilometer hemelsbreed, van de eerste tot de laatste foto</li>
    <li>Steden op de route: ${cijfers.stedenBezocht.map((id) => ontsnap(naamVan(id))).join(', ') || 'geen'}</li>
  </ul>

  <ol>
${dagRegels}
  </ol>

  <footer>
    Gemaakt met de reisapp. Dit verslag bevat de route en de plekken, en geen foto's:
    die staan op het toestel waar ze gemaakt zijn.
  </footer>
</body>
</html>`;
};
