import { useId, type ReactNode } from 'react';
import type { SumoTekening } from '@/domein/schema';

/**
 * De tekeningen bij de sumogids, als SVG in de app zelf.
 *
 * Geen foto's: die zijn er niet zonder rechten, ze zijn zwaar om offline mee te
 * nemen, en op een foto zie je niet wat je moet zien. Een tekening laat alleen
 * de twee worstelaars, de rand van de ring en de richting van de kracht zien.
 *
 * Een worstelaar is een pictogram: een romp, een hoofd met haarknot, een gordel
 * en vier ledematen. Per houding staan alleen de heup, de schouders, het hoofd,
 * de handen en de voeten vast; knieën en ellebogen rekent `gewricht` uit, zodat
 * een been nooit langer wordt dan een been. Rood wint in elke tekening.
 */

type Punt = readonly [number, number];

/** Lengtes van dij, scheen, bovenarm en onderarm, in tekeneenheden. */
const DIJ = 15;
const SCHEEN = 15;
const BOVENARM = 12.5;
const ONDERARM = 12.5;

/**
 * Waar het gewricht zit tussen een begin- en eindpunt met twee botten ertussen.
 * Er zijn altijd twee kanten waarop het kan knikken; `kies` beslist. Ligt het
 * eindpunt verder dan de botten reiken, dan staat het lid gestrekt.
 */
const gewricht = (
  van: Punt,
  naar: Punt,
  l1: number,
  l2: number,
  kies: (a: Punt, b: Punt) => Punt,
): Punt => {
  const dx = naar[0] - van[0];
  const dy = naar[1] - van[1];
  const afstand = Math.hypot(dx, dy) || 0.01;
  const ux = dx / afstand;
  const uy = dy / afstand;
  const d = Math.min(afstand, l1 + l2 - 0.01);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  const px = van[0] + a * ux;
  const py = van[1] + a * uy;
  return kies([px - h * uy, py + h * ux], [px + h * uy, py - h * ux]);
};

/**
 * Een houding, met het gezicht naar rechts en de voeten op y = 0. Omhoog is
 * negatief, zoals altijd in SVG.
 */
interface Houding {
  heup: Punt;
  schouder: Punt;
  hoofd: Punt;
  /** Voorste en achterste voet. */
  voetV: Punt;
  voetA: Punt;
  handV: Punt;
  handA: Punt;
  /** Waar de ellebogen heen knikken; standaard naar beneden, bij een klap omhoog. */
  ellebogen?: 'onder' | 'boven';
}

const H = {
  duwen: {
    heup: [-6, -24],
    schouder: [10, -42],
    hoofd: [19, -49],
    voetV: [6, 0],
    voetA: [-24, 0],
    handV: [30, -40],
    handA: [27, -36],
  },
  terug: {
    heup: [0, -26],
    schouder: [-5, -49],
    hoofd: [-5, -60],
    voetV: [10, 0],
    voetA: [-12, 0],
    handV: [15, -45],
    handA: [11, -52],
  },
  greep: {
    heup: [-6, -25],
    schouder: [8, -45],
    hoofd: [16, -53],
    voetV: [6, 0],
    voetA: [-22, 0],
    handV: [27, -27],
    handA: [23, -31],
  },
  laag: {
    heup: [-4, -22],
    schouder: [16, -32],
    hoofd: [26, -28],
    voetV: [6, 0],
    voetA: [-22, 0],
    handV: [31, -16],
    handA: [27, -13],
  },
  vallen: {
    heup: [-10, -26],
    schouder: [12, -16],
    hoofd: [22, -12],
    voetV: [0, 0],
    voetA: [-32, -5],
    handV: [14, 0],
    handA: [8, -1],
  },
  klaar: {
    heup: [-14, -24],
    schouder: [8, -28],
    hoofd: [18, -31],
    voetV: [-3, 0],
    voetA: [-14, 0],
    handV: [16, 0],
    handA: [12, 0],
  },
  staan: {
    heup: [0, -28],
    schouder: [2, -52],
    hoofd: [4, -63],
    voetV: [9, 0],
    voetA: [-9, 0],
    handV: [22, -46],
    handA: [19, -44],
  },
  tsuki: {
    heup: [-6, -25],
    schouder: [9, -44],
    hoofd: [17, -52],
    voetV: [6, 0],
    voetA: [-22, 0],
    handV: [33, -47],
    handA: [13, -33],
  },
  slaan: {
    heup: [-2, -27],
    schouder: [4, -49],
    hoofd: [8, -60],
    voetV: [8, 0],
    voetA: [-12, 0],
    handV: [24, -33],
    handA: [12, -36],
    ellebogen: 'boven',
  },
  werpen: {
    heup: [0, -25],
    schouder: [6, -46],
    hoofd: [10, -57],
    voetV: [12, 0],
    voetA: [-14, 0],
    handV: [26, -34],
    handA: [20, -38],
  },
  liggen: {
    heup: [0, -15],
    schouder: [20, -14],
    hoofd: [31, -13],
    voetV: [-16, -24],
    voetA: [-26, -10],
    handV: [27, -30],
    handA: [14, -4],
  },
  wankelen: {
    heup: [2, -27],
    schouder: [8, -50],
    hoofd: [12, -61],
    voetV: [13, 0],
    voetA: [-8, 0],
    handV: [21, -45],
    handA: [17, -54],
  },
  goed: {
    heup: [-8, -19],
    schouder: [4, -41],
    hoofd: [8, -52],
    voetV: [8, 0],
    voetA: [-16, 0],
    handV: [21, -36],
    handA: [18, -33],
  },
  fout: {
    heup: [0, -29],
    schouder: [20, -34],
    hoofd: [30, -27],
    voetV: [6, 0],
    voetA: [-6, 0],
    handV: [32, -19],
    handA: [29, -17],
  },
} satisfies Record<string, Houding>;

type Kleur = 'rood' | 'blauw';
const KLEUREN: Record<Kleur, { lijf: string; diep: string }> = {
  rood: { lijf: 'var(--sumo-rood)', diep: 'var(--sumo-rood-diep)' },
  blauw: { lijf: 'var(--sumo-blauw)', diep: 'var(--sumo-blauw-diep)' },
};

const VLAK = 'var(--sumo-vlak)';
const LIJN = 'var(--sumo-lijn)';

/** De y van de grond in elke tekening. */
const GROND = 104;

const punten = (...p: Punt[]) => p.map(([x, y]) => `${x},${y}`).join(' ');

/** Een arm of been, met een rand in de kleur van het vlak zodat hij loskomt van de romp. */
const Lid = ({ door, breedte, kleur }: { door: Punt[]; breedte: number; kleur: string }) => (
  <>
    <polyline
      points={punten(...door)}
      fill="none"
      stroke={VLAK}
      strokeWidth={breedte + 3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <polyline
      points={punten(...door)}
      fill="none"
      stroke={kleur}
      strokeWidth={breedte}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </>
);

const Rikishi = ({
  h,
  x,
  richting = 1,
  kleur = 'rood',
  schaal = 1.2,
  vaag = false,
}: {
  h: Houding;
  x: number;
  /** 1 kijkt naar rechts, -1 naar links. */
  richting?: 1 | -1;
  kleur?: Kleur;
  schaal?: number;
  /** Half doorzichtig, voor waar hij een tel eerder stond. */
  vaag?: boolean;
}) => {
  const clip = `romp-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { lijf, diep } = KLEUREN[kleur];

  const knie = (voet: Punt) => gewricht(h.heup, voet, DIJ, SCHEEN, (a, b) => (a[0] > b[0] ? a : b));
  const elleboog = (hand: Punt) =>
    gewricht(h.schouder, hand, BOVENARM, ONDERARM, (a, b) =>
      (h.ellebogen === 'boven' ? a[1] < b[1] : a[1] > b[1]) ? a : b,
    );
  // Het been eindigt net boven de grond; de voet eronder staat erop.
  const enkel = (voet: Punt): Punt => [voet[0], voet[1] - 4.5];

  const vx = h.schouder[0] - h.heup[0];
  const vy = h.schouder[1] - h.heup[1];
  const lengte = Math.hypot(vx, vy);
  // De buik steekt een beetje naar voren uit, haaks op de ruggengraat.
  const nx = -vy / lengte;
  const ny = vx / lengte;
  const mx = (h.heup[0] + h.schouder[0]) / 2 + nx * 3;
  const my = (h.heup[1] + h.schouder[1]) / 2 + ny * 3;
  const hoek = (Math.atan2(vy, vx) * 180) / Math.PI;
  const rx = lengte / 2 + 8;
  const ry = 14.5;

  const voet = (v: Punt, kleurVoet: string) => (
    <ellipse cx={v[0] + 2.5} cy={v[1] - 3} rx={6.5} ry={3.2} fill={kleurVoet} />
  );

  return (
    <g
      transform={`translate(${x} ${GROND}) scale(${richting * schaal} ${schaal})`}
      opacity={vaag ? 0.28 : 1}
    >
      <Lid door={[h.schouder, elleboog(h.handA), h.handA]} breedte={7.5} kleur={diep} />
      <Lid door={[h.heup, knie(h.voetA), enkel(h.voetA)]} breedte={10} kleur={diep} />
      {voet(h.voetA, diep)}

      <g transform={`translate(${mx} ${my}) rotate(${hoek})`}>
        <clipPath id={clip}>
          <ellipse cx={0} cy={0} rx={rx} ry={ry} />
        </clipPath>
        <ellipse cx={0} cy={0} rx={rx} ry={ry} fill={lijf} stroke={VLAK} strokeWidth={2} />
        <rect
          x={-lengte / 2 + 1}
          y={-ry}
          width={9}
          height={ry * 2}
          fill="var(--sumo-band)"
          clipPath={`url(#${clip})`}
        />
      </g>

      <Lid door={[h.heup, knie(h.voetV), enkel(h.voetV)]} breedte={10} kleur={lijf} />
      {voet(h.voetV, lijf)}

      <circle cx={h.hoofd[0]} cy={h.hoofd[1]} r={8} fill={lijf} stroke={VLAK} strokeWidth={2} />
      <ellipse
        cx={h.hoofd[0] - 3}
        cy={h.hoofd[1] - 8}
        rx={3.6}
        ry={2.4}
        transform={`rotate(-15 ${h.hoofd[0] - 3} ${h.hoofd[1] - 8})`}
        fill={diep}
      />

      <Lid door={[h.schouder, elleboog(h.handV), h.handV]} breedte={7.5} kleur={lijf} />
    </g>
  );
};

/** Een pijl in de richting van de kracht, recht of met een bocht via `via`. */
const Pijl = ({
  van,
  naar,
  via,
  kleur = LIJN,
}: {
  van: Punt;
  naar: Punt;
  via?: Punt;
  kleur?: string;
}) => {
  const richtpunt = via ?? van;
  const hoek = Math.atan2(naar[1] - richtpunt[1], naar[0] - richtpunt[0]);
  const punt = (afstand: number, draai: number): Punt => [
    naar[0] - afstand * Math.cos(hoek + draai),
    naar[1] - afstand * Math.sin(hoek + draai),
  ];
  const d = via
    ? `M${van[0]},${van[1]} Q${via[0]},${via[1]} ${naar[0]},${naar[1]}`
    : `M${van[0]},${van[1]} L${naar[0]},${naar[1]}`;
  return (
    <g>
      <path d={d} fill="none" stroke={kleur} strokeWidth={2.2} strokeLinecap="round" />
      <polygon points={punten(naar, punt(8, 0.45), punt(8, -0.45))} fill={kleur} />
    </g>
  );
};

/** Een stippelcirkel om waar het om draait: de voet buiten de ring, de hand op de grond. */
const Markering = ({ op, r = 9 }: { op: Punt; r?: number }) => (
  <circle
    cx={op[0]}
    cy={op[1]}
    r={r}
    fill="none"
    stroke="var(--sumo-markering)"
    strokeWidth={2}
    strokeDasharray="3 2.5"
  />
);

const Tekst = ({
  x,
  y,
  children,
  anker = 'middle',
  vet = false,
}: {
  x: number;
  y: number;
  children: ReactNode;
  anker?: 'start' | 'middle' | 'end';
  vet?: boolean;
}) => (
  <text
    x={x}
    y={y}
    textAnchor={anker}
    fontSize={9.5}
    fontWeight={vet ? 600 : 400}
    fill={LIJN}
    opacity={vet ? 1 : 0.8}
  >
    {children}
  </text>
);

/**
 * De ring van opzij: een strook klei, en waar `rand` gezet is een strobaal met
 * rechts daarvan het zand van buiten de ring.
 */
const Dohyo = ({ rand }: { rand?: number }) => (
  <g>
    <rect x={0} y={GROND} width={240} height={12} fill="var(--sumo-klei)" />
    {rand !== undefined && (
      <>
        <rect x={rand + 4} y={GROND} width={236 - rand} height={12} fill="var(--sumo-zand)" />
        {Array.from({ length: Math.floor((236 - rand) / 7) }, (_, i) => (
          <circle
            key={i}
            cx={rand + 8 + i * 7}
            cy={GROND + 3 + (i % 3) * 3}
            r={0.9}
            fill="var(--sumo-stro)"
          />
        ))}
        <ellipse cx={rand} cy={GROND} rx={5.5} ry={4} fill="var(--sumo-stro)" />
        <Tekst x={rand - 7} y={GROND + 22} anker="end">
          strobaal
        </Tekst>
        <Tekst x={rand + 7} y={GROND + 22} anker="start">
          buiten
        </Tekst>
      </>
    )}
    <line x1={0} y1={GROND} x2={240} y2={GROND} stroke={LIJN} strokeOpacity={0.35} />
  </g>
);

const Vlak = ({
  label,
  hoogte = 130,
  children,
}: {
  label: string;
  hoogte?: number;
  children: ReactNode;
}) => (
  <svg viewBox={`0 0 240 ${hoogte}`} role="img" aria-label={label} className="block h-auto w-full">
    {children}
  </svg>
);

/** De ring van bovenaf, met maten en namen. */
const Ring = () => {
  const cx = 120;
  const cy = 96;
  const r = 62;
  return (
    <Vlak
      label="De ring van bovenaf: een cirkel van strobalen op een vierkant van klei, met twee startlijnen in het midden"
      hoogte={190}
    >
      <rect x={cx - 86} y={cy - 86} width={172} height={172} rx={6} fill="var(--sumo-klei)" />
      <circle cx={cx} cy={cy} r={r + 10} fill="var(--sumo-zand)" />
      <circle cx={cx} cy={cy} r={r - 3} fill="var(--sumo-klei)" />
      {/* De balen, met op vier plekken een die iets naar buiten ligt. */}
      {Array.from({ length: 20 }, (_, i) => {
        const hoek = (i / 20) * Math.PI * 2;
        const naarBuiten = i % 5 === 0 ? 4 : 0;
        const straal = r + naarBuiten;
        const breed = (Math.PI * 2 * r) / 20 - 2;
        return (
          <rect
            key={i}
            x={cx + straal * Math.cos(hoek) - 2.5}
            y={cy + straal * Math.sin(hoek) - breed / 2}
            width={5}
            height={breed}
            rx={2}
            fill="var(--sumo-stro)"
            transform={`rotate(${(hoek * 180) / Math.PI} ${cx + straal * Math.cos(hoek)} ${cy + straal * Math.sin(hoek)})`}
          />
        );
      })}
      <rect x={cx - 12} y={cy - 9} width={3} height={18} rx={1} fill="#ffffff" />
      <rect x={cx + 9} y={cy - 9} width={3} height={18} rx={1} fill="#ffffff" />

      <line x1={cx - r} y1={cy + 30} x2={cx + r} y2={cy + 30} stroke={LIJN} strokeOpacity={0.6} />
      <line x1={cx - r} y1={cy + 25} x2={cx - r} y2={cy + 35} stroke={LIJN} strokeOpacity={0.6} />
      <line x1={cx + r} y1={cy + 25} x2={cx + r} y2={cy + 35} stroke={LIJN} strokeOpacity={0.6} />
      <Tekst x={cx} y={cy + 44} vet>
        4,55 meter
      </Tekst>

      <Tekst x={cx} y={cy - 16} vet>
        startlijnen
      </Tekst>
      <Tekst x={cx} y={10} vet>
        strobalen (tawara)
      </Tekst>
      <line x1={cx} y1={14} x2={cx} y2={cy - r - 6} stroke={LIJN} strokeOpacity={0.5} />
      <Tekst x={236} y={cy - 70} anker="end">
        zand: hier zie je
      </Tekst>
      <Tekst x={236} y={cy - 59} anker="end">
        elke voetafdruk
      </Tekst>
      <line x1={196} y1={cy - 55} x2={cx + r + 5} y2={cy - 34} stroke={LIJN} strokeOpacity={0.5} />
      <Tekst x={4} y={cy - 70} anker="start">
        klei
      </Tekst>
      <line x1={14} y1={cy - 66} x2={cx - 78} y2={cy - 50} stroke={LIJN} strokeOpacity={0.5} />
    </Vlak>
  );
};

const UitDeRing = () => (
  <Vlak label="Rood duwt blauw achteruit; blauw zet een voet in het zand buiten de strobaal en verliest">
    <Dohyo rand={186} />
    <Rikishi h={H.duwen} x={110} />
    <Rikishi h={{ ...H.terug, voetA: [-24, 0] }} x={170} richting={-1} kleur="blauw" />
    <Pijl van={[60, 40]} naar={[100, 40]} />
    <Markering op={[196, GROND - 3]} r={10} />
    <Tekst x={120} y={14} vet>
      Uit de ring
    </Tekst>
  </Vlak>
);

const GrondGeraakt = () => (
  <Vlak label="Blauw valt naar voren en raakt binnen de ring de grond met zijn hand, en verliest">
    <Dohyo />
    <Rikishi h={H.vallen} x={74} kleur="blauw" />
    <Rikishi h={H.staan} x={176} richting={-1} />
    <Markering op={[74 + 14 * 1.2, GROND - 2]} r={10} />
    <Tekst x={120} y={14} vet>
      Hand op de grond
    </Tekst>
  </Vlak>
);

const Shikiri = () => (
  <Vlak label="Beide worstelaars hurken achter hun startlijn, vuisten op de grond">
    <Dohyo />
    <rect x={98} y={GROND - 1} width={10} height={3} fill="#ffffff" />
    <rect x={132} y={GROND - 1} width={10} height={3} fill="#ffffff" />
    <Rikishi h={H.klaar} x={84} schaal={1.35} />
    <Rikishi h={H.klaar} x={156} richting={-1} kleur="blauw" schaal={1.35} />
    <Tekst x={120} y={GROND + 22}>
      startlijnen
    </Tekst>
    <Tekst x={120} y={14} vet>
      Klaar: vuisten op de grond
    </Tekst>
  </Vlak>
);

const Tachiai = () => (
  <Vlak label="Beide worstelaars springen tegelijk op en botsen in het midden">
    <Dohyo />
    <Rikishi h={H.duwen} x={86} />
    <Rikishi h={H.duwen} x={154} richting={-1} kleur="blauw" />
    {[
      [120, 28, 120, 18],
      [128, 32, 136, 25],
      [112, 32, 104, 25],
    ].map(([x1, y1, x2, y2], i) => (
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="var(--sumo-markering)"
        strokeWidth={2}
        strokeLinecap="round"
      />
    ))}
    <Tekst x={120} y={12} vet>
      Start: tegelijk opspringen
    </Tekst>
  </Vlak>
);

const Yorikiri = () => (
  <Vlak label="Rood heeft blauw bij de gordel en loopt hem achteruit de ring uit">
    <Dohyo rand={196} />
    <Rikishi h={H.greep} x={100} />
    <Rikishi
      h={{ ...H.greep, schouder: [6, -46], hoofd: [11, -56] }}
      x={160}
      richting={-1}
      kleur="blauw"
    />
    <Pijl van={[48, 36]} naar={[92, 36]} />
  </Vlak>
);

const Oshidashi = () => (
  <Vlak label="Rood duwt met beide handen tegen de borst van blauw, zonder de gordel vast te houden">
    <Dohyo rand={198} />
    <Rikishi h={H.duwen} x={96} />
    <Rikishi h={H.terug} x={160} richting={-1} kleur="blauw" />
    <Pijl van={[46, 36]} naar={[88, 36]} />
  </Vlak>
);

const Tsukidashi = () => (
  <Vlak label="Rood stoot met een gestrekte open hand, blauw slaat achteruit">
    <Dohyo rand={200} />
    <Rikishi h={H.tsuki} x={86} />
    <Rikishi
      h={{ ...H.terug, schouder: [-8, -48], hoofd: [-10, -59] }}
      x={162}
      richting={-1}
      kleur="blauw"
    />
    {[-8, 0, 8].map((dy, i) => (
      <line
        key={i}
        x1={130}
        y1={GROND - 56 + dy}
        x2={138}
        y2={GROND - 58 + dy * 1.4}
        stroke="var(--sumo-markering)"
        strokeWidth={2}
        strokeLinecap="round"
      />
    ))}
    <Pijl van={[36, 36]} naar={[78, 36]} />
  </Vlak>
);

const Hatakikomi = () => (
  <Vlak label="Blauw duikt laag naar voren; rood stapt opzij en slaat hem op de rug neer">
    <Dohyo />
    <Rikishi h={H.laag} x={70} kleur="blauw" />
    <Rikishi h={H.slaan} x={150} richting={-1} />
    <Pijl van={[106, 30]} naar={[104, 56]} kleur="var(--sumo-markering)" />
    <Pijl van={[26, 40]} naar={[60, 40]} kleur="var(--sumo-blauw)" />
  </Vlak>
);

const Uwatenage = () => (
  <Vlak label="Rood heeft de gordel over de arm van blauw gepakt, draait weg en gooit hem om zijn heup tegen de grond">
    <Dohyo />
    <Rikishi h={H.staan} x={196} richting={-1} kleur="blauw" vaag />
    <Rikishi h={H.werpen} x={66} />
    <Rikishi h={H.liggen} x={142} richting={-1} kleur="blauw" />
    <Pijl van={[188, 22]} via={[150, -4]} naar={[122, 60]} />
  </Vlak>
);

const Okuridashi = () => (
  <Vlak label="Blauw staat met zijn rug naar rood; rood duwt hem van achteren de ring uit">
    <Dohyo rand={198} />
    <Rikishi h={H.duwen} x={96} />
    <Rikishi h={H.wankelen} x={150} kleur="blauw" />
    <Pijl van={[44, 36]} naar={[88, 36]} />
  </Vlak>
);

const Vinkje = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r={9} fill="var(--sumo-goed)" />
    <polyline
      points="-4,0 -1,3.5 4.5,-3.5"
      fill="none"
      stroke="#ffffff"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </g>
);

const Kruisje = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r={9} fill="var(--sumo-markering)" />
    <path
      d="M-3.5,-3.5 L3.5,3.5 M3.5,-3.5 L-3.5,3.5"
      stroke="#ffffff"
      strokeWidth={2.2}
      strokeLinecap="round"
    />
  </g>
);

const Houding = () => (
  <Vlak
    label="Goed: laag, knieën gebogen, rug recht en hoofd omhoog. Fout: benen gestrekt, voorovergebogen met het hoofd omlaag"
    hoogte={136}
  >
    <Dohyo />
    <Rikishi h={H.goed} x={58} />
    <Rikishi h={H.fout} x={168} kleur="blauw" />
    <Vinkje x={20} y={20} />
    <Tekst x={34} y={23} anker="start" vet>
      laag, rug recht
    </Tekst>
    <Kruisje x={134} y={20} />
    <Tekst x={148} y={23} anker="start" vet>
      hoofd omlaag
    </Tekst>
    <Tekst x={58} y={GROND + 22}>
      knieën diep, kijk vooruit
    </Tekst>
    <Tekst x={176} y={GROND + 22}>
      valt zo voorover
    </Tekst>
  </Vlak>
);

/** Een voetafdruk van bovenaf, met de tenen naar rechts. */
const Voet = ({ x, y, kleur }: { x: number; y: number; kleur: string }) => (
  <g transform={`translate(${x} ${y})`} fill={kleur}>
    <ellipse cx={0} cy={0} rx={8} ry={4.2} />
    <circle cx={9.5} cy={-2.5} r={1.6} />
    <circle cx={10} cy={0.6} r={1.4} />
    <circle cx={9} cy={3.4} r={1.2} />
  </g>
);

const SuriAshi = () => (
  <Vlak
    label="Van bovenaf: goed is schuiven met de voeten uit elkaar; fout is de voeten kruisen"
    hoogte={136}
  >
    <Vinkje x={18} y={20} />
    <Tekst x={32} y={23} anker="start" vet>
      schuiven, voeten uit elkaar
    </Tekst>
    {[0, 1, 2].map((i) => (
      <g key={i}>
        <line
          x1={20 + i * 62}
          y1={40}
          x2={44 + i * 62}
          y2={40}
          stroke={LIJN}
          strokeOpacity={0.3}
          strokeWidth={6}
          strokeLinecap="round"
        />
        <line
          x1={44 + i * 62}
          y1={58}
          x2={68 + i * 62}
          y2={58}
          stroke={LIJN}
          strokeOpacity={0.3}
          strokeWidth={6}
          strokeLinecap="round"
        />
        <Voet x={52 + i * 62} y={40} kleur="var(--sumo-rood)" />
        <Voet x={76 + i * 62} y={58} kleur="var(--sumo-rood)" />
      </g>
    ))}
    <Kruisje x={18} y={86} />
    <Tekst x={32} y={89} anker="start" vet>
      voeten kruisen of optillen
    </Tekst>
    <Voet x={60} y={118} kleur="var(--sumo-blauw)" />
    <Voet x={96} y={106} kleur="var(--sumo-blauw)" />
    <Voet x={132} y={120} kleur="var(--sumo-blauw)" />
    <Voet x={170} y={104} kleur="var(--sumo-blauw)" />
    <path
      d="M60,118 L96,106 L132,120 L170,104"
      fill="none"
      stroke={LIJN}
      strokeOpacity={0.35}
      strokeDasharray="3 3"
    />
  </Vlak>
);

const TEKENINGEN: Record<SumoTekening, () => ReactNode> = {
  ring: Ring,
  'uit-de-ring': UitDeRing,
  'grond-geraakt': GrondGeraakt,
  shikiri: Shikiri,
  tachiai: Tachiai,
  yorikiri: Yorikiri,
  oshidashi: Oshidashi,
  tsukidashi: Tsukidashi,
  hatakikomi: Hatakikomi,
  uwatenage: Uwatenage,
  okuridashi: Okuridashi,
  houding: Houding,
  'suri-ashi': SuriAshi,
};

/** Eén tekening op zijn vaste vlak, met afgeronde hoeken zoals een kaartje. */
export const Tekening = ({ id }: { id: SumoTekening }) => {
  const Inhoud = TEKENINGEN[id];
  return (
    <div className="sumo-tekening overflow-hidden rounded-xl border border-black/5 dark:border-white/10">
      <Inhoud />
    </div>
  );
};
