import { ALLERGENEN, BLOEDGROEPEN, VEEL_GEBRUIKTE_ZONES } from '@/domein/schema';
import type { Gegeven, OpgeslagenReservering } from '@/domein/schema';
import type { MijnGegevens } from './orden';

/**
 * Het sjabloon om je gegevens op een laptop in te vullen.
 *
 * Op een telefoon twintig velden invullen is geen pretje; op een laptop met je
 * boekingsmails ernaast wel. Dit sjabloon heeft elk veld met een voorbeeld, en
 * een uitleg bovenaan omdat JSON geen commentaar kent. De importer leest de
 * uitleg niet, en waarschuwt als er nog iets met "VOORBEELD" in staat.
 *
 * Met je huidige gegevens in plaats van voorbeelden kun je ook wat je al hebt
 * op de laptop bijwerken en terugzetten; de ids zorgen dan dat regels worden
 * bijgewerkt in plaats van verdubbeld.
 */

export const SJABLOON_VERSIE = 1;

const zonderBeheer = <T extends Record<string, unknown>>(regel: T): Record<string, unknown> => {
  const kopie: Record<string, unknown> = { ...regel };
  delete kopie.soort;
  delete kopie.gewijzigdOp;
  return kopie;
};

const uitleg = (stadIds: string[]): string[] => [
  'Vul dit bestand in op je laptop en zet het op je telefoon via Mijn gegevens, Importeren.',
  'Vervang alles waar VOORBEELD in staat. Een veld leeg laten ("") mag altijd; het overschrijft niets wat al in de app staat.',
  'Datums als 2026-10-08, tijden als 15:00.',
  'Telefoonnummers internationaal met een plus en het landnummer, zoals +31 20 123 4567.',
  `Tijdzones bij een vlucht: ${VEEL_GEBRUIKTE_ZONES.map((z) => z.zone).join(', ')}.`,
  `stadId is een van: ${stadIds.join(', ')}.`,
  `allergenen is een lijst met woorden uit: ${ALLERGENEN.join(', ')}.`,
  `bloedgroep is een van: ${BLOEDGROEPEN.join(', ')}.`,
  'status bij een reservering is te-regelen of geboekt.',
  'coordinaten bij een verblijf mag je weglaten; zo niet, schrijf ze als { "lat": 35.0, "lon": 135.7 }.',
  'Bijlagen zoals pdf en foto zet je in de app zelf; die passen niet in dit bestand.',
  'Hoogstens drie noodcontacten.',
];

export const maakSjabloon = (
  stadIds: string[],
  huidig?: { gegevens: MijnGegevens; reserveringen: OpgeslagenReservering[] },
): Record<string, unknown> => {
  if (huidig) {
    const { gegevens, reserveringen } = huidig;
    const alsRegel = (g: Gegeven) => zonderBeheer(g);
    return {
      uitleg: uitleg(stadIds),
      versie: SJABLOON_VERSIE,
      verzekering: gegevens.verzekering ? alsRegel(gegevens.verzekering) : {},
      noodcontacten: gegevens.noodcontacten.map(alsRegel),
      medisch: gegevens.medisch ? alsRegel(gegevens.medisch) : {},
      vluchten: gegevens.vluchten.map(alsRegel),
      accommodaties: gegevens.accommodaties.map(alsRegel),
      reserveringen: reserveringen.map((r) => zonderBeheer(r)),
    };
  }

  return {
    uitleg: uitleg(stadIds),
    versie: SJABLOON_VERSIE,
    verzekering: {
      maatschappij: 'VOORBEELD Reisverzekering',
      noodnummer: '+31 70 000 0000',
      polisnummer: 'VOORBEELD 123456',
      dekking: 'VOORBEELD: medische kosten wereldwijd, bagage tot een bepaald bedrag.',
    },
    noodcontacten: [{ naam: 'VOORBEELD Naam', relatie: 'partner', telefoon: '+31 6 0000 0000' }],
    medisch: {
      allergenen: [],
      allergieOverig: '',
      medicatie: '',
      bloedgroep: '',
      notities: '',
    },
    vluchten: [
      {
        vluchtnummer: 'VB123',
        maatschappij: 'VOORBEELD Airlines',
        van: 'AMS',
        naar: 'HAN',
        vertrek: { datum: '2026-10-03', tijd: '12:00', tijdzone: 'Europe/Amsterdam' },
        aankomst: { datum: '2026-10-04', tijd: '06:00', tijdzone: 'Asia/Ho_Chi_Minh' },
        boekingsnummer: 'VOORBEELD',
      },
    ],
    accommodaties: [
      {
        naam: 'VOORBEELD Hotel',
        naamLokaal: '',
        adresLokaal: 'VOORBEELD 京都府京都市',
        adresLatijn: 'VOORBEELD Kyoto',
        stadId: stadIds.includes('kyoto') ? 'kyoto' : (stadIds[0] ?? ''),
        incheck: { datum: '2026-10-08', tijd: '15:00' },
        uitcheck: { datum: '2026-10-13', tijd: '10:00' },
        telefoon: '+81 75 000 0000',
        station: 'VOORBEELD Kyoto Station',
        uitgang: 'VOORBEELD Hachijo uitgang',
        terugstation: 'Kyoto Station',
        boekingsnummer: 'VOORBEELD',
      },
    ],
    reserveringen: [
      {
        wat: 'VOORBEELD Ghibli Museum',
        datum: '2026-10-20',
        tijd: '10:00',
        verkoopVanaf: '2026-09-10',
        verkoopTijd: '10:00',
        stadId: stadIds.includes('tokio') ? 'tokio' : (stadIds[0] ?? ''),
        status: 'te-regelen',
        boekingsnummer: '',
        notitie: '',
      },
    ],
  };
};
