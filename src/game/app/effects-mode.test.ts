import { describe, expect, it } from 'vitest';
import { ANIM } from '../../data/common/anim';
import { EffectsMode } from './effects-mode';

const A = ANIM.fx.auto;
const SLOW_WORK_MS = A.budgetMs + 8;
const SLOW_FRAME_MS = 25;
const FAST_WORK_MS = 5;
const FRAME_60_MS = 1000 / 60;
/** Long enough for one step down: the window plus a margin. */
const SLOW_STRETCH_MS = A.onWindowMs + 1000;
/** Long enough for one step up once the switch gap is over. */
const CALM_STRETCH_MS = A.minSwitchGapMs + A.offWindowMs;

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

/** A scene was just loaded and the device is slow for long enough to step down once. */
function slowDown(mode: EffectsMode): number {
  mode.noteSceneLoaded(0);
  return feed(mode, A.warmUpMs, SLOW_STRETCH_MS, SLOW_FRAME_MS, SLOW_WORK_MS);
}

describe('EffectsMode', () => {
  it('starts with every effect', () => {
    const mode = new EffectsMode();
    expect(mode.level).toBe('full');
    expect(mode.reduced).toBe(false);
    expect(mode.atMost('lite')).toBe(false);
    expect(mode.reason).toBeNull();
    expect(mode.particleCount(12)).toBe(12);
  });

  it('halves particles on lite and on minimal, keeping at least one', () => {
    const lite = new EffectsMode();
    lite.setChoice('on');
    expect(lite.level).toBe('lite');
    expect(lite.particleCount(12)).toBe(6);
    expect(lite.particleCount(7)).toBe(4);
    expect(lite.particleCount(1)).toBe(1);
    expect(lite.particleCount(0)).toBe(0);
    const minimal = new EffectsMode();
    minimal.setSystemReducedMotion(true);
    expect(minimal.particleCount(12)).toBe(6);
  });

  it('answers atMost by richness: lite is at most lite but not at most minimal', () => {
    const mode = new EffectsMode();
    mode.setChoice('on');
    expect(mode.atMost('full')).toBe(true);
    expect(mode.atMost('lite')).toBe(true);
    expect(mode.atMost('minimal')).toBe(false);
    expect(mode.reduced).toBe(false);
  });

  it('steps down to lite by itself after a slow stretch and back after a calm one', () => {
    const mode = new EffectsMode();
    const t = slowDown(mode);
    expect(mode.level).toBe('lite');
    expect(mode.reason).toBe('auto');
    expect(mode.reduced).toBe(false);
    feed(mode, t, CALM_STRETCH_MS, FRAME_60_MS, FAST_WORK_MS);
    expect(mode.level).toBe('full');
  });

  it('goes from lite to minimal and back one step at a time', () => {
    const mode = new EffectsMode();
    let t = slowDown(mode);
    expect(mode.level).toBe('lite');
    t = feed(mode, t, A.minSwitchGapMs + A.onWindowMs, SLOW_FRAME_MS, SLOW_WORK_MS);
    expect(mode.level).toBe('minimal');
    expect(mode.reduced).toBe(true);
    t = feed(mode, t, CALM_STRETCH_MS, FRAME_60_MS, FAST_WORK_MS);
    expect(mode.level).toBe('lite');
    feed(mode, t, CALM_STRETCH_MS, FRAME_60_MS, FAST_WORK_MS);
    expect(mode.level).toBe('full');
  });

  it('keeps the minimum gap between two switches', () => {
    const mode = new EffectsMode();
    const t = slowDown(mode);
    expect(mode.level).toBe('lite');
    // A whole slow window passes, but the gap since the first step is not over.
    feed(mode, t, A.minSwitchGapMs - A.onWindowMs, SLOW_FRAME_MS, SLOW_WORK_MS);
    expect(mode.level).toBe('lite');
  });

  it('does not step down for a phone that limits its own frame rate', () => {
    const mode = new EffectsMode();
    mode.noteSceneLoaded(0);
    feed(mode, A.warmUpMs, 30_000, 1000 / 30, FAST_WORK_MS);
    expect(mode.level).toBe('full');
  });

  it('does not judge the first seconds of a scene or a return from the background', () => {
    const mode = new EffectsMode();
    mode.noteSceneLoaded(0);
    feed(mode, 0, A.warmUpMs - 100, SLOW_FRAME_MS, SLOW_WORK_MS);
    expect(mode.level).toBe('full');
    mode.noteResumed(10_000);
    feed(mode, 10_000, A.resumeIgnoreMs - 100, SLOW_FRAME_MS, SLOW_WORK_MS);
    expect(mode.level).toBe('full');
  });

  it('holds the minimal level for the system reduce-motion setting', () => {
    const mode = new EffectsMode();
    mode.setSystemReducedMotion(true);
    expect(mode.reason).toBe('system');
    expect(mode.level).toBe('minimal');
    expect(mode.reduced).toBe(true);
    mode.setSystemReducedMotion(false);
    expect(mode.level).toBe('full');
  });

  it('sets a ceiling with the switch on: never above lite, the automatic mode may still go to minimal', () => {
    const mode = new EffectsMode();
    mode.setChoice('on');
    expect(mode.level).toBe('lite');
    expect(mode.reason).toBe('user');
    // A calm device does not lift it.
    mode.noteSceneLoaded(0);
    let t = feed(mode, A.warmUpMs, 60_000, FRAME_60_MS, FAST_WORK_MS);
    expect(mode.level).toBe('lite');
    // A slow one pushes it on to minimal, and a calm one brings it back only to lite.
    t = feed(mode, t, SLOW_STRETCH_MS, SLOW_FRAME_MS, SLOW_WORK_MS);
    expect(mode.level).toBe('minimal');
    expect(mode.reason).toBe('auto');
    t = feed(mode, t, CALM_STRETCH_MS, FRAME_60_MS, FAST_WORK_MS);
    expect(mode.level).toBe('lite');
    feed(mode, t, 2 * CALM_STRETCH_MS, FRAME_60_MS, FAST_WORK_MS);
    expect(mode.level).toBe('lite');
  });

  it('lets the automatic mode move over all three levels with the switch off', () => {
    const mode = new EffectsMode();
    mode.setChoice('off');
    const t = slowDown(mode);
    expect(mode.level).toBe('lite');
    feed(mode, t, A.minSwitchGapMs + A.onWindowMs, SLOW_FRAME_MS, SLOW_WORK_MS);
    expect(mode.level).toBe('minimal');
    expect(mode.reason).toBe('auto');
  });

  it('lets the player switch it off over the system setting, but not over the automatic mode', () => {
    const mode = new EffectsMode();
    mode.setSystemReducedMotion(true);
    mode.setChoice('off');
    expect(mode.level).toBe('full');
    slowDown(mode);
    expect(mode.level).toBe('lite');
    mode.setChoice('on');
    expect(mode.level).toBe('minimal');
    expect(mode.reason).toBe('system');
  });

  it('keeps lite when the switch goes on after the automatic mode stepped down', () => {
    const mode = new EffectsMode();
    slowDown(mode);
    mode.setChoice('on');
    expect(mode.level).toBe('lite');
    expect(mode.reason).toBe('user');
  });

  it('hands the decision back to the system and the frame rate on auto', () => {
    const mode = new EffectsMode();
    mode.setSystemReducedMotion(true);
    mode.setChoice('off');
    expect(mode.level).toBe('full');
    mode.setChoice('auto');
    expect(mode.reason).toBe('system');
  });

  it('shows the switch on for on, and for auto while the effects are cut; off shows off', () => {
    const mode = new EffectsMode();
    expect(mode.switchOn).toBe(false);
    slowDown(mode);
    expect(mode.switchOn).toBe(true);
    mode.setChoice('off');
    expect(mode.switchOn).toBe(false);
    mode.setChoice('on');
    expect(mode.switchOn).toBe(true);
  });

  it('holds a pinned level whatever the device and the settings say', () => {
    const mode = new EffectsMode();
    mode.setSystemReducedMotion(true);
    mode.setChoice('on');
    mode.pinLevel('full');
    expect(mode.level).toBe('full');
    mode.pinLevel('lite');
    expect(mode.level).toBe('lite');
    mode.pinLevel(null);
    expect(mode.level).toBe('minimal');
  });
});
