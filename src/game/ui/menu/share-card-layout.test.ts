import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../../data/balance';
import type { SnapshotLayer } from '../../objects/tower-snapshot';
import { fitTower } from './share-card-layout';

const layer = (x: number, width = 600): SnapshotLayer => ({ kind: 'plain', x, width });
const room = { width: 940, height: 800, maxScale: 10, bottom: 1000 };

describe('fitTower', () => {
  it('stands a short tower in the middle of the room and a tall one on its floor', () => {
    const short = fitTower([layer(540)], { ...room, maxScale: 1 });
    const spare = room.height - BALANCE.layer.height;
    expect(short.trayY).toBeCloseTo(room.bottom - spare / 2);
    const tall = fitTower(
      Array.from({ length: 100 }, () => layer(540)),
      room,
    );
    expect(tall.trayY).toBeCloseTo(room.bottom);
  });

  it('does not enlarge a short tower beyond the maximum scale', () => {
    expect(fitTower([layer(540)], { ...room, maxScale: 0.8 }).scale).toBe(0.8);
  });

  it('enlarges a short tower to fill the room, keeping the width margins', () => {
    const fit = fitTower([layer(540)], { ...room, maxScale: 5 });
    expect(fit.scale).toBeGreaterThan(1);
    expect(fit.scale * BALANCE.tray.width).toBeLessThanOrEqual(room.width + 1e-6);
  });

  it('shrinks a tall tower to the room height', () => {
    const layers = Array.from({ length: 100 }, () => layer(540));
    const fit = fitTower(layers, room);
    expect(fit.scale).toBeCloseTo(800 / (100 * BALANCE.layer.height));
  });

  it('shrinks a wide tower to the room width', () => {
    const layers = [layer(200, 720), layer(900, 720)];
    const fit = fitTower(layers, { ...room, width: 400 });
    expect(fit.scale).toBeCloseTo(400 / (900 + 360 - (200 - 360)));
  });

  it('centres on the middle of the widest extent', () => {
    expect(fitTower([layer(200, 400), layer(900, 400)], room).centerX).toBeCloseTo(
      (Math.min(200 - 200, BALANCE.tray.centerX - BALANCE.tray.width / 2) +
        Math.max(900 + 200, BALANCE.tray.centerX + BALANCE.tray.width / 2)) /
        2,
    );
  });

  it('handles an empty tower', () => {
    expect(fitTower([], room).scale).toBeGreaterThan(0);
  });
});
