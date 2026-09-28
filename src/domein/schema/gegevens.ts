import { z } from 'zod';
import { coordinaatSchema } from './basis';
import { allergeenSchema } from './allergeen';
import { momentInZone } from '../tijd/zones';

/**
 * Mijn gegevens: wat alleen jij weet en wat je onderweg niet kwijt wilt zijn.
 *
 * Je verzekering, wie ze thuis moeten bellen, je allergieën, je vluchten en
 * waar je slaapt. Niets hiervan staat in de repository en niets hiervan komt er
 * ooit in: het wordt op het toestel ingevuld en blijft daar, in IndexedDB. Het
 * verlaat de telefoon alleen via een export die je zelf start.
 *
 * Alles is optioneel. Een half ingevulde verzekering is geen fout maar een
 * normale toestand; het hoofdmenu zegt dan wat er nog ontbreekt.
 *
 * Lege tekstvelden worden voor het valideren weggehaald, zie `schoon`. Een
 * formulier levert namelijk overal een lege tekst op, en "leeg" hoort hier
 * hetzelfde te betekenen als "niet ingevuld".
 */

/** Haalt uit een telefoonnummer alles weg wat geen cijfer of plus is. */
export const telefoonCijfers = (nummer: string): string => nummer.replace(/[^\d+]/g, '');

/**
 * Internationaal: een plus, een landnummer en daarna genoeg cijfers. Spaties,
 * punten, haakjes en streepjes mogen, want zo schrijft iedereen een nummer op.
 * Zonder landnummer werkt een nummer in Japan niet, en dat merk je pas op het
 * moment dat je belt.
 */
export const isInternationaalNummer = (nummer: string): boolean =>
  /^[\d\s+().\-/]+$/.test(nummer) && /^\+[1-9]\d{6,14}$/.test(telefoonCijfers(nummer));

export const telefoonSchema = z.string().trim().refine(isInternationaalNummer, {
  error:
    'Schrijf het nummer internationaal, met een plus en het landnummer, zoals +31 20 123 4567.',
});

/** Een tel:-link die op elke telefoon werkt. */
export const telLink = (nummer: string): string => `tel:${telefoonCijfers(nummer)}`;

export const tijdSchema = z
  .string({ error: 'Schrijf de tijd als 09:30.' })
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'Schrijf de tijd als 09:30.' });

export const datumSchema = z.iso.date({ error: 'Kies een datum.' });

const geldigeTijdzone = (zone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

export const tijdzoneSchema = z
  .string({ error: 'Kies een tijdzone.' })
  .min(1, { error: 'Kies een tijdzone.' })
  .refine(geldigeTijdzone, { error: 'Deze tijdzone kent je toestel niet.' });

/**
 * De tijdzones die je bij een vlucht het vaakst nodig hebt. Een vertrektijd
 * zonder zone is in deze reis waardeloos: Amsterdam, Hanoi en Tokio schelen
 * onderling twee tot acht uur.
 */
export const VEEL_GEBRUIKTE_ZONES: { zone: string; naam: string }[] = [
  { zone: 'Europe/Amsterdam', naam: 'Amsterdam' },
  { zone: 'Asia/Ho_Chi_Minh', naam: 'Vietnam' },
  { zone: 'Asia/Tokyo', naam: 'Japan' },
];

const tekst = (max = 500) => z.string().trim().max(max);
const idSchema = z.string().min(1);
const gewijzigdOpSchema = z.string().min(1);

export const verzekeringSchema = z.object({
  soort: z.literal('verzekering'),
  id: z.literal('verzekering'),
  maatschappij: tekst(200).optional(),
  noodnummer: telefoonSchema.optional(),
  polisnummer: tekst(100).optional(),
  dekking: tekst(4000).optional(),
  gewijzigdOp: gewijzigdOpSchema,
});
export type Verzekering = z.infer<typeof verzekeringSchema>;

export const MAX_NOODCONTACTEN = 3;

export const noodcontactSchema = z.object({
  soort: z.literal('noodcontact'),
  id: idSchema,
  naam: tekst(200).min(1, { error: 'Vul een naam in.' }),
  relatie: tekst(100).optional(),
  telefoon: telefoonSchema.optional(),
  gewijzigdOp: gewijzigdOpSchema,
});
export type Noodcontact = z.infer<typeof noodcontactSchema>;

export const BLOEDGROEPEN = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] as const;

export const medischSchema = z.object({
  soort: z.literal('medisch'),
  id: z.literal('medisch'),
  allergenen: z.array(allergeenSchema).default([]),
  /** Wat niet in de vaste lijst staat, in je eigen woorden. */
  allergieOverig: tekst(1000).optional(),
  medicatie: tekst(2000).optional(),
  bloedgroep: z.enum(BLOEDGROEPEN).optional(),
  notities: tekst(4000).optional(),
  gewijzigdOp: gewijzigdOpSchema,
});
export type Medisch = z.infer<typeof medischSchema>;

/** Een moment met de zone erbij, want een tijd zonder zone zegt hier niets. */
export const vluchtMomentSchema = z.object(
  {
    datum: datumSchema,
    tijd: tijdSchema.optional(),
    tijdzone: tijdzoneSchema,
  },
  { error: 'Vul een datum en een tijdzone in.' },
);
export type VluchtMoment = z.infer<typeof vluchtMomentSchema>;

/** Het echte moment van een vluchttijd, in ms. Null zonder tijd. */
export const utcVan = (moment: VluchtMoment): number | null => {
  if (!moment.tijd) return null;
  try {
    return momentInZone(moment.tijdzone, `${moment.datum}T${moment.tijd}`)?.getTime() ?? null;
  } catch {
    // Een tijdzone die het toestel niet kent; die fout meldt het veld zelf al.
    return null;
  }
};

export const vluchtSchema = z
  .object({
    soort: z.literal('vlucht'),
    id: idSchema,
    vluchtnummer: tekst(12).min(1, { error: 'Vul het vluchtnummer in.' }),
    maatschappij: tekst(100).optional(),
    /** Luchthaven van vertrek, als code of naam: AMS, Noi Bai. */
    van: tekst(100).min(1, { error: 'Vul in waar je vertrekt.' }),
    naar: tekst(100).min(1, { error: 'Vul in waar je landt.' }),
    vertrek: vluchtMomentSchema,
    aankomst: vluchtMomentSchema,
    boekingsnummer: tekst(40).optional(),
    gewijzigdOp: gewijzigdOpSchema,
  })
  .refine(
    (v) => {
      const van = utcVan(v.vertrek);
      const tot = utcVan(v.aankomst);
      if (van === null || tot === null) return v.aankomst.datum >= v.vertrek.datum;
      return tot > van;
    },
    { error: 'De aankomst ligt voor het vertrek. Kloppen de tijdzones?', path: ['aankomst'] },
  );
export type Vlucht = z.infer<typeof vluchtSchema>;

export const dagMetTijdSchema = z.object(
  {
    datum: datumSchema,
    tijd: tijdSchema.optional(),
  },
  { error: 'Kies een datum.' },
);
export type DagMetTijd = z.infer<typeof dagMetTijdSchema>;

export const accommodatieSchema = z
  .object({
    soort: z.literal('accommodatie'),
    id: idSchema,
    naam: tekst(200).min(1, { error: 'Vul de naam in.' }),
    /** De naam zoals hij op het bord staat, om aan te wijzen. */
    naamLokaal: tekst(200).optional(),
    /** Het adres in het Japans of Vietnamees, voor de taxi. */
    adresLokaal: tekst(500).optional(),
    adresLatijn: tekst(500).optional(),
    /** De stad uit de app waar dit verblijf bij hoort. */
    stadId: z.string().min(1, { error: 'Kies een stad.' }),
    incheck: dagMetTijdSchema,
    uitcheck: dagMetTijdSchema,
    telefoon: telefoonSchema.optional(),
    station: tekst(200).optional(),
    uitgang: tekst(200).optional(),
    /** Het station waar je 's avonds naartoe moet; voedt de laatste trein. */
    terugstation: tekst(200).optional(),
    boekingsnummer: tekst(40).optional(),
    coordinaten: coordinaatSchema.optional(),
    gewijzigdOp: gewijzigdOpSchema,
  })
  .refine((a) => a.uitcheck.datum > a.incheck.datum, {
    error: 'De uitcheck ligt niet na de incheck.',
    path: ['uitcheck', 'datum'],
  });
export type Accommodatie = z.infer<typeof accommodatieSchema>;

export const gegevenSchema = z.discriminatedUnion('soort', [
  verzekeringSchema,
  noodcontactSchema,
  medischSchema,
  vluchtSchema,
  accommodatieSchema,
]);
export type Gegeven = z.infer<typeof gegevenSchema>;
export type GegevenSoort = Gegeven['soort'];

/**
 * Aan wie een bijlage vastzit. Een vaste sectie, of een vlucht, verblijf of
 * reservering met zijn id. Als tekst en niet als object, omdat IndexedDB er dan
 * een gewone index op kan leggen.
 */
export const bijlageEigenaarSchema = z
  .string()
  .regex(/^(verzekering|medisch|reisdocumenten|(vlucht|accommodatie|reservering):.+)$/);
export type BijlageEigenaar = z.infer<typeof bijlageEigenaarSchema>;

/** Wat er van een bijlage in een backup staat, zonder de bestanden zelf. */
export const bijlageGegevensSchema = z.object({
  id: idSchema,
  eigenaar: bijlageEigenaarSchema,
  /** De oorspronkelijke bestandsnaam. */
  naam: z.string().min(1),
  /** Je eigen omschrijving, zoals "paspoort" of "e-ticket heen". */
  label: tekst(200).optional(),
  type: z.string(),
  grootte: z.number().nonnegative(),
  toegevoegdOp: z.string().min(1),
  gewijzigdOp: z.string().optional(),
});
export type BijlageGegevens = z.infer<typeof bijlageGegevensSchema>;

/** Een bijlage zoals hij in IndexedDB staat: de gegevens plus de bestanden. */
export interface Bijlage extends BijlageGegevens {
  bestand: Blob;
  /** Een JPEG om te tonen, als het origineel HEIC is. */
  weergave?: Blob;
  miniatuur?: Blob;
}

/**
 * Lege tekst en lege lijsten weghalen, overal in een object. Een formulierveld
 * dat je leeg laat hoort hetzelfde te betekenen als een veld dat er niet is, en
 * een JSON sjabloon met "" of [] erin ook.
 */
export const schoon = (waarde: unknown): unknown => {
  if (typeof waarde === 'string') {
    const getrimd = waarde.trim();
    return getrimd === '' ? undefined : getrimd;
  }
  if (Array.isArray(waarde)) {
    const lijst = waarde.map(schoon).filter((v) => v !== undefined);
    return lijst.length > 0 ? lijst : undefined;
  }
  if (waarde !== null && typeof waarde === 'object' && !(waarde instanceof Blob)) {
    const uit: Record<string, unknown> = {};
    for (const [sleutel, v] of Object.entries(waarde)) {
      const geschoond = schoon(v);
      if (geschoond !== undefined) uit[sleutel] = geschoond;
    }
    return uit;
  }
  return waarde;
};
