import { describe, expect, it } from 'vitest';
import { ANIM } from '../../../data/common/anim';
import { HUD_LAYOUT } from '../../../data/run/hud-layout';
import { flightClearBand } from '../../camera-layout';
import { hudPlateRects, tempoCaptionLook, tempoCaptionSpot } from './tempo-caption';

const { inMs, holdMs, outMs } = ANIM.tempoChip.caption;
const total = inMs + holdMs + outMs;

describe('tempoCaptionLook', () => {
  it('fades in, holds, fades out and ends', () => {
    expect(tempoCaptionLook(0, 'full')?.alpha).toBe(0);
    expect(tempoCaptionLook(inMs, 'full')).toEqual({ alpha: 1, lift: 0 });
    expect(tempoCaptionLook(inMs + holdMs / 2, 'lite')?.alpha).toBe(1);
    expect(tempoCaptionLook(total - 1, 'full')?.alpha).toBeLessThan(0.1);
    expect(tempoCaptionLook(total, 'full')).toBeNull();
    expect(tempoCaptionLook(-1, 'full')).toBeNull();
  });

  it('lifts only on full effects', () => {
    expect(tempoCaptionLook(inMs / 2, 'full')?.lift).toBeGreaterThan(0);
    expect(tempoCaptionLook(inMs / 2, 'lite')?.lift).toBe(0);
  });

  it('shows and hides at once on minimal', () => {
    expect(tempoCaptionLook(0, 'minimal')).toEqual({ alpha: 1, lift: 0 });
    expect(tempoCaptionLook(inMs + holdMs, 'minimal')).toBeNull();
  });
});

describe('tempoCaptionSpot', () => {
  const chip = HUD_LAYOUT.tempoChip;
  const base = {
    textWidth: 200,
    textHeight: 50,
    screenWidth: 1080,
    chipRight: 1050,
    chipTop: 312,
    obstacles: hudPlateRects(),
  };

  it('stands right-aligned above the chip and clear of the HUD plates', () => {
    const spot = tempoCaptionSpot(base);
    expect(spot).not.toBeNull();
    expect(spot?.right).toBe(1050);
    expect(spot?.bottom).toBe(312 - chip.captionGap);
  });

  it('keeps the screen margin on the right', () => {
    expect(tempoCaptionSpot({ ...base, chipRight: 1075 })?.right).toBe(1080 - chip.margin);
  });

  it('stays hidden when an obstacle is in the way', () => {
    const wall = { left: 900, top: 0, right: 1080, bottom: 400 };
    expect(tempoCaptionSpot({ ...base, obstacles: [wall] })).toBeNull();
  });

  it('stays hidden when it does not fit on screen', () => {
    expect(tempoCaptionSpot({ ...base, textWidth: 1100 })).toBeNull();
    expect(tempoCaptionSpot({ ...base, chipTop: 40 })).toBeNull();
  });

  it('clears the flight row on the tall and the short screen', () => {
    for (const h of [2337, 1920]) {
      const band = flightClearBand(h);
      const spot = tempoCaptionSpot({
        ...base,
        obstacles: [
          ...hudPlateRects(),
          { left: 0, top: band.top, right: 1080, bottom: band.bottom },
        ],
      });
      expect(spot).not.toBeNull();
    }
  });
});
