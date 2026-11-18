import { describe, expect, it } from 'vitest';
import { PANORAMA } from '../../../data/window-look';
import { hudFloor } from '../../camera-layout';
import { BALANCE } from '../../../data/balance';
import {
  flightRowAt,
  panoramaFit,
  panoramaFitCached,
  rowMute,
  startViewFlightTop,
} from './panorama-fit';

const W = 1080;
const H_TALL = 2337;
const H_SHORT = 1919;

describe('panoramaFit', () => {
  it('stands at full size on 390x844, 25-30% of the height and about 60% of the width', () => {
    const fit = panoramaFit(W, H_TALL);
    expect(fit?.scale).toBe(1);
    const height = PANORAMA.height / H_TALL;
    expect(height).toBeGreaterThan(0.25);
    expect(height).toBeLessThan(0.3);
    expect(PANORAMA.width / W).toBeGreaterThan(0.55);
    expect(PANORAMA.width / W).toBeLessThanOrEqual(0.6);
  });

  it('keeps 40 px from the HUD plates and clear of the flying layer', () => {
    for (const h of [H_TALL, H_SHORT, 2100]) {
      const fit = panoramaFit(W, h);
      if (!fit) continue;
      const half = (PANORAMA.height * fit.scale) / 2;
      expect(fit.y - half).toBeGreaterThanOrEqual(hudFloor() - 0.001);
      expect(fit.y + half).toBeLessThan(startViewFlightTop(h));
    }
  });

  it('is lower and narrower on 390x693 and still fits', () => {
    const tall = panoramaFit(W, H_TALL);
    const short = panoramaFit(W, H_SHORT);
    expect(short).not.toBeNull();
    expect(short?.scale).toBeLessThan(tall?.scale ?? 0);
    expect(short?.y).toBeGreaterThan(0);
  });

  it('gives up (the small window stays) when the room is too small', () => {
    expect(panoramaFit(W, 1500)).toBeNull();
  });

  it('caches the last size', () => {
    expect(panoramaFitCached(W, H_TALL)).toBe(panoramaFitCached(W, H_TALL));
  });
});

describe('flightRowAt', () => {
  it('stands higher the more layers are placed and has the height of the layer plus its bob', () => {
    const a = flightRowAt({ top: 0, bottom: 0 }, 2037, 2);
    const b = flightRowAt({ top: 0, bottom: 0 }, 2037, 3);
    expect(b.top).toBeLessThan(a.top);
    expect(a.bottom).toBeGreaterThan(a.top);
    expect(a.bottom - a.top).toBeGreaterThanOrEqual(BALANCE.layer.height);
  });
});

describe('rowMute', () => {
  const row = { top: 800, bottom: 950 };
  it('is full where the window overlaps the row, 1 well clear of it', () => {
    expect(rowMute(900, 300, row, 80)).toBeCloseTo(PANORAMA.rowMuted);
    expect(rowMute(2000, 300, row, 80)).toBe(1);
  });
  it('rises over the feather', () => {
    const mid = rowMute(950 + 300 + 40, 300, row, 80);
    expect(mid).toBeGreaterThan(PANORAMA.rowMuted);
    expect(mid).toBeLessThan(1);
  });
});
