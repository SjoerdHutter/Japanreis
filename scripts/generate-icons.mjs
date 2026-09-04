/**
 * Genereert de PWA-iconen zonder externe afhankelijkheden: het tekenwerk
 * gebeurt met de hand in een RGBA-buffer, die daarna als PNG wordt
 * weggeschreven. De uitkomst staat in de repo, dus dit script hoeft alleen te
 * draaien als het icoon verandert:  node scripts/generate-icons.mjs
 *
 * Het beeldmerk is een torii, in wit op zegelrood.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const ZEGEL = [0x8c, 0x2f, 0x39];
const WIT = [0xff, 0xff, 0xff];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const head = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head, data])), 0);
  return Buffer.concat([len, head, data, crc]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bitdiepte
  ihdr[9] = 6; // kleurtype RGBA
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filtertype "none"
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Alles hieronder rekent in het 64x64-raster van favicon.svg. */
const inRect = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

/**
 * Een torii: twee dwarsbalken op twee staanders, met een stijltje ertussen.
 * De bovenste balk steekt aan weerszijden uit en heeft een schuine onderkant,
 * want dat is wat de vorm herkenbaar maakt.
 */
const inTorii = (x, y) => {
  // Bovenste dwarsbalk (kasagi), met uitstekende punten.
  if (inRect(x, y, 7, 13, 57, 18)) return true;
  // Het randje eronder, iets smaller.
  if (inRect(x, y, 11, 18, 53, 20)) return true;
  // Tweede dwarsbalk (nuki).
  if (inRect(x, y, 14, 26, 50, 30)) return true;
  // Stijltje tussen de twee balken.
  if (inRect(x, y, 30, 20, 34, 26)) return true;
  // De twee staanders, licht taps toelopend naar boven.
  const taps = (mx) => {
    if (y < 20 || y > 53) return false;
    const halfBoven = 3.1;
    const halfOnder = 4.2;
    const half = halfBoven + ((y - 20) / 33) * (halfOnder - halfBoven);
    return Math.abs(x - mx) <= half;
  };
  return taps(21) || taps(43);
};

function render(size, { rond, glyphSchaal }) {
  const SS = 4; // supersampling, anders zijn de randen kartelig
  const buf = Buffer.alloc(size * size * 4);
  const radius = rond ? 14 : 0;
  const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const cx = Math.min(Math.max(x, x0 + r), x1 - r);
    const cy = Math.min(Math.max(y, y0 + r), y1 - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let dekking = 0;
      let glyph = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = ((px + (sx + 0.5) / SS) / size) * 64;
          const y = ((py + (sy + 0.5) / SS) / size) * 64;
          if (inRoundRect(x, y, 0, 0, 64, 64, radius)) dekking++;
          const gx = (x - 32) / glyphSchaal + 32;
          const gy = (y - 32) / glyphSchaal + 32;
          if (inTorii(gx, gy)) glyph++;
        }
      }
      const totaal = SS * SS;
      const a = dekking / totaal;
      const g = Math.min(glyph / totaal, a);
      const i = (py * size + px) * 4;
      for (let k = 0; k < 3; k++) {
        buf[i + k] = Math.round(ZEGEL[k] * (1 - g / (a || 1)) + WIT[k] * (g / (a || 1)));
      }
      buf[i + 3] = Math.round(a * 255);
    }
  }
  return buf;
}

mkdirSync('public/icons', { recursive: true });
const bestanden = [
  ['public/icons/icon-192.png', 192, { rond: true, glyphSchaal: 1 }],
  ['public/icons/icon-512.png', 512, { rond: true, glyphSchaal: 1 }],
  ['public/icons/icon-maskable-512.png', 512, { rond: false, glyphSchaal: 0.72 }],
  ['public/icons/apple-touch-icon.png', 180, { rond: false, glyphSchaal: 0.86 }],
];
for (const [pad, size, opties] of bestanden) {
  writeFileSync(pad, encodePng(size, render(size, opties)));
  console.log(`geschreven: ${pad} (${size}px)`);
}
