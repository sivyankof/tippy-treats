import { describe, expect, it } from 'vitest';
import { ANIM } from '../data/anim';
import { BALANCE } from '../data/balance';
import { HUD_LAYOUT } from '../data/hud-layout';
import { FLYING_REACH, targetScrollY, trayScrollY } from './camera-layout';

const SCREEN_H = 2337;

describe('camera layout', () => {
  it('shows the tray low on the screen', () => {
    expect(trayScrollY(0, SCREEN_H)).toBe(-(SCREEN_H - ANIM.camera.trayBottomOffset));
  });

  it('keeps the tray view while the tower is short', () => {
    expect(targetScrollY(0, SCREEN_H, -BALANCE.layer.height)).toBe(trayScrollY(0, SCREEN_H));
  });

  it('follows a tall tower and keeps the flying row below the HUD', () => {
    const towerTopY = -100 * BALANCE.layer.height;
    const scroll = targetScrollY(0, SCREEN_H, towerTopY);
    const surfaceOnScreen = towerTopY - scroll;
    expect(surfaceOnScreen - FLYING_REACH).toBeGreaterThanOrEqual(
      HUD_LAYOUT.bottomEdge + ANIM.camera.hudClearance - 1e-9,
    );
    expect(surfaceOnScreen).toBeGreaterThanOrEqual(
      SCREEN_H - ANIM.camera.visibleLayers * BALANCE.layer.height,
    );
  });
});
