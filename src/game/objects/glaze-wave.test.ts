import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../data/balance';
import { PLAIN_LAYER } from '../../data/plain-layers';
import { faceHalfSpan } from '../fx/glaze-growth';
import {
  cutStripWidth,
  glazeWave,
  tongueY,
  waveDripSpots,
  waveEdge,
  waveY,
  type GlazeWave,
} from './glaze-wave';
import { layerBox } from './layer-draw';

const H = BALANCE.layer.height;
const WIDTHS = [1, 8, 30, 60, 90, 119, 120, 161, 200, 333, 480, 719, 720];

function waveFor(width: number, cut: 'left' | 'right' | null = null): GlazeWave {
  return glazeWave(layerBox(width), cut, faceHalfSpan(width, null));
}

/** The tongues touch end to end, cover the stretch and stay within the glaze depth. */
function expectWhole(wave: GlazeWave): void {
  if (wave.tongues.length === 0) return;
  expect(wave.tongues[0]!.x0).toBeCloseTo(wave.left);
  expect(wave.tongues.at(-1)!.x1).toBeCloseTo(wave.right);
  for (let i = 1; i < wave.tongues.length; i++) {
    expect(wave.tongues[i]!.x0).toBeCloseTo(wave.tongues[i - 1]!.x1);
  }
  for (const t of wave.tongues) {
    expect(t.depth).toBeGreaterThan(0);
    expect(t.depth).toBeLessThanOrEqual(H * PLAIN_LAYER.glaze.tongueShare + 1e-9);
    expect(tongueY(t, wave.crestY, t.x0)).toBe(wave.crestY);
    expect(tongueY(t, wave.crestY, t.x1)).toBe(wave.crestY);
  }
}

describe('glazeWave', () => {
  it('fills any width with whole tongues that end on a peak', () => {
    for (const width of WIDTHS) {
      const wave = waveFor(width);
      expect(Number.isFinite(wave.crestY)).toBe(true);
      expectWhole(wave);
      const tongueW = (wave.right - wave.left) / Math.max(1, wave.tongues.length);
      if (wave.tongues.length > 1) {
        expect(tongueW).toBeGreaterThan(PLAIN_LAYER.glaze.tongueWidth * (2 / 3));
        expect(tongueW).toBeLessThan(PLAIN_LAYER.glaze.tongueWidth * 2);
      }
    }
  });

  it('a bitten edge keeps the sponge clear and ends the wave on a peak there', () => {
    for (const width of WIDTHS) {
      const box = layerBox(width);
      for (const cut of ['left', 'right'] as const) {
        const wave = waveFor(width, cut);
        expectWhole(wave);
        const strip = cutStripWidth(box);
        if (cut === 'left') expect(wave.left).toBeCloseTo(box.innerLeft + strip);
        else expect(wave.right).toBeCloseTo(box.innerRight - strip);
        // No tear: the edge meets the bitten side at the crest.
        expect(waveY(wave, cut === 'left' ? wave.left : wave.right)).toBe(wave.crestY);
      }
    }
  });

  it('counts the tongues from the intact edge, so their lengths there survive a bite', () => {
    const whole = waveFor(720);
    const bitten = waveFor(720, 'right');
    expect(bitten.tongues[0]!.depth).toBeCloseTo(whole.tongues[0]!.depth);
    const leftBitten = waveFor(720, 'left');
    expect(leftBitten.tongues.at(-1)!.depth).toBeCloseTo(whole.tongues[0]!.depth);
  });

  it('keeps the tongues in front of the face short', () => {
    const wave = waveFor(720);
    const half = faceHalfSpan(720, null);
    const longest = H * PLAIN_LAYER.glaze.tongueShare;
    for (const t of wave.tongues) {
      if (Math.abs((t.x0 + t.x1) / 2) < half) {
        expect(t.depth).toBeLessThanOrEqual(longest * PLAIN_LAYER.glaze.faceShorten + 1e-9);
      }
    }
  });

  it('draws an edge from the left to the right end with no point twice', () => {
    const wave = waveFor(480);
    const edge = waveEdge(wave);
    expect(edge[0]).toBeCloseTo(wave.left);
    expect(edge.at(-2)).toBeCloseTo(wave.right);
    for (let i = 2; i < edge.length; i += 2) expect(edge[i]!).toBeGreaterThan(edge[i - 2]!);
  });
});

describe('waveDripSpots', () => {
  it('lets each drip grow from the lowest point of its own tongue', () => {
    const wave = waveFor(720);
    const spots = waveDripSpots(wave, 3, 14);
    expect(spots).toHaveLength(3);
    expect(new Set(spots.map((s) => s.x)).size).toBe(3);
    for (const spot of spots) {
      expect(spot.tipY).toBeCloseTo(waveY(wave, spot.x));
      expect(spot.rootY).toBeLessThanOrEqual(spot.tipY);
      expect(spot.rootY).toBeGreaterThanOrEqual(wave.crestY);
    }
  });

  it('keeps every drip off the face and fills the count with pairs on the outer tongues', () => {
    const wave = waveFor(720);
    const clear = 90;
    const spots = waveDripSpots(wave, 5, 14, clear);
    expect(spots).toHaveLength(5);
    for (const spot of spots) {
      expect(Math.abs(spot.x)).toBeGreaterThanOrEqual(clear);
      expect(spot.tipY).toBeCloseTo(waveY(wave, spot.x));
    }
    for (let i = 1; i < spots.length; i++) expect(spots[i]!.x).toBeGreaterThan(spots[i - 1]!.x);
  });

  it('gives a narrow layer only the drips that fit beside its face', () => {
    const wave = waveFor(300);
    const spots = waveDripSpots(wave, 3, 14, 90);
    expect(spots.length).toBeLessThanOrEqual(3);
    for (const spot of spots) expect(Math.abs(spot.x)).toBeGreaterThanOrEqual(90);
  });
});
