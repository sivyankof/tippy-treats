import { describe, expect, it } from 'vitest';
import { contrastRatio, mixColor } from '../util/color';
import { HUD_LAYOUT } from './hud-layout';
import { IDLE_MOTION } from './idle-motion';
import { PALETTE } from './palette';

/** Backdrops the plate may sit on: from white to black (the dark zones). */
const BACKDROPS = [0xffffff, 0xffc7a1, 0x6c5ce7, 0x1a1040, 0x000000];
const { barPlate, barDangerText } = HUD_LAYOUT;
/** The plate as it looks on a backdrop: its colour at its alpha over it. */
const plateOn = (backdrop: number): number => mixColor(backdrop, barPlate.color, barPlate.alpha);

describe('wobble bar plate', () => {
  it('and its shadow stay clear of the badge row (also with the idle sway)', () => {
    const rowHeight = Math.max(
      HUD_LAYOUT.labelFont * HUD_LAYOUT.labelLineHeight,
      HUD_LAYOUT.barHeight,
    );
    const plateBottom =
      HUD_LAYOUT.barY + rowHeight / 2 + barPlate.padY + barPlate.shadowOffset + barPlate.shadowBlur;
    const badgeTop = HUD_LAYOUT.badgeRowY - HUD_LAYOUT.badgeSize / 2 - IDLE_MOTION.badge.bobPx;
    expect(plateBottom).toBeLessThanOrEqual(badgeTop);
  });

  it('is mostly opaque so the backdrop does not eat the label', () => {
    expect(barPlate.alpha).toBeGreaterThanOrEqual(0.75);
    expect(barPlate.alpha).toBeLessThanOrEqual(0.9);
  });

  it('gives the normal label at least 4.5:1 on every backdrop', () => {
    for (const backdrop of BACKDROPS) {
      expect(contrastRatio(PALETTE.textDark, plateOn(backdrop))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('gives the danger label at least 3:1 (large text) on every backdrop, 4.5:1 on light ones', () => {
    for (const backdrop of BACKDROPS) {
      expect(contrastRatio(barDangerText, plateOn(backdrop))).toBeGreaterThanOrEqual(3);
    }
    for (const backdrop of BACKDROPS.slice(0, 2)) {
      expect(contrastRatio(barDangerText, plateOn(backdrop))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('shows why the danger fill colour is not used for the label', () => {
    expect(contrastRatio(PALETTE.danger, plateOn(0xffffff))).toBeLessThan(3);
  });
});
