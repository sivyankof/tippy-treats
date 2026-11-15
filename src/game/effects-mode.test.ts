import { describe, expect, it } from 'vitest';
import { ANIM } from '../data/anim';
import { EffectsMode } from './effects-mode';

const A = ANIM.fx.auto;
const SLOW_WORK_MS = A.budgetMs + 8;
const SLOW_FRAME_MS = 25;
const FAST_WORK_MS = 5;
const FRAME_60_MS = 1000 / 60;

/** Feeds frames from `from` for `ms`; returns the end time. */
function feed(
  mode: EffectsMode,
  from: number,
  ms: number,
  frameMs: number,
  workMs: number,
): number {
  let t = from;
  while (t < from + ms) {
    t += frameMs;
    mode.noteFrame(workMs, t);
  }
  return t;
}

/** A scene was just loaded and the device is slow for long enough. */
function slowDown(mode: EffectsMode): number {
  mode.noteSceneLoaded(0);
  return feed(mode, A.warmUpMs, A.onWindowMs + 1000, SLOW_FRAME_MS, SLOW_WORK_MS);
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

  it('turns on by itself after a slow stretch and off after a calm one', () => {
    const mode = new EffectsMode();
    const t = slowDown(mode);
    expect(mode.reason).toBe('auto');
    feed(mode, t, A.minSwitchGapMs + A.offWindowMs, FRAME_60_MS, FAST_WORK_MS);
    expect(mode.reduced).toBe(false);
  });

  it('does not turn on for a phone that limits its own frame rate', () => {
    const mode = new EffectsMode();
    mode.noteSceneLoaded(0);
    feed(mode, A.warmUpMs, 30_000, 1000 / 30, FAST_WORK_MS);
    expect(mode.reduced).toBe(false);
  });

  it('does not judge the first seconds of a scene or a return from the background', () => {
    const mode = new EffectsMode();
    mode.noteSceneLoaded(0);
    feed(mode, 0, A.warmUpMs - 100, SLOW_FRAME_MS, SLOW_WORK_MS);
    expect(mode.reduced).toBe(false);
    mode.noteResumed(10_000);
    feed(mode, 10_000, A.resumeIgnoreMs - 100, SLOW_FRAME_MS, SLOW_WORK_MS);
    expect(mode.reduced).toBe(false);
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
