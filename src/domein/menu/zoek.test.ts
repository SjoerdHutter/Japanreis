import { describe, expect, it } from 'vitest';
import type { MenuItem } from '@/domein/schema';
import {
  allergenenVoorJou,
  isJapans,
  normaliseerJapans,
  normaliseerRomaji,
  score,
  zoekOpMenu,
} from './zoek';

const item = (deel: Partial<MenuItem> & Pick<MenuItem, 'id' | 'kana' | 'romaji'>): MenuItem => ({
  categorie: 'ramen',
  nederlands: '',
  allergenen: [],
  gecontroleerd: false,
  ...deel,
});

const RAMEN = item({
  id: 'ramen',
  kana: 'ラーメン',
  romaji: 'rāmen',
  nederlands: 'Tarwenoedels in bouillon.',
  allergenen: ['gluten', 'soja'],
});
const SHOYU = item({
  id: 'shoyu-ramen',
  kanji: '醤油ラーメン',
  kana: 'しょうゆラーメン',
  romaji: 'shōyu rāmen',
  nederlands: 'Heldere bouillon op basis van sojasaus.',
  allergenen: ['gluten', 'soja', 'vis'],
});
const TEMPURA = item({
  id: 'tempura',
  categorie: 'izakaya',
  kanji: '天ぷら',
  kana: 'てんぷら',
  romaji: 'tempura',
  nederlands: 'Groente of garnalen in een luchtig beslag gefrituurd.',
  allergenen: ['gluten', 'ei', 'schaaldieren'],
});
const EDAMAME = item({
  id: 'edamame',
  categorie: 'izakaya',
  kanji: '枝豆',
  kana: 'えだまめ',
  romaji: 'edamame',
  nederlands: 'Gekookte jonge sojabonen met zout, bereid in de peul.',
  allergenen: ['soja'],
});
const ALLES = [RAMEN, SHOYU, TEMPURA, EDAMAME];

describe('normaliseren', () => {
  it('maakt van katakana hiragana en laat het verlengteken weg', () => {
    expect(normaliseerJapans('ラーメン')).toBe(normaliseerJapans('らーめん'));
    expect(normaliseerJapans('ラーメン')).toBe('らめん');
  });

  it('maakt halfbreed katakana gewoon', () => {
    expect(normaliseerJapans('ﾗｰﾒﾝ')).toBe('らめん');
  });

  it('vouwt romaji-varianten samen', () => {
    expect(normaliseerRomaji('rāmen')).toBe(normaliseerRomaji('ramen'));
    expect(normaliseerRomaji('Shōyu')).toBe(normaliseerRomaji('shouyu'));
    expect(normaliseerRomaji('tempura')).toBe(normaliseerRomaji('tenpura'));
    expect(normaliseerRomaji('Karaage')).toBe(normaliseerRomaji('karage'));
    expect(normaliseerRomaji('shōyu rāmen')).toBe('shoyuramen');
  });

  it('herkent Japans schrift', () => {
    expect(isJapans('ラーメン')).toBe(true);
    expect(isJapans('天ぷら')).toBe(true);
    expect(isJapans('ramen')).toBe(false);
  });
});

describe('zoeken', () => {
  it('vindt ramen op elke schrijfwijze, de exacte naam eerst', () => {
    for (const vraag of ['ラーメン', 'らーめん', 'ramen', 'rāmen', 'RAMEN']) {
      expect(zoekOpMenu(ALLES, vraag).map((i) => i.id)).toEqual(['ramen', 'shoyu-ramen']);
    }
  });

  it('vindt kanji en een deel ervan', () => {
    expect(zoekOpMenu(ALLES, '醤油').map((i) => i.id)).toEqual(['shoyu-ramen']);
    expect(zoekOpMenu(ALLES, '天ぷら').map((i) => i.id)).toEqual(['tempura']);
  });

  it('vindt tenpura en tempura allebei', () => {
    expect(zoekOpMenu(ALLES, 'tenpura').map((i) => i.id)).toEqual(['tempura']);
  });

  it('zoekt in het Nederlands op het begin van een woord', () => {
    expect(zoekOpMenu(ALLES, 'garnaal').map((i) => i.id)).toEqual(['tempura']);
    expect(zoekOpMenu(ALLES, 'soja').map((i) => i.id)).toEqual(['shoyu-ramen', 'edamame']);
    // "ei" zit in "bereid" en "heldere", maar is daar geen woord.
    expect(score(EDAMAME, 'ei')).toBeNull();
  });

  it('beperkt tot een categorie, en geeft zonder vraag alles in volgorde', () => {
    expect(zoekOpMenu(ALLES, '', 'izakaya').map((i) => i.id)).toEqual(['tempura', 'edamame']);
    expect(zoekOpMenu(ALLES, '  ')).toHaveLength(4);
  });

  it('vindt niets bij onzin', () => {
    expect(zoekOpMenu(ALLES, 'xyz')).toEqual([]);
  });
});

describe('allergenen', () => {
  it('geeft alleen jouw allergenen terug', () => {
    expect(allergenenVoorJou(TEMPURA, ['ei', 'pinda'])).toEqual(['ei']);
    expect(allergenenVoorJou(EDAMAME, [])).toEqual([]);
  });
});
