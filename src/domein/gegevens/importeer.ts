import type { z } from 'zod';
import {
  MAX_NOODCONTACTEN,
  accommodatieSchema,
  medischSchema,
  noodcontactSchema,
  reserveringRecordSchema,
  schoon,
  verzekeringSchema,
  vluchtSchema,
  type Gegeven,
  type OpgeslagenReservering,
} from '@/domein/schema';
import { alsKorteDatum, alsPeriode } from '@/domein/tijd/datums';
import type { MijnGegevens } from './orden';

/**
 * Een ingevuld sjabloon inlezen, zonder iets op te slaan.
 *
 * Eerst komt er een voorstel: wat er nieuw is, wat verandert en wat al zo in
 * de app stond. Pas als je dat hebt gezien wordt er iets bewaard. Zit er ook
 * maar één fout in het bestand, dan gaat er niets in; half importeren levert
 * een toestand op waarvan je niet meer weet wat er wel en niet binnen is.
 *
 * Samenvoegen gaat per veld. Wat in het bestand leeg is laat de app staan, zodat
 * een sjabloon met alleen je vluchten je verzekering niet leegmaakt.
 */

export type ImportSectie =
  'verzekering' | 'noodcontacten' | 'medisch' | 'vluchten' | 'accommodaties' | 'reserveringen';

export const SECTIE_NAAM: Record<ImportSectie, string> = {
  verzekering: 'Verzekering',
  noodcontacten: 'Noodcontacten',
  medisch: 'Medische info',
  vluchten: 'Vluchten',
  accommodaties: 'Accommodaties',
  reserveringen: 'Reserveringen',
};

export interface ImportRegel {
  sectie: ImportSectie;
  actie: 'nieuw' | 'gewijzigd' | 'ongewijzigd';
  omschrijving: string;
  /** Er staat nog iets met VOORBEELD in: waarschijnlijk vergeten in te vullen. */
  voorbeeld: boolean;
  record:
    { soort: 'gegeven'; waarde: Gegeven } | { soort: 'reservering'; waarde: OpgeslagenReservering };
}

export interface ImportVoorstel {
  regels: ImportRegel[];
  fouten: string[];
}

interface Opties {
  nieuweId: () => string;
  /** Het moment van importeren, als ISO-tekst. */
  nu: string;
  stadIds: string[];
}

const BEKEND = new Set([
  'uitleg',
  'versie',
  'verzekering',
  'noodcontacten',
  'medisch',
  'vluchten',
  'accommodaties',
  'reserveringen',
]);

const isObject = (waarde: unknown): waarde is Record<string, unknown> =>
  waarde !== null && typeof waarde === 'object' && !Array.isArray(waarde);

/** JSON met gesorteerde sleutels, zodat twee gelijke regels ook gelijk vergelijken. */
const vast = (waarde: unknown): string =>
  JSON.stringify(waarde, (_, v: unknown) =>
    isObject(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v,
  );

const zonderTijdstempel = (regel: Record<string, unknown>) => {
  const kopie = { ...regel };
  delete kopie.gewijzigdOp;
  return kopie;
};

const gelijk = (a: Record<string, unknown> | undefined, b: Record<string, unknown>): boolean =>
  a !== undefined && vast(zonderTijdstempel(a)) === vast(zonderTijdstempel(b));

const bevatVoorbeeld = (waarde: unknown): boolean =>
  JSON.stringify(waarde).toLowerCase().includes('voorbeeld');

const foutregels = (plek: string, fout: z.ZodError): string[] =>
  fout.issues.map((probleem) => {
    const pad = probleem.path.map(String).join('.');
    return `${plek}${pad ? `, ${pad}` : ''}: ${probleem.message}`;
  });

const sleutelTekst = (waarde: unknown): string =>
  typeof waarde === 'string' ? waarde.trim().toLowerCase().replace(/\s+/g, '') : '';

export const leesImport = (
  json: unknown,
  bestaand: { gegevens: MijnGegevens; reserveringen: OpgeslagenReservering[] },
  opties: Opties,
): ImportVoorstel => {
  const regels: ImportRegel[] = [];
  const fouten: string[] = [];

  if (!isObject(json)) {
    return { regels, fouten: ['Dit is geen sjabloon van de app: er staat geen JSON-object in.'] };
  }
  for (const sleutel of Object.keys(json)) {
    if (!BEKEND.has(sleutel)) fouten.push(`Onbekend onderdeel "${sleutel}"; tikfout?`);
  }

  const stadBestaat = (stadId: unknown, plek: string) => {
    if (typeof stadId === 'string' && !opties.stadIds.includes(stadId)) {
      fouten.push(`${plek}: de stad "${stadId}" kent de app niet.`);
    }
  };

  /** Eén regel samenvoegen met wat er al was, valideren en als voorstel opnemen. */
  const neemOp = <T extends Record<string, unknown>>(
    sectie: ImportSectie,
    plek: string,
    ruw: Record<string, unknown>,
    oud: T | undefined,
    vaste: Record<string, unknown>,
    schema: z.ZodType<T>,
    omschrijf: (waarde: T) => string,
    alsRecord: (waarde: T) => ImportRegel['record'],
  ) => {
    const samen = { ...(oud ?? {}), ...ruw, ...vaste, gewijzigdOp: opties.nu };
    const uitkomst = schema.safeParse(samen);
    if (!uitkomst.success) {
      fouten.push(...foutregels(plek, uitkomst.error));
      return;
    }
    const waarde = uitkomst.data;
    regels.push({
      sectie,
      actie: !oud ? 'nieuw' : gelijk(oud, waarde) ? 'ongewijzigd' : 'gewijzigd',
      omschrijving: omschrijf(waarde),
      voorbeeld: bevatVoorbeeld(ruw),
      record: alsRecord(waarde),
    });
  };

  const alsGegeven = (waarde: Gegeven): ImportRegel['record'] => ({ soort: 'gegeven', waarde });

  const lijst = (sectie: ImportSectie): Record<string, unknown>[] | null => {
    const waarde = json[sectie];
    if (waarde === undefined) return [];
    if (!Array.isArray(waarde)) {
      fouten.push(`${SECTIE_NAAM[sectie]}: verwacht een lijst tussen [ en ].`);
      return null;
    }
    return waarde.map((item) =>
      isObject(schoon(item)) ? (schoon(item) as Record<string, unknown>) : {},
    );
  };

  const los = (sectie: 'verzekering' | 'medisch'): Record<string, unknown> | null => {
    const waarde = json[sectie];
    if (waarde === undefined) return null;
    if (!isObject(waarde)) {
      fouten.push(`${SECTIE_NAAM[sectie]}: verwacht een object tussen { en }.`);
      return null;
    }
    const geschoond = schoon(waarde) as Record<string, unknown>;
    return Object.keys(geschoond).length > 0 ? geschoond : null;
  };

  const { gegevens } = bestaand;

  const verzekering = los('verzekering');
  if (verzekering) {
    neemOp(
      'verzekering',
      SECTIE_NAAM.verzekering,
      verzekering,
      gegevens.verzekering,
      { soort: 'verzekering', id: 'verzekering' },
      verzekeringSchema,
      (v) => v.maatschappij ?? 'Verzekering',
      alsGegeven,
    );
  }

  const contacten = lijst('noodcontacten');
  if (contacten) {
    const gebruikt = new Set<string>();
    contacten.forEach((ruw, i) => {
      if (Object.keys(ruw).length === 0) return;
      const oud = gegevens.noodcontacten.find(
        (c) =>
          c.id === ruw.id ||
          (sleutelTekst(ruw.naam) !== '' && sleutelTekst(c.naam) === sleutelTekst(ruw.naam)),
      );
      const id = oud?.id ?? (typeof ruw.id === 'string' ? ruw.id : opties.nieuweId());
      gebruikt.add(id);
      neemOp(
        'noodcontacten',
        `Noodcontact ${i + 1}`,
        ruw,
        oud,
        { soort: 'noodcontact', id },
        noodcontactSchema,
        (c) => c.naam,
        alsGegeven,
      );
    });
    const totaal = new Set([...gegevens.noodcontacten.map((c) => c.id), ...gebruikt]).size;
    if (totaal > MAX_NOODCONTACTEN) {
      fouten.push(
        `Noodcontacten: er passen er hoogstens ${MAX_NOODCONTACTEN} in de app, en dit zouden er ${totaal} worden.`,
      );
    }
  }

  const medisch = los('medisch');
  if (medisch) {
    neemOp(
      'medisch',
      SECTIE_NAAM.medisch,
      medisch,
      gegevens.medisch,
      { soort: 'medisch', id: 'medisch' },
      medischSchema,
      () => 'Medische gegevens',
      alsGegeven,
    );
  }

  const vluchten = lijst('vluchten');
  vluchten?.forEach((ruw, i) => {
    if (Object.keys(ruw).length === 0) return;
    const vertrekDatum = isObject(ruw.vertrek) ? ruw.vertrek.datum : undefined;
    const oud = gegevens.vluchten.find(
      (v) =>
        v.id === ruw.id ||
        (sleutelTekst(v.vluchtnummer) === sleutelTekst(ruw.vluchtnummer) &&
          v.vertrek.datum === vertrekDatum),
    );
    const id = oud?.id ?? (typeof ruw.id === 'string' ? ruw.id : opties.nieuweId());
    neemOp(
      'vluchten',
      `Vlucht ${i + 1}`,
      ruw,
      oud,
      { soort: 'vlucht', id },
      vluchtSchema,
      (v) => `${v.vluchtnummer}, ${v.van} naar ${v.naar}, ${alsKorteDatum(v.vertrek.datum)}`,
      alsGegeven,
    );
  });

  const verblijven = lijst('accommodaties');
  verblijven?.forEach((ruw, i) => {
    if (Object.keys(ruw).length === 0) return;
    stadBestaat(ruw.stadId, `Accommodatie ${i + 1}`);
    const incheck = isObject(ruw.incheck) ? ruw.incheck.datum : undefined;
    const oud = gegevens.accommodaties.find(
      (a) =>
        a.id === ruw.id ||
        (sleutelTekst(a.naam) === sleutelTekst(ruw.naam) && a.incheck.datum === incheck),
    );
    const id = oud?.id ?? (typeof ruw.id === 'string' ? ruw.id : opties.nieuweId());
    neemOp(
      'accommodaties',
      `Accommodatie ${i + 1}`,
      ruw,
      oud,
      { soort: 'accommodatie', id },
      accommodatieSchema,
      (a) => `${a.naam}, ${alsPeriode(a.incheck.datum, a.uitcheck.datum)}`,
      alsGegeven,
    );
  });

  const reserveringen = lijst('reserveringen');
  reserveringen?.forEach((ruw, i) => {
    if (Object.keys(ruw).length === 0) return;
    stadBestaat(ruw.stadId, `Reservering ${i + 1}`);
    const oud = bestaand.reserveringen.find(
      (r) =>
        r.id === ruw.id ||
        (sleutelTekst(r.wat) === sleutelTekst(ruw.wat) && (r.datum ?? '') === (ruw.datum ?? '')),
    );
    const id = oud?.id ?? (typeof ruw.id === 'string' ? ruw.id : opties.nieuweId());
    neemOp(
      'reserveringen',
      `Reservering ${i + 1}`,
      oud ? ruw : { status: 'te-regelen', ...ruw },
      oud,
      { id },
      reserveringRecordSchema,
      (r) => (r.datum ? `${r.wat}, ${alsKorteDatum(r.datum)}` : r.wat),
      (waarde) => ({ soort: 'reservering', waarde }),
    );
  });

  return { regels, fouten };
};
