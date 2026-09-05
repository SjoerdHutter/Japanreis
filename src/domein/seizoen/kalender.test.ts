import { describe, expect, it } from 'vitest';
import type { Regio, Weerwaarschuwing } from '@/domein/schema';
import {
  alsDagnummer,
  alsDatumtekst,
  binnenPeriode,
  bloeiStand,
  dagnummerVan,
  geldendeWaarschuwingen,
  regioVoorStad,
  verschuif,
} from './kalender';

describe('dagnummers', () => {
  it('maakt van MM-DD een vergelijkbaar getal', () => {
    expect(alsDagnummer('03-24')).toBe(324);
    expect(alsDagnummer('11-28')).toBe(1128);
  });

  it('leest de dag uit een moment', () => {
    expect(dagnummerVan(new Date('2026-04-05T12:00:00Z'))).toBe(405);
  });
});

describe('binnenPeriode', () => {
  it('herkent een dag binnen een gewone periode', () => {
    expect(binnenPeriode(alsDagnummer('08-15'), '08-01', '10-15')).toBe(true);
    expect(binnenPeriode(alsDagnummer('11-01'), '08-01', '10-15')).toBe(false);
  });

  it('rekent de randen mee', () => {
    expect(binnenPeriode(alsDagnummer('08-01'), '08-01', '10-15')).toBe(true);
    expect(binnenPeriode(alsDagnummer('10-15'), '08-01', '10-15')).toBe(true);
  });

  it('kan overweg met een periode over de jaarwisseling heen', () => {
    // Zit niet in deze content, maar de logica mag er niet op stukgaan.
    expect(binnenPeriode(alsDagnummer('01-10'), '12-01', '02-15')).toBe(true);
    expect(binnenPeriode(alsDagnummer('12-20'), '12-01', '02-15')).toBe(true);
    expect(binnenPeriode(alsDagnummer('06-01'), '12-01', '02-15')).toBe(false);
  });
});

describe('verschuif', () => {
  it('telt dagen op binnen een maand', () => {
    expect(verschuif('03-24', 10)).toBe('04-03');
  });

  it('telt dagen af over een maandgrens', () => {
    expect(verschuif('03-24', -14)).toBe('03-10');
    expect(verschuif('03-05', -14)).toBe('02-20');
  });

  it('laat 29 februari staan, want er wordt met een schrikkeljaar gerekend', () => {
    expect(verschuif('02-28', 1)).toBe('02-29');
  });
});

describe('geldendeWaarschuwingen', () => {
  const waarschuwingen: Weerwaarschuwing[] = [
    { id: 'tyfoon', naam: 'Tyfoon', land: 'japan', vanaf: '08-01', tot: '10-15', wat: 'x' },
    { id: 'hitte', naam: 'Hitte', land: 'japan', vanaf: '07-01', tot: '09-10', wat: 'x' },
    { id: 'moesson', naam: 'Moesson', land: 'vietnam', vanaf: '05-01', tot: '09-30', wat: 'x' },
  ];

  it('geeft alleen wat nu geldt in dat land', () => {
    const eindAugustus = new Date('2026-08-25T12:00:00Z');
    expect(geldendeWaarschuwingen(waarschuwingen, 'japan', eindAugustus).map((w) => w.id)).toEqual([
      'tyfoon',
      'hitte',
    ]);
    expect(
      geldendeWaarschuwingen(waarschuwingen, 'vietnam', eindAugustus).map((w) => w.id),
    ).toEqual(['moesson']);
  });

  it('zwijgt buiten het seizoen', () => {
    expect(
      geldendeWaarschuwingen(waarschuwingen, 'japan', new Date('2026-02-01T12:00:00Z')),
    ).toEqual([]);
  });
});

describe('bloeiStand', () => {
  const kansai = { begintTypisch: '03-26', hoogtepuntTypisch: '04-02', duurDagen: 10 };

  it('zegt nu tijdens de bloei', () => {
    expect(bloeiStand(kansai, new Date('2026-03-30T12:00:00Z'))).toBe('nu');
    expect(bloeiStand(kansai, new Date('2026-03-26T12:00:00Z'))).toBe('nu');
  });

  it('zegt binnenkort in de twee weken ervoor, want dan kun je nog schuiven', () => {
    expect(bloeiStand(kansai, new Date('2026-03-15T12:00:00Z'))).toBe('binnenkort');
  });

  it('zegt voorbij als het geweest is', () => {
    expect(bloeiStand(kansai, new Date('2026-05-01T12:00:00Z'))).toBe('voorbij');
  });

  it('zegt ruim voor als het nog maanden duurt', () => {
    expect(bloeiStand(kansai, new Date('2026-01-10T12:00:00Z'))).toBe('ruim-voor');
  });
});

describe('regioVoorStad', () => {
  const regios: Regio[] = [
    { id: 'kanto', naam: 'Kanto', steden: ['tokio', 'hakone'] },
    { id: 'kansai', naam: 'Kansai', steden: ['kyoto', 'osaka', 'nara'] },
  ];

  it('vindt de regio van een stad', () => {
    expect(regioVoorStad(regios, 'nara')?.id).toBe('kansai');
    expect(regioVoorStad(regios, 'hakone')?.id).toBe('kanto');
  });

  it('geeft niets terug voor een stad die nergens in staat', () => {
    expect(regioVoorStad(regios, 'hanoi')).toBeUndefined();
  });
});

describe('alsDatumtekst', () => {
  it('schrijft een datum uit', () => {
    expect(alsDatumtekst('03-24')).toBe('24 maart');
    expect(alsDatumtekst('11-01')).toBe('1 november');
  });
});
