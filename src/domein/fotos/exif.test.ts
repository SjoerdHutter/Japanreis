import { describe, expect, it } from 'vitest';
import { leesFoto } from './exif';

/**
 * Een bestand dat geen foto is. Dit is het geval dat op reis het vaakst
 * voorkomt: een schermafbeelding, een gedownload plaatje, of een foto waar de
 * gegevens uit gestript zijn door een berichtenapp.
 */
const nepBestand = (naam: string, gewijzigdOp: number): File =>
  new File([new Uint8Array([1, 2, 3, 4])], naam, { type: 'image/jpeg', lastModified: gewijzigdOp });

describe('leesFoto', () => {
  it('valt niet om op een bestand zonder EXIF', async () => {
    const gegevens = await leesFoto(
      nepBestand('screenshot.jpg', Date.parse('2026-04-10T12:00:00Z')),
    );
    expect(gegevens.coordinaten).toBeUndefined();
  });

  it('valt terug op de datum van het bestand, zodat de foto toch op de tijdlijn past', async () => {
    const gegevens = await leesFoto(nepBestand('foto.jpg', Date.parse('2026-04-10T12:00:00Z')));
    expect(gegevens.wandklok).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    // De bron staat erbij, zodat het scherm kan zeggen dat dit een schatting is.
    expect(gegevens.tijdstipBron).toBe('bestand');
  });

  it('geeft de tijd zonder zone terug, want zo staat hij in de camera', async () => {
    const gegevens = await leesFoto(nepBestand('foto.jpg', Date.parse('2026-04-10T12:00:00Z')));
    // Geen Z en geen offset achteraan: dit is een wandklok, geen moment.
    expect(gegevens.wandklok).not.toMatch(/Z$/);
    expect(gegevens.wandklok).not.toMatch(/[+-]\d{2}:\d{2}$/);
  });

  it('geeft niets terug als er ook geen bestandsdatum is', async () => {
    const zonderDatum = new File([new Uint8Array([1])], 'x.jpg', { lastModified: 0 });
    const gegevens = await leesFoto(zonderDatum);
    expect(gegevens.wandklok).toBeUndefined();
    expect(gegevens.tijdstipBron).toBeUndefined();
  });
});
