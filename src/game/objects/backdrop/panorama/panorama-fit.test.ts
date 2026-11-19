import { describe, expect, it } from 'vitest';
import { PANORAMA } from '../../../../data/weather/window-look';
import { hudFloor } from '../../../camera-layout';
import { BALANCE } from '../../../../data/tower/balance';
import {
  coverFade,
  flightRowAt,
  boltShare,
  moonAlpha,
  muteShare,
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
    const a = flightRowAt({ top: 0, bottom: 0, towerTop: 0 }, 2037, 2);
    const b = flightRowAt({ top: 0, bottom: 0, towerTop: 0 }, 2037, 3);
    expect(b.top).toBeLessThan(a.top);
    expect(a.bottom).toBeGreaterThan(a.top);
    expect(a.bottom - a.top).toBeGreaterThanOrEqual(BALANCE.layer.height);
  });
});

describe('rowMute', () => {
  const row = { top: 800, bottom: 950 };
  it('is full where the window overlaps the row, 1 well clear of it', () => {
    expect(rowMute(900, 300, row, 24)).toBeCloseTo(PANORAMA.rowMuted);
    expect(rowMute(2000, 300, row, 24)).toBe(1);
  });
  it('rises over the feather', () => {
    const mid = rowMute(950 + 300 + 12, 300, row, 24);
    expect(mid).toBeGreaterThan(PANORAMA.rowMuted);
    expect(mid).toBeLessThan(1);
  });
});

describe('coverFade', () => {
  const halfH = 320;
  it('is 1 while the window stands well above the tower and 0 once only a cap shows', () => {
    expect(coverFade(500, halfH, 1000)).toBe(1);
    expect(coverFade(500, halfH, 180 + 0.2 * 2 * halfH)).toBe(0);
    expect(coverFade(500, halfH, 0)).toBe(0);
  });
  it('is gone before the tower top reaches the middle of the glass', () => {
    const G = PANORAMA.glass;
    const top = 500 - halfH;
    const glassMiddle = top + (G.y + G.h / 2) * (halfH / (PANORAMA.height / 2));
    expect(coverFade(500, halfH, glassMiddle)).toBe(0);
    expect(coverFade(500, halfH, glassMiddle - 10)).toBe(0);
  });
  it('is whole while the tower stands below the sill', () => {
    const sillTop = 500 - halfH + PANORAMA.glass.y + PANORAMA.glass.h + PANORAMA.sill.gap;
    expect(coverFade(500, halfH, sillTop)).toBe(1);
  });
  it('falls smoothly between', () => {
    const a = coverFade(500, halfH, 180 + 0.7 * 2 * halfH);
    const b = coverFade(500, halfH, 180 + 0.6 * 2 * halfH);
    expect(a).toBeGreaterThan(b);
    expect(a).toBeLessThan(1);
    expect(b).toBeGreaterThan(0);
  });
});

describe('the start view on a short screen', () => {
  it('keeps the window clear of the highest point of the flying layer', () => {
    const fit = panoramaFit(W, H_SHORT);
    expect(fit).not.toBeNull();
    const bottom = (fit?.y ?? 0) + (PANORAMA.height * (fit?.scale ?? 1)) / 2;
    expect(startViewFlightTop(H_SHORT) - bottom).toBeGreaterThanOrEqual(
      PANORAMA.layout.flightGapPx,
    );
  });
});

describe('muteShare', () => {
  it('is 0 clear of the row and 1 at the full mute', () => {
    expect(muteShare(1)).toBe(0);
    expect(muteShare(PANORAMA.rowMuted)).toBeCloseTo(1);
  });
});

describe('moonAlpha', () => {
  it('is whole with a whole, clear window', () => {
    expect(moonAlpha(1, 0)).toBe(1);
  });
  it('leaves before the window: gone while the window still shows', () => {
    expect(moonAlpha(PANORAMA.moon.goneAt, 0)).toBe(0);
    for (const a of [0.7, 0.8, 0.9]) expect(moonAlpha(a, 0)).toBeLessThan(a);
  });
  it('takes the mute: mutedAlpha of its alpha at the full mute', () => {
    expect(moonAlpha(1, 1)).toBeCloseTo(PANORAMA.moon.mutedAlpha);
    expect(moonAlpha(1, 0.5)).toBeLessThan(1);
  });
});

describe('boltShare', () => {
  const { riseAt, fallAt } = PANORAMA.flash.bolt;
  it('is whole at the peak of the flash and gone on the fall while the light still shows', () => {
    expect(boltShare(1, false)).toBe(1);
    expect(boltShare(fallAt - 0.01, false)).toBe(0);
    expect(fallAt).toBeGreaterThan(riseAt);
  });
  it('is never half see-through on the fall', () => {
    for (let s = 0; s <= 1; s += 0.05) expect([0, 1]).toContain(boltShare(s, false));
  });
  it('is never half see-through on the rise: nothing over an unlit glass, then whole', () => {
    expect(boltShare(riseAt / 2, true)).toBe(0);
    for (const s of [riseAt, 0.5, 0.8, 0.9]) expect(boltShare(s, true)).toBe(1);
  });
});
