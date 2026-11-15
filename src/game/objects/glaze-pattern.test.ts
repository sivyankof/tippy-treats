import { describe, expect, it } from 'vitest';
import { PATTERN_KINDS, PLAIN_LAYER, type PatternKind } from '../../data/plain-layers';
import { faceHalfSpan } from '../fx/glaze-growth';
import { glazePattern, patternColor, type GlazePattern } from './glaze-pattern';
import { glazeWave, waveY } from './glaze-wave';
import { layerBox } from './layer-draw';

const P = PLAIN_LAYER.pattern;
const WIDTHS = [120, 200, 333, 480, 720];

function points(p: GlazePattern): [number, number][] {
  const out: [number, number][] = [];
  for (const line of p.lines) {
    for (let i = 0; i < line.length; i += 2) out.push([line[i]!, line[i + 1]!]);
  }
  for (const d of p.dots) out.push([d.x, d.y]);
  return out;
}

function make(kind: PatternKind, width: number, cut: 'left' | 'right' | null, face = true) {
  const box = layerBox(width);
  const half = face ? faceHalfSpan(width, null) : null;
  const wave = glazeWave(box, cut, half);
  return { box, half, wave, pattern: glazePattern(kind, box, cut, half, wave) };
}

describe('glazePattern', () => {
  it('has something to draw on a wide layer, for every kind', () => {
    for (const kind of PATTERN_KINDS) {
      expect(points(make(kind, 720, null).pattern).length).toBeGreaterThan(10);
    }
  });

  it('stays in the glaze: above the wavy edge, off the face, the cut strip and the top', () => {
    for (const kind of PATTERN_KINDS) {
      for (const width of WIDTHS) {
        for (const cut of [null, 'left', 'right'] as const) {
          const { box, half, wave, pattern } = make(kind, width, cut);
          for (const [x, y] of points(pattern)) {
            expect(y).toBeLessThanOrEqual(waveY(wave, x) - P.edgeGap + 1e-9);
            expect(y).toBeGreaterThanOrEqual(box.innerTop + P.topGap - 1e-9);
            expect(Math.abs(x)).toBeGreaterThanOrEqual(half! + P.faceMargin - 1e-9);
            expect(x).toBeGreaterThanOrEqual(wave.left + P.sideGap - 1e-9);
            expect(x).toBeLessThanOrEqual(wave.right - P.sideGap + 1e-9);
          }
        }
      }
    }
  });

  it('counts from the uncut edge: the drizzle there is the same after a bite', () => {
    // The tongues are renumbered by a bite, so only the drizzle (above every tongue) is compared.
    const whole = points(make('zigzag', 480, null).pattern);
    const bitten = make('zigzag', 480, 'right');
    const key = (p: [number, number]): string => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
    const set = new Set(whole.map(key));
    const near = points(bitten.pattern).filter(([x]) => x < bitten.wave.right - 60);
    expect(near.length).toBeGreaterThan(0);
    for (const p of near) expect(set.has(key(p))).toBe(true);
  });

  it('fills a faceless piece to the middle', () => {
    for (const kind of PATTERN_KINDS) {
      const xs = points(make(kind, 480, null, false).pattern).map(([x]) => x);
      expect(xs.some((x) => Math.abs(x) < 10)).toBe(true);
    }
  });

  it('leaves a very narrow layer bare', () => {
    for (const kind of PATTERN_KINDS) expect(points(make(kind, 20, null).pattern)).toEqual([]);
  });
});

describe('patternColor', () => {
  it('is white for the drizzle, and darker than the glaze when the glaze is very light', () => {
    expect(patternColor(0xffaecb, 'zigzag')).toBe(0xffffff);
    expect(patternColor(0xfff4e4, 'zigzag')).not.toBe(0xffffff);
    expect(patternColor(0xffaecb, 'lattice')).not.toBe(0xffaecb);
  });
});
