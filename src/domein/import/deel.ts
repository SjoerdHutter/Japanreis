import type { EigenPunt } from '@/domein/schema';

/**
 * Je eigen lijst deelbaar maken, uit hoofdstuk 15.
 *
 * Als CSV in precies het formaat dat de importer van deze app zelf leest, zodat
 * iemand die later gaat het bestand kan openen en meteen jouw punten heeft.
 * Excel of Numbers opent het ook, dus wie er iets aan wil veranderen kan dat.
 *
 * Er gaat alleen in wat over de plek gaat. Geen foto's, geen uitgaven, geen
 * stempels: dat is van jou en heeft een ander niets aan.
 */

const ontsnapVeld = (waarde: string): string =>
  /[",\n]/.test(waarde) ? `"${waarde.replace(/"/g, '""')}"` : waarde;

export const alsCsv = (punten: EigenPunt[]): string => {
  const koppen = ['Title', 'Note', 'URL', 'Latitude', 'Longitude', 'Lijst'];
  const rijen = punten.map((punt) =>
    [
      punt.naam,
      punt.notitie ?? '',
      punt.url ?? '',
      punt.coordinaten ? String(punt.coordinaten.lat) : '',
      punt.coordinaten ? String(punt.coordinaten.lon) : '',
      punt.lijst ?? '',
    ]
      .map(ontsnapVeld)
      .join(','),
  );
  // Een byte order mark, anders maakt Excel van Sensō-ji iets onleesbaars.
  return `\uFEFF${[koppen.join(','), ...rijen].join('\n')}\n`;
};
