/**
 * Een miniatuur maken van een foto.
 *
 * Zonder dit legt een galerij van vijftig vakantiefoto's een telefoon plat: elk
 * plaatje van vier megabyte moet dan bij elke keer scrollen opnieuw gedecodeerd
 * worden. Met een miniatuur van een paar tientallen kilobytes blijft dat vlot,
 * en het origineel blijft gewoon bewaard voor als je een foto groot bekijkt.
 */

/** Langste zijde van de miniatuur, in pixels. Genoeg voor een scherm met dubbele dichtheid. */
const MAX_ZIJDE = 480;

export interface Miniatuur {
  blob: Blob;
  breedte: number;
  hoogte: number;
}

/**
 * Schaalt de foto terug. Gooit als het bestand geen leesbare afbeelding is; de
 * aanroeper laat die foto dan buiten de verzameling, want een foto die de
 * browser niet kan tekenen valt ook op de kaart niet te tonen.
 */
export const maakMiniatuur = async (bestand: Blob): Promise<Miniatuur> => {
  const bitmap = await createImageBitmap(bestand);
  try {
    const schaal = Math.min(1, MAX_ZIJDE / Math.max(bitmap.width, bitmap.height));
    const breedte = Math.max(1, Math.round(bitmap.width * schaal));
    const hoogte = Math.max(1, Math.round(bitmap.height * schaal));

    const doek = new OffscreenCanvas(breedte, hoogte);
    const tekenvlak = doek.getContext('2d');
    if (!tekenvlak) throw new Error('Kan geen tekenvlak maken voor de miniatuur.');
    tekenvlak.drawImage(bitmap, 0, 0, breedte, hoogte);

    // JPEG en niet PNG: een foto van 480 pixels is met kwaliteit 0,72 zo'n
    // veertig kilobyte, waar PNG er een half megabyte van maakt.
    const blob = await doek.convertToBlob({ type: 'image/jpeg', quality: 0.72 });
    return { blob, breedte, hoogte };
  } finally {
    // De bitmap houdt geheugen vast tot hij expliciet vrijgegeven wordt, en bij
    // een paar honderd foto's achter elkaar tikt dat hard aan.
    bitmap.close();
  }
};

/** Leesbare bestandsgrootte, voor de melding over hoeveel ruimte foto's innemen. */
export const alsGrootte = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  const mb = bytes / (1024 * 1024);
  return mb < 100 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
};
