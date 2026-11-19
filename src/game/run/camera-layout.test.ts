import { describe, expect, it } from 'vitest';
import { ANIM } from '../../data/common/anim';
import { BALANCE } from '../../data/tower/balance';
import { HUD_LAYOUT } from '../../data/run/hud-layout';
import { FLIGHT_CLEAR } from '../../data/backdrop/flight-clear';
import {
  FLYING_REACH,
  hudKeepOutFade,
  flightClearBand,
  surfaceScreenY,
  targetScrollY,
  travellerClearBand,
  trayScrollY,
} from './camera-layout';

const SCREEN_H = 2337;

describe('camera layout', () => {
  it('shows the tray low on the screen', () => {
    expect(trayScrollY(0, SCREEN_H)).toBe(-(SCREEN_H - ANIM.camera.trayBottomOffset));
  });

  it('keeps the tray view while the tower is short', () => {
    expect(targetScrollY(0, SCREEN_H, -BALANCE.layer.height)).toBe(trayScrollY(0, SCREEN_H));
  });

  it('keeps a gap under the counter chips of the badge row', () => {
    expect(HUD_LAYOUT.badgeRowBottom).toBeGreaterThan(HUD_LAYOUT.bottomEdge);
    expect(ANIM.camera.hudClearance).toBeGreaterThanOrEqual(8);
  });

  it('follows a tall tower and keeps the flying row below the HUD', () => {
    const towerTopY = -100 * BALANCE.layer.height;
    const scroll = targetScrollY(0, SCREEN_H, towerTopY);
    const surfaceOnScreen = towerTopY - scroll;
    expect(surfaceOnScreen - FLYING_REACH).toBeGreaterThanOrEqual(
      HUD_LAYOUT.badgeRowBottom + ANIM.camera.hudClearance - 1e-9,
    );
    expect(surfaceOnScreen).toBeGreaterThanOrEqual(
      SCREEN_H - ANIM.camera.visibleLayers * BALANCE.layer.height,
    );
  });
});

describe('travellerClearBand', () => {
  it('starts where the flight stripe starts and reaches below the top of the tower', () => {
    for (const screenH of [1919, 2337, 2520]) {
      const flight = flightClearBand(screenH);
      const band = travellerClearBand(screenH);
      expect(band.top).toBe(flight.top);
      expect(band.bottom).toBeGreaterThanOrEqual(flight.bottom);
      expect(band.bottom).toBe(surfaceScreenY(screenH) + FLIGHT_CLEAR.travellerBelowTopPx);
      expect(band.ceiling).toBe(HUD_LAYOUT.badgeRowBottom + FLIGHT_CLEAR.hudGapPx);
    }
  });
});

describe('hudKeepOutFade', () => {
  it('is 0 inside a plate and in the gap around it, 1 far from every plate', () => {
    expect(hudKeepOutFade(540, 120)).toBe(0);
    expect(hudKeepOutFade(70, 70)).toBe(0);
    expect(hudKeepOutFade(70, 120 + FLIGHT_CLEAR.hudGapPx - 1)).toBe(0);
    expect(hudKeepOutFade(100, 900)).toBe(1);
  });

  it('ramps up over the feather outside the gap', () => {
    const edge = 120 + FLIGHT_CLEAR.hudGapPx;
    expect(hudKeepOutFade(70, edge + 15, 0, 30)).toBeCloseTo(0.5);
  });
});
