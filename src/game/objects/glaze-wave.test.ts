import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../data/balance';
import { PLAIN_LAYER } from '../../data/plain-layers';
import { dripCountFor, faceClearance, faceHalfSpan } from '../fx/glaze-growth';
import {
  cutStripWidth,
  dripLayouts,
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

const SEEDS = [1, 2, 3, 7, 42, 99, 1234, 98765];
const LAYERS = 120;

function clearFor(width: number): number {
  return faceClearance(width, null, 14);
}

describe('dripLayouts', () => {
  it('keeps every drip off the face, on a tongue, with one on each side', () => {
    for (const width of [720, 600, 450, 333]) {
      const wave = waveFor(width);
      const clear = clearFor(width);
      const layouts = dripLayouts(wave, dripCountFor(width), clear);
      expect(layouts.length).toBeGreaterThanOrEqual(2);
      for (const layout of layouts) {
        expect(layout.length).toBeLessThanOrEqual(dripCountFor(width));
        for (const x of layout) expect(Math.abs(x)).toBeGreaterThanOrEqual(clear);
        for (let i = 1; i < layout.length; i++) expect(layout[i]!).toBeGreaterThan(layout[i - 1]!);
        if (layout.length > 1) {
          expect(layout.some((x) => x < 0)).toBe(true);
          expect(layout.some((x) => x > 0)).toBe(true);
        }
      }
    }
  });

  it('grows 3 to 5 drips on a wide layer, in different counts and with split tongues', () => {
    const wave = waveFor(720);
    const layouts = dripLayouts(wave, dripCountFor(720), clearFor(720));
    const counts = new Set(layouts.map((l) => l.length));
    expect([...counts].sort()).toEqual([3, 4, 5]);
    const step = wave.tongues[0]!.x1 - wave.tongues[0]!.x0;
    // Some layouts put two drips on one tongue.
    expect(layouts.some((l) => l.some((x, i) => i > 0 && x - l[i - 1]! < step * 0.5))).toBe(true);
  });

  it('lets fewer drips in on a narrow layer so it still has two layouts', () => {
    const layouts = dripLayouts(waveFor(300), dripCountFor(300), clearFor(300));
    expect(layouts.length).toBeGreaterThanOrEqual(2);
  });
});

describe('waveDripSpots', () => {
  it('grows each drip from the edge of its own tongue', () => {
    const wave = waveFor(720);
    const spots = waveDripSpots(wave, 5, 14, clearFor(720), 3, 5);
    expect(spots.length).toBeGreaterThanOrEqual(3);
    for (const spot of spots) {
      expect(spot.tipY).toBeCloseTo(waveY(wave, spot.x));
      expect(spot.rootY).toBeGreaterThanOrEqual(wave.crestY);
      expect(spot.rootY).toBeLessThanOrEqual(wave.crestY + H * PLAIN_LAYER.glaze.tongueShare);
    }
  });

  it('is the same for the same seed and layer', () => {
    const wave = waveFor(600);
    const a = waveDripSpots(wave, 4, 14, clearFor(600), 42, 17);
    const b = waveDripSpots(wave, 4, 14, clearFor(600), 42, 17);
    expect(a).toEqual(b);
  });

  it('never gives two neighbouring layers of one width the same layout', () => {
    for (const width of [720, 600, 450, 333, 300]) {
      for (const cut of [null, 'left', 'right'] as const) {
        const wave = waveFor(width, cut);
        const clear = clearFor(width);
        if (dripLayouts(wave, dripCountFor(width), clear).length < 2) continue;
        for (const seed of SEEDS) {
          let before = '';
          for (let layer = 1; layer <= LAYERS; layer++) {
            const xs = waveDripSpots(wave, dripCountFor(width), 14, clear, seed, layer)
              .map((spot) => spot.x.toFixed(2))
              .join(',');
            expect(xs).not.toBe(before);
            before = xs;
          }
        }
      }
    }
  });

  it('varies the count and the places of the drips from layer to layer', () => {
    const wave = waveFor(720);
    const seen = new Set<string>();
    const counts = new Set<number>();
    for (let layer = 1; layer <= 40; layer++) {
      const spots = waveDripSpots(wave, 5, 14, clearFor(720), 7, layer);
      seen.add(spots.map((s) => s.x.toFixed(2)).join(','));
      counts.add(spots.length);
    }
    expect(seen.size).toBeGreaterThan(15);
    expect(counts.size).toBeGreaterThan(1);
  });
});
