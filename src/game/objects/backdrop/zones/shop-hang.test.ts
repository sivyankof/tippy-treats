import { describe, expect, it } from 'vitest';
import { FLIGHT_CLEAR } from '../../../../data/backdrop/flight-clear';
import { HUD_LAYOUT } from '../../../../data/run/hud-layout';
import { SHOP_LOOK } from '../../../../data/weather/window-look';
import { hangAlpha, hangBottom, hangFadeEnd, hangRestDown } from './shop-hang';

const WIDTH = 1080;
const { awning, lamp } = SHOP_LOOK;

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** The awning and the lamps (a swing leans a lamp sideways by at most its height times the sine of the angle) on the start view. */
function parts(): Box[] {
  const lean = lamp.height * lamp.scale * Math.sin((lamp.swingDeg * Math.PI) / 180);
  const half = (lamp.width * lamp.scale) / 2 + lean;
  const top = awning.height - lamp.tuckPx;
  return [
    { x0: 0, x1: WIDTH, y0: 0, y1: awning.height + awning.bobPx },
    ...lamp.items.map((item) => ({
      x0: item.x * WIDTH - half,
      x1: item.x * WIDTH + half,
      y0: top + item.drop,
      y1: top + item.drop + lamp.height * lamp.scale,
    })),
  ];
}

const overlaps = (box: Box, down: number, p: (typeof HUD_LAYOUT.plates)[number]): boolean => {
  const g = FLIGHT_CLEAR.hudGapPx;
  return (
    box.x1 > p.x - g &&
    box.x0 < p.x + p.width + g &&
    box.y1 + down > p.y - g &&
    box.y0 + down < p.y + p.height + g
  );
};

describe('shop awning and lamps fade', () => {
  it('stand fully on the start view and are gone before the wobble plate', () => {
    expect(hangAlpha(0)).toBe(1);
    expect(hangAlpha(hangRestDown())).toBe(1);
    expect(hangFadeEnd()).toBeGreaterThan(hangRestDown());
    expect(hangAlpha(hangFadeEnd())).toBe(0);
    expect(hangBottom() + hangFadeEnd()).toBe(HUD_LAYOUT.wobblePlate.y - SHOP_LOOK.hang.clearPx);
  });

  it('only fall as the wall moves down', () => {
    let last = 1;
    for (let down = 0; down <= 600; down++) {
      const a = hangAlpha(down);
      expect(a).toBeLessThanOrEqual(last);
      last = a;
    }
  });

  it('are invisible whenever a part is within the HUD gap of a plate it did not touch on the start view', () => {
    // The top plates (pause, score) lie under the start awning by design; every other plate must stay clear.
    const touchedAtStart = new Set<string>();
    parts().forEach((box, b) => {
      HUD_LAYOUT.plates.forEach((p, i) => {
        if (overlaps(box, hangRestDown(), p)) touchedAtStart.add(`${b}:${i}`);
      });
    });
    for (let down = hangRestDown() + 1; down <= 1200; down++) {
      parts().forEach((box, b) => {
        HUD_LAYOUT.plates.forEach((p, i) => {
          if (touchedAtStart.has(`${b}:${i}`)) return;
          if (overlaps(box, down, p)) expect(hangAlpha(down), `down ${down}, plate ${i}`).toBe(0);
        });
      });
    }
  });

  it('never reach the wobble plate while visible, on any part', () => {
    const plate = HUD_LAYOUT.wobblePlate;
    for (let down = 0; down <= 1200; down++) {
      if (hangAlpha(down) === 0) continue;
      for (const box of parts()) {
        expect(box.y1 + down).toBeLessThanOrEqual(plate.y - FLIGHT_CLEAR.hudGapPx);
      }
    }
  });
});
