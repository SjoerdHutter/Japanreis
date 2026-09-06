import { z } from 'zod';
import { bronSchema, coordinaatSchema, openingstijdenSchema, prijsSchema } from './basis';

/**
 * Het centrale model van de app: één punt op de kaart.
 *
 * Alles hangt hieraan. Een attractie, een ramenzaak, een stempeltafel en later
 * een eigen punt uit Google Maps of een foto met GPS zijn allemaal een `Plaats`.
 * Dat is met opzet: zodra dit model uiteenvalt in losse modellen per functie,
 * kan de kaart ze niet meer samen tonen en kan de dagplanner ze niet meer door
 * elkaar plannen.
 *
 * Onderscheid loopt via `categorie` (wat voor soort punt is het) en daarbinnen
 * via `type` (wat voor tempel, wat voor keuken). De velden die maar voor één
 * categorie gelden staan in een eigen blokje, zodat een restaurant geen leeg
 * veld "regenbestendig" hoeft te dragen.
 */

export const categorieSchema = z.enum([
  'attractie',
  'eten',
  'winkel',
  'vervoer',
  'verblijf',
  'overig',
]);
export type Categorie = z.infer<typeof categorieSchema>;

/**
 * De filters uit hoofdstuk 2 van de functiespecificatie.
 *
 * Twee soorten staan niet in die lijst maar wel in het reisschema, en ze onder
 * een bestaande noemer schuiven zou het filter juist onbruikbaar maken. Een
 * pretpark onder `park` zetten laat het opduiken bij wie een plantsoen zoekt,
 * en een aquarium onder `museum` bij wie binnen wil zitten met een tentoon-
 * stelling. Beide zijn dagvullend, betaald en regenbestendig, en verdienen dus
 * hun eigen knop.
 */
export const attractieTypeSchema = z.enum([
  'tempel',
  'schrijn',
  'tuin',
  'museum',
  'uitzichtpunt',
  'wijk',
  'markt',
  'kasteel',
  'park',
  'monument',
  'water',
  'pretpark',
  'aquarium',
]);
export type AttractieType = z.infer<typeof attractieTypeSchema>;

/**
 * Keukens. Japan en Hanoi hebben elk hun eigen lijst, precies zoals de spec
 * vraagt; ze staan in één enum omdat een plaats maar in één land ligt en het
 * filter per stad toch al gefilterd wordt op wat daar voorkomt.
 */
export const keukenSchema = z.enum([
  // Japan
  'sushi',
  'ramen',
  'izakaya',
  'yakiniku',
  'tempura',
  'kaiseki',
  'soba-udon',
  'curry',
  'konbini',
  'depachika',
  // Twee toevoegingen op de lijst uit de specificatie. Osaka en Hiroshima zijn
  // zonder okonomiyaki niet te beschrijven, en onder izakaya schuiven doet
  // geen recht aan wat je er zoekt. En een theehuis is geen restaurant: je gaat
  // er voor een ceremonie van een uur zitten, niet voor een maaltijd. Kanazawa
  // en Kyoto staan er vol mee.
  'okonomiyaki',
  'thee',
  // Hanoi
  'pho',
  'bun-cha',
  'banh-mi',
  'streetfood',
  'koffie',
  'restaurant',
]);
export type Keuken = z.infer<typeof keukenSchema>;

export const dagdeelSchema = z.enum(['ochtend', 'middag', 'avond', 'nacht']);
export type Dagdeel = z.infer<typeof dagdeelSchema>;

export const reserveringSchema = z.enum(['verplicht', 'aanbevolen', 'niet-nodig']);
export type Reservering = z.infer<typeof reserveringSchema>;

/** Extra velden die alleen een attractie heeft. */
export const attractieSchema = z.object({
  type: attractieTypeSchema,
  /** Bezoekduur in minuten; voedt zowel het filter als de dagplanner. */
  bezoekduurMinuten: z.number().int().positive().optional(),
  regenbestendig: z.boolean().optional(),
  dagdeel: z.array(dagdeelSchema).optional(),
  drukte: z
    .object({
      besteMoment: z.string().optional(),
      drukstMoment: z.string().optional(),
    })
    .optional(),
});

/** Extra velden die alleen een eetlocatie heeft. */
export const eetlocatieSchema = z.object({
  keuken: keukenSchema,
  ontbijt: z.boolean().optional(),
  lateNight: z.boolean().optional(),
  /**
   * Het verschil tussen een zaak waarvoor je omloopt en een zaak waar je
   * toevallig langskomt. Zonder dit onderscheid wordt elke lijst een brij.
   */
  moeite: z.enum(['waardig-een-omweg', 'snelle-bak']).optional(),
});

/** Een eki stamp: gratis stempel, meestal op een station. */
export const ekiStempelSchema = z.object({
  /**
   * Waar de tafel precies staat. Dit is het hele punt van dit veld: de stempel
   * staat zelden bij de ingang en vaak verstopt bij een doorgang naar de
   * perrons of naast een informatiebalie.
   */
  waar: z.string().min(1),
  openingstijden: openingstijdenSchema.optional(),
});

/** Een goshuin: kalligrafiestempel bij een tempel of schrijn. */
export const goshuinStempelSchema = z.object({
  waar: z.string().min(1),
  prijs: prijsSchema.optional(),
  /**
   * Apart van de openingstijden van de tempel zelf, want het stempelkantoor
   * sluit er vaak een half uur tot een uur eerder.
   */
  openingstijden: openingstijdenSchema.optional(),
  /** Sommige plekken geven alleen een vooraf geschreven vel, geen kalligrafie. */
  alleenVoorgeschreven: z.boolean().optional(),
});

export const plaatsSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'alleen kleine letters, cijfers en streepjes'),
  naam: z.string().min(1),
  /** De naam in het Japans of Vietnamees, om aan te wijzen of in te typen. */
  naamLokaal: z.string().optional(),
  stad: z.string().min(1),
  categorie: categorieSchema,
  coordinaten: coordinaatSchema,
  /**
   * Waar of de pin het gebouw aanwijst of alleen het huizenblok.
   *
   * Nodig omdat een Japans adres geen straat en huisnummer is maar een wijk,
   * een blok en een volgnummer binnen dat blok. Zonder geocoder is daar het
   * blok uit af te leiden en niet de deur, en dat is voor een tempel geen
   * probleem maar voor een winkel op de zesde verdieping wel. Liever een pin
   * met de mededeling dat hij op honderd meter kan zitten dan een pin die
   * precisie voorwendt die er niet is.
   */
  coordinaatGeschat: z.boolean().optional(),
  beschrijving: z.string().optional(),
  adres: z.string().optional(),
  openingstijden: openingstijdenSchema.optional(),
  /** Ongebruikelijke sluitingen die niet in een weekpatroon passen. */
  geslotenOpmerking: z.string().optional(),
  prijs: prijsSchema.optional(),
  reservering: reserveringSchema.optional(),
  /** Verwijzing naar de tijdvakken uit de tijdlijn; zie tijdlijn.ts. */
  tijdvakken: z.array(z.string()).optional(),

  attractie: attractieSchema.optional(),
  eten: eetlocatieSchema.optional(),
  ekiStempel: ekiStempelSchema.optional(),
  goshuin: goshuinStempelSchema.optional(),

  bronnen: z.array(bronSchema).optional(),
  tags: z.array(z.string()).optional(),
});
export type Plaats = z.infer<typeof plaatsSchema>;

/**
 * Een bestand met plaatsen voor één stad. De stad zit in elk punt zelf, zodat
 * een punt na het inlezen ook los blijft kloppen.
 */
export const plaatsenBestandSchema = z.array(plaatsSchema);
