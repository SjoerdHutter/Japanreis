import type { Reisschema, Stad } from '@/domein/schema';
import { alsKorteDatum, alsPeriode, plusDagen } from '@/domein/tijd/datums';
import { nachtenVolgensSchema, reisperiode } from '@/domein/reizen/dagen';
import { verblijfVanNacht, type MijnGegevens } from './orden';

export { nachtenVolgensSchema, reisperiode };

/**
 * Wat er nog ontbreekt aan je gegevens.
 *
 * Alleen wat je onderweg echt mist als het er niet staat: het noodnummer van je
 * verzekeraar, je polisnummer, iemand thuis om te bellen, een adres in lokaal
 * schrift voor elke nacht, en je vluchten. Geen volledigheid om de
 * volledigheid; een lijst van twintig punten leest niemand.
 */

export type Sectie =
  | 'verzekering'
  | 'noodcontacten'
  | 'medisch'
  | 'documenten'
  | 'vluchten'
  | 'accommodaties'
  | 'import';

export interface Ontbrekend {
  /** Vast per soort melding, voor de React-sleutel. */
  id: string;
  tekst: string;
  sectie: Sectie;
  /** De regel die aangevuld moet worden, als die al bestaat. */
  doelId?: string;
  /** Voor een verblijf dat er nog niet is: de stad en de nachten, om het formulier voor te vullen. */
  nieuw?: { stadId: string; van: string; tot: string };
}

export const watOntbreekt = (
  gegevens: MijnGegevens,
  reisschema: Reisschema,
  steden: Stad[],
): Ontbrekend[] => {
  const uit: Ontbrekend[] = [];
  const naam = (stadId: string) => steden.find((s) => s.id === stadId)?.naam ?? stadId;

  if (!gegevens.verzekering?.noodnummer) {
    uit.push({
      id: 'noodnummer',
      tekst: 'Het noodnummer van je verzekeraar',
      sectie: 'verzekering',
    });
  }
  if (!gegevens.verzekering?.polisnummer) {
    uit.push({ id: 'polisnummer', tekst: 'Je polisnummer', sectie: 'verzekering' });
  }
  if (gegevens.noodcontacten.length === 0) {
    uit.push({
      id: 'noodcontact',
      tekst: 'Minstens één noodcontact thuis',
      sectie: 'noodcontacten',
    });
  }

  // Nachten zonder verblijf, samengevoegd per aaneengesloten stuk in één stad.
  const zonder = nachtenVolgensSchema(reisschema).filter(
    (n) => !verblijfVanNacht(n.datum, gegevens.accommodaties),
  );
  const stukken: { stadId: string; van: string; tot: string }[] = [];
  for (const nacht of zonder) {
    const laatste = stukken[stukken.length - 1];
    if (laatste && laatste.stadId === nacht.stadId && plusDagen(laatste.tot, 1) === nacht.datum) {
      laatste.tot = nacht.datum;
    } else {
      stukken.push({ stadId: nacht.stadId, van: nacht.datum, tot: nacht.datum });
    }
  }
  for (const stuk of stukken) {
    uit.push({
      id: `verblijf-${stuk.stadId}-${stuk.van}`,
      tekst: `Waar je slaapt in ${naam(stuk.stadId)}, ${stuk.van === stuk.tot ? 'de nacht van' : 'de nachten van'} ${alsPeriode(stuk.van, stuk.tot)}`,
      sectie: 'accommodaties',
      // De uitcheck is de ochtend na de laatste nacht.
      nieuw: { stadId: stuk.stadId, van: stuk.van, tot: plusDagen(stuk.tot, 1) },
    });
  }

  for (const verblijf of gegevens.accommodaties) {
    if (!verblijf.adresLokaal) {
      uit.push({
        id: `adres-${verblijf.id}`,
        tekst: `Het adres in lokaal schrift van ${verblijf.naam}`,
        sectie: 'accommodaties',
        doelId: verblijf.id,
      });
    }
  }

  const periode = reisperiode(reisschema);
  if (gegevens.vluchten.length === 0) {
    uit.push({ id: 'vluchten', tekst: 'Je vluchten', sectie: 'vluchten' });
  } else if (periode) {
    if (!gegevens.vluchten.some((v) => v.aankomst.datum <= periode.van)) {
      uit.push({
        id: 'vlucht-heen',
        tekst: `Een vlucht die uiterlijk ${alsKorteDatum(periode.van)} aankomt`,
        sectie: 'vluchten',
      });
    }
    if (!gegevens.vluchten.some((v) => v.vertrek.datum >= periode.tot)) {
      uit.push({
        id: 'vlucht-terug',
        tekst: `Een vlucht die op of na ${alsKorteDatum(periode.tot)} vertrekt`,
        sectie: 'vluchten',
      });
    }
  }
  for (const vlucht of gegevens.vluchten) {
    if (!vlucht.vertrek.tijd || !vlucht.aankomst.tijd) {
      uit.push({
        id: `tijden-${vlucht.id}`,
        tekst: `De vertrektijd en aankomsttijd van ${vlucht.vluchtnummer}`,
        sectie: 'vluchten',
        doelId: vlucht.id,
      });
    }
  }

  return uit;
};
