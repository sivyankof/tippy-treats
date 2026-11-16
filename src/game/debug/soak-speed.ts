import type * as Phaser from 'phaser';
import { BALANCE } from '../../data/balance';

/**
 * Game-time multiplier of the dev-only smoke lap (`tippySoak.smoke()`), applied in ONE place: the
 * game loop hands every scene a scaled clock and a scaled delta, so scene timers, tweens, the sim
 * and the effects all keep their relative timing. The wrapper stays in place after the lap and
 * passes time and delta through untouched at speed 1. A scaled delta above the sim's frame clamp is delivered over the
 * next frames instead of being cut, so the game time still adds up to the speed.
 */
let speed = 1;
let virtualTime: number | null = null;
let pendingMs = 0;
let installedOn: Phaser.Game | null = null;

function install(game: Phaser.Game): void {
  if (installedOn === game) return;
  installedOn = game;
  const loop = game.loop;
  const inner = loop.callback;
  loop.callback = (time: number, delta: number): void => {
    let step = delta;
    if (speed !== 1 || pendingMs > 0) {
      const maxMs = BALANCE.sim.maxFrameMs;
      pendingMs = Math.min(pendingMs + delta * speed, maxMs * 2);
      step = Math.min(pendingMs, maxMs);
      pendingMs -= step;
    }
    virtualTime = virtualTime === null ? time : virtualTime + step;
    inner(virtualTime, step);
  };
}

export function setSoakSpeed(game: Phaser.Game, value: number): void {
  install(game);
  speed = value;
  if (value === 1) pendingMs = 0;
}
