import { describe, expect, it } from 'vitest';
import { ANIM } from '../data/anim';
import { EffectsMode } from './effects-mode';

const SLOW_FRAME_MS = 25;

function slowDown(mode: EffectsMode): void {
  for (let t = 0; t <= ANIM.fx.lowFpsWindowMs; t += SLOW_FRAME_MS) mode.noteFrame(SLOW_FRAME_MS);
}

describe('EffectsMode', () => {
  it('starts with every effect', () => {
    const mode = new EffectsMode();
    expect(mode.reduced).toBe(false);
    expect(mode.reason).toBeNull();
    expect(mode.particleCount(12)).toBe(12);
  });

  it('halves particles when reduced, keeping at least one', () => {
    const mode = new EffectsMode();
    mode.setChoice('on');
    expect(mode.particleCount(12)).toBe(6);
    expect(mode.particleCount(7)).toBe(4);
    expect(mode.particleCount(1)).toBe(1);
    expect(mode.particleCount(0)).toBe(0);
  });

  it('turns on by itself after a slow stretch and stays on', () => {
    const mode = new EffectsMode();
    slowDown(mode);
    expect(mode.reason).toBe('low_fps');
    for (let i = 0; i < 300; i++) mode.noteFrame(1000 / 60);
    expect(mode.reduced).toBe(true);
  });

  it('follows the system reduce-motion setting', () => {
    const mode = new EffectsMode();
    mode.setSystemReducedMotion(true);
    expect(mode.reason).toBe('system');
    mode.setSystemReducedMotion(false);
    expect(mode.reduced).toBe(false);
  });

  it('lets the player switch it off over the system and the frame rate', () => {
    const mode = new EffectsMode();
    mode.setSystemReducedMotion(true);
    slowDown(mode);
    mode.setChoice('off');
    expect(mode.reduced).toBe(false);
  });

  it('does not overrule a player who switched it off', () => {
    const mode = new EffectsMode();
    mode.setChoice('off');
    slowDown(mode);
    expect(mode.reduced).toBe(false);
    mode.setChoice('on');
    expect(mode.reason).toBe('user');
  });

  it('hands the decision back to the system and the frame rate on auto', () => {
    const mode = new EffectsMode();
    mode.setSystemReducedMotion(true);
    mode.setChoice('off');
    expect(mode.reduced).toBe(false);
    mode.setChoice('auto');
    expect(mode.reason).toBe('system');
  });
});
