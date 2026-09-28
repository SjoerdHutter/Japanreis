import { describe, expect, it } from 'vitest';
import type { OpgeslagenReservering, Stad } from '@/domein/schema';
import { orden } from '@/domein/gegevens/orden';
import { agendaItems } from './items';
import { maakIcs, ontsnap, vouw } from './ics';

const NU = new Date('2026-09-28T10:00:00Z');
const STEDEN = [
  { id: 'kyoto', naam: 'Kyoto', tijdzone: 'Asia/Tokyo' },
  { id: 'tokio', naam: 'Tokio', tijdzone: 'Asia/Tokyo' },
  { id: 'hanoi', naam: 'Hanoi', tijdzone: 'Asia/Ho_Chi_Minh' },
] as Stad[];

const GEGEVENS = orden([
  {
    soort: 'vlucht',
    id: 'v1',
    vluchtnummer: 'VN330',
    van: 'HAN',
    naar: 'KIX',
    vertrek: { datum: '2026-10-05', tijd: '00:15', tijdzone: 'Asia/Ho_Chi_Minh' },
    aankomst: { datum: '2026-10-05', tijd: '06:40', tijdzone: 'Asia/Tokyo' },
    boekingsnummer: 'ABC123',
    gewijzigdOp: NU.toISOString(),
  },
  {
    soort: 'accommodatie',
    id: 'a1',
    naam: 'Ryokan, met komma; en puntkomma',
    stadId: 'kyoto',
    adresLatijn: 'Higashiyama, Kyoto',
    incheck: { datum: '2026-10-08', tijd: '15:00' },
    uitcheck: { datum: '2026-10-13', tijd: '10:00' },
    boekingsnummer: 'BK9',
    gewijzigdOp: NU.toISOString(),
  },
]);

const RESERVERINGEN: OpgeslagenReservering[] = [
  {
    id: 'r1',
    wat: 'Ghibli Museum',
    stadId: 'tokio',
    status: 'te-regelen',
    verkoopVanaf: '2026-09-10',
    verkoopTijd: '10:00',
  },
  { id: 'r2', wat: 'teamLab', stadId: 'tokio', status: 'geboekt', datum: '2026-10-20' },
];

/** Leest de regels terug, met de gevouwen regels weer aan elkaar. */
const regelsVan = (ics: string) => ics.replace(/\r\n /g, '').split('\r\n');

const alles = (persoonlijk: boolean) =>
  maakIcs(
    agendaItems({
      gegevens: GEGEVENS,
      reserveringen: RESERVERINGEN,
      steden: STEDEN,
      persoonlijk,
      omvang: { soort: 'alles' },
    }),
    NU,
  );

describe('agenda export', () => {
  it('schrijft een geldig kalenderbestand met CRLF', () => {
    const ics = alles(false);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.split('\r\n').every((r) => new TextEncoder().encode(r).length <= 75)).toBe(true);
  });

  it('zet de vlucht in UTC: 00:15 in Hanoi is 17:15 UTC de avond ervoor', () => {
    const regels = regelsVan(alles(false));
    const start = regels.indexOf('UID:vlucht-v1@japanreis.app');
    const blok = regels.slice(start, start + 12);
    expect(blok).toContain('DTSTART:20261004T171500Z');
    // 06:40 in Japan is 21:40 UTC, ook de avond ervoor.
    expect(blok).toContain('DTEND:20261004T214000Z');
    expect(blok).toContain('TRIGGER:-PT3H');
  });

  it('checkt in en uit op Japanse tijd, met een wekker bij het uitchecken', () => {
    const regels = regelsVan(alles(false));
    expect(regels).toContain('DTSTART:20261008T060000Z');
    const uit = regels.indexOf('UID:uitcheck-a1@japanreis.app');
    expect(regels.slice(uit, uit + 14)).toContain('DTSTART:20261013T010000Z');
    expect(regels.slice(uit, uit + 14)).toContain('TRIGGER:-PT1H');
  });

  it('waarschuwt een dag en een kwartier voor de kaartverkoop', () => {
    const regels = regelsVan(alles(false));
    const i = regels.indexOf('UID:verkoop-r1@japanreis.app');
    const blok = regels.slice(i, i + 20);
    expect(blok).toContain('DTSTART:20260910T010000Z');
    expect(blok).toContain('TRIGGER:-P1D');
    expect(blok).toContain('TRIGGER:-PT15M');
  });

  it('maakt van een reservering zonder tijd een afspraak voor de hele dag', () => {
    expect(regelsVan(alles(false))).toContain('DTSTART;VALUE=DATE:20261020');
  });

  it('laat adres en boekingsnummer weg tenzij je ervoor kiest', () => {
    const zonder = alles(false);
    expect(zonder).not.toContain('ABC123');
    expect(zonder).not.toContain('Higashiyama');
    const met = regelsVan(alles(true)).join('\n');
    expect(met).toContain('Boekingsnummer: ABC123');
    expect(met).toContain('LOCATION:Higashiyama\\, Kyoto');
  });

  it('houdt de UID gelijk bij een nieuwe export, zodat een afspraak wordt bijgewerkt', () => {
    const uids = (ics: string) => regelsVan(ics).filter((r) => r.startsWith('UID:'));
    expect(uids(alles(false))).toEqual(uids(alles(true)));
  });

  it('kan alleen de kaartverkoop of alleen één dag', () => {
    const verkoop = agendaItems({
      gegevens: GEGEVENS,
      reserveringen: RESERVERINGEN,
      steden: STEDEN,
      persoonlijk: false,
      omvang: { soort: 'kaartverkoop' },
    });
    expect(verkoop.map((i) => i.uid)).toEqual(['verkoop-r1@japanreis.app']);
    const dag = agendaItems({
      gegevens: GEGEVENS,
      reserveringen: RESERVERINGEN,
      steden: STEDEN,
      persoonlijk: false,
      omvang: { soort: 'dag', datum: '2026-10-08' },
    });
    expect(dag.map((i) => i.uid)).toEqual(['incheck-a1@japanreis.app']);
  });

  it('ontsnapt tekens en vouwt lange regels zonder een teken te breken', () => {
    expect(ontsnap('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
    const lang = `SUMMARY:${'京都'.repeat(40)}`;
    const gevouwen = vouw(lang);
    expect(gevouwen.replace(/\r\n /g, '')).toBe(lang);
    for (const r of gevouwen.split('\r\n'))
      expect(new TextEncoder().encode(r).length).toBeLessThanOrEqual(75);
  });
});
