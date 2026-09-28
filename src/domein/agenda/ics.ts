/**
 * Een agendabestand volgens RFC 5545, gemaakt op het toestel.
 *
 * Alle tijden staan in UTC, met een Z erachter. Dat is de eenvoudigste vorm die
 * elke agenda goed leest: geen tijdzoneblokken die een agenda half begrijpt,
 * en de iPhone zet ze zelf om naar de tijd van waar je bent. Een vlucht van
 * Hanoi om 00:15 is dan 17:15 UTC de avond ervoor en staat in je agenda op het
 * goede moment, of je telefoon nu op Amsterdam, Hanoi of Tokio staat.
 *
 * Elke afspraak heeft een vaste UID. Een agenda die dat respecteert werkt een
 * afspraak bij als je opnieuw exporteert, in plaats van hem te verdubbelen;
 * SEQUENCE loopt daarvoor mee met het moment van exporteren.
 */

export type AgendaTijd = { soort: 'moment'; utc: number } | { soort: 'dag'; datum: string };

export interface AgendaItem {
  uid: string;
  titel: string;
  begin: AgendaTijd;
  eind?: AgendaTijd;
  locatie?: string;
  beschrijving?: string;
  /** Hoe lang voor het begin, als duur uit RFC 5545: PT15M, PT3H, P1D. */
  alarmen: string[];
  /** Alleen voor het voorbeeld op het scherm: in welke zone de tijd hoort. */
  zone?: string;
}

const twee = (n: number) => String(n).padStart(2, '0');

export const alsUtcStempel = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${twee(d.getUTCMonth() + 1)}${twee(d.getUTCDate())}T${twee(d.getUTCHours())}${twee(d.getUTCMinutes())}${twee(d.getUTCSeconds())}Z`;
};

const alsDatum = (datum: string): string => datum.replaceAll('-', '');

const volgendeDag = (datum: string): string =>
  new Date(Date.parse(`${datum}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/** Tekst veilig maken voor een eigenschap: backslash, puntkomma, komma en regeleinde. */
export const ontsnap = (tekst: string): string =>
  tekst.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/**
 * Regels langer dan 75 bytes afbreken, met een spatie aan het begin van het
 * vervolg. In bytes en niet in tekens: een Japans teken is er drie, en een
 * teken halverwege doorknippen levert onzin op.
 */
export const vouw = (regel: string): string => {
  const encoder = new TextEncoder();
  const delen: string[] = [];
  let huidig = '';
  let bytes = 0;
  let max = 75;
  for (const teken of regel) {
    const lengte = encoder.encode(teken).length;
    if (bytes + lengte > max) {
      delen.push(huidig);
      huidig = '';
      bytes = 0;
      max = 74; // de spatie vooraan telt mee
    }
    huidig += teken;
    bytes += lengte;
  }
  delen.push(huidig);
  return delen.join('\r\n ');
};

const tijdRegel = (naam: 'DTSTART' | 'DTEND', tijd: AgendaTijd): string =>
  tijd.soort === 'moment'
    ? `${naam}:${alsUtcStempel(tijd.utc)}`
    : `${naam};VALUE=DATE:${alsDatum(tijd.datum)}`;

const standaardEind = (begin: AgendaTijd): AgendaTijd =>
  begin.soort === 'moment'
    ? { soort: 'moment', utc: begin.utc + 30 * 60_000 }
    : { soort: 'dag', datum: volgendeDag(begin.datum) };

export const maakIcs = (items: AgendaItem[], nu: Date, agendanaam = 'Japanreis'): string => {
  const stempel = alsUtcStempel(nu.getTime());
  const volgnummer = Math.floor(nu.getTime() / 1000);
  const regels = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Japanreis//Reisapp//NL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${ontsnap(agendanaam)}`,
  ];
  for (const item of items) {
    regels.push(
      'BEGIN:VEVENT',
      `UID:${item.uid}`,
      `DTSTAMP:${stempel}`,
      `LAST-MODIFIED:${stempel}`,
      `SEQUENCE:${volgnummer}`,
      tijdRegel('DTSTART', item.begin),
      tijdRegel('DTEND', item.eind ?? standaardEind(item.begin)),
      `SUMMARY:${ontsnap(item.titel)}`,
    );
    if (item.locatie) regels.push(`LOCATION:${ontsnap(item.locatie)}`);
    if (item.beschrijving) regels.push(`DESCRIPTION:${ontsnap(item.beschrijving)}`);
    for (const alarm of item.alarmen) {
      regels.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${ontsnap(item.titel)}`,
        `TRIGGER:-${alarm}`,
        'END:VALARM',
      );
    }
    regels.push('END:VEVENT');
  }
  regels.push('END:VCALENDAR');
  return `${regels.map(vouw).join('\r\n')}\r\n`;
};
