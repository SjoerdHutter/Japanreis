/**
 * Tijdzones, op één plek.
 *
 * Je reist door drie zones: thuis is UTC+1 of +2, Japan is UTC+9 en Vietnam is
 * UTC+7. De telefoon zet zichzelf onderweg om, maar niet altijd meteen, en een
 * dag die "vandaag" heet is in Japan al bezig terwijl hij thuis nog moet
 * beginnen. Alles wat met dagen te maken heeft rekent daarom expliciet in de
 * tijdzone van de stad waar het over gaat, en nooit in die van het toestel.
 *
 * Japan en Vietnam kennen geen zomertijd, maar de functies hieronder houden er
 * wel rekening mee: een correctie die je niet nodig hebt kost niets, en een
 * correctie die ontbreekt kost een dag.
 */

/**
 * Hoeveel de wandklok in deze zone voorloopt op UTC, in milliseconden, op het
 * gegeven moment.
 */
const zoneOffsetMs = (tijdzone: string, moment: Date): number => {
  const delen = new Intl.DateTimeFormat('en-US', {
    timeZone: tijdzone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(moment);

  const deel = (soort: Intl.DateTimeFormatPartTypes): number =>
    Number(delen.find((d) => d.type === soort)?.value ?? '0');

  // Sommige omgevingen geven 24 in plaats van 0 voor middernacht.
  const uur = deel('hour') % 24;

  const alsUtc = Date.UTC(
    deel('year'),
    deel('month') - 1,
    deel('day'),
    uur,
    deel('minute'),
    deel('second'),
  );
  // De milliseconden vallen buiten formatToParts, dus die eerst wegsnijden.
  return alsUtc - Math.floor(moment.getTime() / 1000) * 1000;
};

/** De datum in deze tijdzone, als YYYY-MM-DD. */
export const datumIn = (tijdzone: string, moment: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: tijdzone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(moment);

/**
 * Het moment waarop het in deze zone een bepaalde wandklokdatum en tijd is.
 *
 * Twee rondes: de eerste schatting gebruikt de offset die op dat tijdstip in
 * UTC geldt, de tweede corrigeert als die schatting net aan de andere kant van
 * een zomertijdgrens viel.
 */
const momentVanWandklok = (
  tijdzone: string,
  jaar: number,
  maand: number,
  dag: number,
  uur = 0,
): Date => {
  const wandklok = Date.UTC(jaar, maand - 1, dag, uur);
  const eerste = wandklok - zoneOffsetMs(tijdzone, new Date(wandklok));
  const tweede = wandklok - zoneOffsetMs(tijdzone, new Date(eerste));
  return new Date(tweede);
};

/**
 * De eerstvolgende middernacht in deze tijdzone.
 *
 * Hier hangt het verval van de highlight keuze aan: die blijft staan tot
 * middernacht, zodat hij niet halverwege een treinreis terugspringt naar de
 * stad waar je toevallig langsrijdt.
 */
export const volgendeMiddernacht = (tijdzone: string, moment: Date = new Date()): Date => {
  const [jaar, maand, dag] = datumIn(tijdzone, moment).split('-').map(Number);
  return momentVanWandklok(tijdzone, jaar, maand, dag + 1);
};

/** Het uur van de dag in deze zone, als heel getal van 0 tot en met 23. */
export const uurIn = (tijdzone: string, moment: Date = new Date()): number =>
  Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: tijdzone, hour: '2-digit', hour12: false }).format(
      moment,
    ),
  ) % 24;

/** Het dagdeel waarin je zit, voor de filters op ochtend en avond. */
export const dagdeelIn = (
  tijdzone: string,
  moment: Date = new Date(),
): 'ochtend' | 'middag' | 'avond' | 'nacht' => {
  const uur = uurIn(tijdzone, moment);
  if (uur < 5) return 'nacht';
  if (uur < 12) return 'ochtend';
  if (uur < 17) return 'middag';
  if (uur < 23) return 'avond';
  return 'nacht';
};
