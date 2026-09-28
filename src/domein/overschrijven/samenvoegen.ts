/**
 * Eigen waarden over de meegeleverde content heen.
 *
 * Wat de app meebrengt (een laatste trein, het beste moment voor een tempel,
 * of een plek alleen contant neemt) weet jij onderweg soms beter. Je eigen
 * waarde staat apart in IndexedDB en wordt bij het tonen over de content heen
 * gelegd; de content zelf blijft onaangeroerd, zodat "terugzetten" altijd kan
 * en een update van de app jouw waarde niet wegveegt.
 *
 * Een veld is een pad met punten, zoals `attractie.drukte.besteTijdslot`.
 */

export interface Overschrijving {
  /** `${doel}:${doelId}:${veld}` */
  id: string;
  /** Waar het over gaat: 'plaats', 'laatste-trein', 'verblijf-trein'. */
  doel: string;
  doelId: string;
  veld: string;
  waarde: unknown;
  gewijzigdOp: string;
}

export const overschrijvingId = (doel: string, doelId: string, veld: string): string =>
  `${doel}:${doelId}:${veld}`;

const zetPad = (object: unknown, pad: string[], waarde: unknown): unknown => {
  const [eerste, ...rest] = pad;
  const basis =
    object !== null && typeof object === 'object' && !Array.isArray(object)
      ? (object as Record<string, unknown>)
      : {};
  return {
    ...basis,
    [eerste]: rest.length === 0 ? waarde : zetPad(basis[eerste], rest, waarde),
  };
};

/**
 * Legt de eigen waarden voor dit ene ding over de content heen. Geeft ook terug
 * welke velden een eigen waarde hebben, zodat het scherm er "eigen waarde" bij
 * kan zetten.
 */
export const pasToe = <T>(
  item: T,
  overschrijvingen: Overschrijving[],
  doel: string,
  doelId: string,
): { waarde: T; eigen: Set<string> } => {
  let waarde: unknown = item;
  const eigen = new Set<string>();
  for (const o of overschrijvingen) {
    if (o.doel !== doel || o.doelId !== doelId) continue;
    waarde = zetPad(waarde, o.veld.split('.'), o.waarde);
    eigen.add(o.veld);
  }
  return { waarde: waarde as T, eigen };
};

/** Leest een waarde langs een pad met punten. */
export const leesPad = (object: unknown, pad: string): unknown =>
  pad
    .split('.')
    .reduce<unknown>(
      (huidig, deel) =>
        huidig !== null && typeof huidig === 'object'
          ? (huidig as Record<string, unknown>)[deel]
          : undefined,
      object,
    );
