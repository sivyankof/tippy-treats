import { describe, expect, it } from 'vitest';
import { TUTORIAL_ANIM } from '../../data/tutorial/tutorial-anim';
import { pickPlateY, type SpotInput, type SpotRect } from './hint-spot';

const { gap, screenMargin } = TUTORIAL_ANIM.hintSpot;
const SCREEN_W = 1080;
const HUD = 546;
const PLATE_W = 700;
const PLATE_H = 200;

function rect(left: number, top: number, right: number, bottom: number): SpotRect {
  return { left, top, right, bottom };
}

/** A screen `screenHeight` tall whose tower top sits at `towerTop`; the flying row reaches 400 above it. */
function scene(screenHeight: number, towerTop: number, shadow: SpotRect | null = null): SpotInput {
  return {
    screenHeight,
    hudBottom: HUD,
    plateWidth: PLATE_W,
    plateHeight: PLATE_H,
    centerX: SCREEN_W / 2,
    topLayer: rect(180, towerTop, 900, towerTop + 120),
    flightRow: rect(0, towerTop - 400, SCREEN_W, towerTop),
    shadow,
  };
}

function plate(input: SpotInput, centerY: number): SpotRect {
  const half = input.plateWidth / 2;
  return rect(
    input.centerX - half,
    centerY - input.plateHeight / 2,
    input.centerX + half,
    centerY + input.plateHeight / 2,
  );
}

function overlaps(a: SpotRect, b: SpotRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

describe('pickPlateY', () => {
  it('goes right under the HUD when the tower is low and there is room above the flying row', () => {
    const input = scene(1800, 1300);
    expect(pickPlateY(input)).toBe(HUD + gap + PLATE_H / 2);
  });

  it('goes under the top layer when the flying row leaves no room under the HUD', () => {
    const input = scene(1800, 1000);
    expect(pickPlateY(input)).toBe(1000 + 120 + gap + PLATE_H / 2);
  });

  it('never overlaps the top layer, the flying row or the shadow', () => {
    for (const screenHeight of [1500, 1800, 2340]) {
      for (let towerTop = 900; towerTop <= screenHeight - 400; towerTop += 50) {
        const shadow = rect(300, towerTop, 780, towerTop + 50);
        for (const sh of [null, shadow]) {
          const input = scene(screenHeight, towerTop, sh);
          const box = plate(input, pickPlateY(input));
          if (box.bottom > screenHeight - screenMargin) continue;
          expect(overlaps(box, input.topLayer)).toBe(false);
          expect(overlaps(box, input.flightRow)).toBe(false);
          if (sh) expect(overlaps(box, sh)).toBe(false);
        }
      }
    }
  });

  it('presses the plate to the bottom when no zone is free', () => {
    const input = scene(1500, 1200);
    expect(pickPlateY(input)).toBe(1500 - screenMargin - PLATE_H / 2);
  });

  it('may sit beside a narrow top layer only if it clears it horizontally', () => {
    const input = scene(1800, 1000);
    input.plateWidth = 200;
    input.topLayer = rect(0, 1000, 100, 1120);
    input.flightRow = rect(0, 600, 100, 1000);
    expect(pickPlateY(input)).toBe(HUD + gap + PLATE_H / 2);
  });
});
