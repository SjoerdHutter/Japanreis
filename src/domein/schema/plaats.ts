import { z } from 'zod';
import {
  bronSchema,
  coordinaatSchema,
  openingstijdenSchema,
  prijsRegelSchema,
  prijsSchema,
  sluitingSchema,
  weekdagSchema,
} from './basis';

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
  // Een massage of een hotelspa. Geen attractie, want je komt er niet om iets te
  // bekijken, en geen eten. Op een regendag of na een lange vlucht is het
  // precies wat je zoekt, dus het verdient een eigen knop.
  'spa',
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
  // Iets wat je doet in plaats van bekijkt, zoals een sumoshow waar je zelf de
  // ring in stapt. Onder `museum` zou het opduiken bij wie een tentoonstelling
  // zoekt, en het is net als een pretpark betaald, binnen en vooraf te boeken.
  'ervaring',
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
  // Waar je komt om te drinken: een cocktailbar, een rooftopbar, bia hoi op een
  // krukje. Geen van de keukens hierboven dekt dat.
  'bar',
]);
export type Keuken = z.infer<typeof keukenSchema>;

export const dagdeelSchema = z.enum(['ochtend', 'middag', 'avond', 'nacht']);
export type Dagdeel = z.infer<typeof dagdeelSchema>;

export const drukteniveauSchema = z.enum(['rustig', 'druk', 'zeer-druk']);
export type Drukteniveau = z.infer<typeof drukteniveauSchema>;

export const reserveringSchema = z.enum(['verplicht', 'aanbevolen', 'niet-nodig']);
export type Reservering = z.infer<typeof reserveringSchema>;

/** Wanneer het rustig en druk is. Bij attracties, en ook bij eten en spa's. */
export const drukteSchema = z.object({
  besteMoment: z.string().optional(),
  drukstMoment: z.string().optional(),
  /**
   * Het rustigste moment als tijdvak dat de planner kan lezen: "voor
   * 08:00", "na 17:00", "07:00 tot 09:00" of "bij opening". Zie
   * domein/planning/drukte.ts.
   */
  besteTijdslot: z.string().optional(),
  /** Hoe druk het is per dagdeel. */
  perDagdeel: z.partialRecord(dagdeelSchema, drukteniveauSchema).optional(),
  druksteDagen: z.array(weekdagSchema).optional(),
  /** Uit algemene kennis; de app zet er "controleren" bij tot je het aanvinkt. */
  gecontroleerd: z.boolean().optional(),
});
export type Drukte = z.infer<typeof drukteSchema>;

/** Bezoekduur in minuten; voedt zowel het filter als de dagplanner. */
const bezoekduurSchema = z.number().int().positive().optional();

/** Extra velden die alleen een attractie heeft. */
export const attractieSchema = z.object({
  type: attractieTypeSchema,
  bezoekduurMinuten: bezoekduurSchema,
  regenbestendig: z.boolean().optional(),
  dagdeel: z.array(dagdeelSchema).optional(),
  drukte: drukteSchema.optional(),
});

/** Extra velden die alleen een eetlocatie heeft. */
export const eetlocatieSchema = z.object({
  keuken: keukenSchema,
  /**
   * De keuken zoals hij in de bron staat, zoals "Cha ca (vis)". `keuken` is de
   * knop in het filter; dit is de precieze omschrijving op de detailpagina.
   */
  keukenTekst: z.string().optional(),
  ontbijt: z.boolean().optional(),
  lateNight: z.boolean().optional(),
  /**
   * Het verschil tussen een zaak waarvoor je omloopt en een zaak waar je
   * toevallig langskomt. Zonder dit onderscheid wordt elke lijst een brij.
   */
  moeite: z.enum(['waardig-een-omweg', 'snelle-bak']).optional(),
  bezoekduurMinuten: bezoekduurSchema,
  drukte: drukteSchema.optional(),
});

/** Extra velden van een spa. */
export const spaSchema = z.object({
  bezoekduurMinuten: bezoekduurSchema,
  drukte: drukteSchema.optional(),
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
  /**
   * Waar de pin staat. Kan ontbreken: een plek waarvoor de geocoder niets
   * bruikbaars vond, krijgt geen pin op een gok maar komt in de lijst "Locatie
   * ontbreekt", en dan zet je hem zelf op de kaart.
   */
  coordinaten: coordinaatSchema.optional(),
  /** Waar de coördinaten vandaan komen, als ze niet met de hand zijn gezet. */
  coordBron: z.enum(['nominatim']).optional(),
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
  /**
   * Alleen contant, geen kaart. In Japan geldt dat voor veel kleine tempels,
   * marktkramen en eettentjes, in Hanoi voor vrijwel alle straateten. Je zet
   * het ook zelf per plaats, als eigen waarde.
   */
  alleenContant: z.boolean().optional(),
  /** Verwijzing naar de tijdvakken uit de tijdlijn; zie tijdlijn.ts. */
  tijdvakken: z.array(z.string()).optional(),

  attractie: attractieSchema.optional(),
  eten: eetlocatieSchema.optional(),
  spa: spaSchema.optional(),
  ekiStempel: ekiStempelSchema.optional(),
  goshuin: goshuinStempelSchema.optional(),

  bronnen: z.array(bronSchema).optional(),
  tags: z.array(z.string()).optional(),

  // Wat een uitgezochte plek extra kan hebben. Alles optioneel, zodat de
  // bestaande plekken er niets van merken.

  /** De plaats in de Top 20 van de stad. */
  rang: z.number().int().min(1).max(20).optional(),
  /**
   * De plek waar deze onder valt, zoals de Ngoc Son tempel onder het Hoan Kiem
   * meer. Hij krijgt een eigen pin, maar staat in de Top 20 onder de hoofdplek.
   */
  onderdeelVan: z.string().optional(),
  /** Het adres in lokaal schrift, voor de taxichauffeur. `adres` is het Latijnse. */
  adresLokaal: z.string().optional(),
  /** Waarom deze plek in de lijst staat, in een paar zinnen. */
  waarom: z.string().optional(),
  tips: z.array(z.string().min(1)).optional(),
  /** Wat je echt moet weten voor je gaat; staat opvallend op het scherm. */
  letOp: z.array(z.string().min(1)).optional(),
  /** Periodes waarin de plek dicht is. Gaat voor de openingstijden. */
  sluitingen: z.array(sluitingSchema).optional(),
  /** Aanvangstijden, voor een plek waar je naar een voorstelling gaat. */
  voorstellingen: z.array(z.string().regex(/^\d{2}:\d{2}$/, 'een tijd als 16:10')).optional(),
  /** Alle prijzen; `prijs` is het ene bedrag uit de labels en filters. */
  prijzen: z.array(prijsRegelSchema).optional(),
  /** Wat er over de prijs te zeggen valt als er geen bedrag bekend is. */
  prijsTekst: z.string().optional(),
  /** Een onderscheiding, zoals "Michelin 1 ster". */
  onderscheiding: z.string().optional(),
  /** De bezienswaardigheden waar deze eet, drink of spa plek bij in de buurt ligt. */
  inDeBuurtVan: z.array(z.string()).optional(),
  /** Onzeker: de toegang wisselt, zoals bij Train Street. */
  status: z.enum(['onzeker']).optional(),
  web: z.url().optional(),
  telefoon: z.string().optional(),
  /** Wanneer de feiten zijn verzameld. */
  gecheckt: z.iso.date().optional(),
  /**
   * False zet het label "controleren" bij de plek, tot je hem in de app
   * aanvinkt. Zie het scherm Controleren.
   */
  gecontroleerd: z.boolean().optional(),
});
export type Plaats = z.infer<typeof plaatsSchema>;

/**
 * Een bestand met plaatsen voor één stad. De stad zit in elk punt zelf, zodat
 * een punt na het inlezen ook los blijft kloppen.
 */
export const plaatsenBestandSchema = z.array(plaatsSchema);
