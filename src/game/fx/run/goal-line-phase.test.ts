import { describe, expect, it } from 'vitest';
import { LOGICAL_SIZE } from '../../../data/app/screen';
import { CONTINUE_ANIM } from '../../../data/run/continue-anim';
import { GOAL_LINE } from '../../../data/run/goal-line';
import { appearView, passDurationMs, passView, pennantX, swayView } from './goal-line-phase';

const { appear, pass } = GOAL_LINE;

describe('appearView', () => {
  it('full: fades in and the pennant overshoots, then settles', () => {
    expect(appearView(0, 'full')).toEqual({
      lineAlpha: 0,
      plateAlpha: 0,
      plateScale: appear.popFrom,
    });
    const peak = Math.max(
      ...[...Array(50).keys()].map((i) => appearView(i * 10, 'full').plateScale),
    );
    expect(peak).toBeGreaterThan(1);
    expect(appearView(appear.popMs + appear.fadeMs, 'full')).toEqual({
      lineAlpha: 1,
      plateAlpha: 1,
      plateScale: 1,
    });
  });

  it('lite: fade only, no spring', () => {
    const half = appearView(appear.fadeMs / 2, 'lite');
    expect(half.lineAlpha).toBeCloseTo(0.5);
    expect(half.plateAlpha).toBeCloseTo(0.5);
    expect(half.plateScale).toBe(1);
  });

  it('minimal: stands at once', () => {
    expect(appearView(0, 'minimal')).toEqual({ lineAlpha: 1, plateAlpha: 1, plateScale: 1 });
  });
});

describe('passView', () => {
  it('full: flash and hop at once, then the fade, then done', () => {
    const start = passView(0, 'yesterday', 'full');
    expect(start).toMatchObject({ done: false, scale: 1, hopY: -0, alpha: 1 });
    const mid = passView(pass.flashMs / 2, 'yesterday', 'full');
    expect(mid.scale).toBeCloseTo(pass.flashScale);
    expect(mid.tintMix).toBeCloseTo(1);
    expect(mid.hopY).toBeLessThan(0);
    const fading = passView(pass.fadeStartMs + pass.fadeMs / 2, 'yesterday', 'full');
    expect(fading.alpha).toBeCloseTo(0.5);
    expect(fading.scale).toBe(1);
    expect(passView(passDurationMs('yesterday', 'full'), 'yesterday', 'full').done).toBe(true);
  });

  it('keeps the hop after the flash is over', () => {
    const view = passView(pass.flashMs + 10, 'lastTime', 'lite');
    expect(view.tintMix).toBe(0);
    expect(view.hopY).toBeLessThan(0);
    expect(passView(pass.hopMs + 1, 'lastTime', 'lite').hopY).toBeCloseTo(0);
  });

  it('the record only fades over the flag time', () => {
    const view = passView(CONTINUE_ANIM.flag.fadeMs / 2, 'record', 'full');
    expect(view).toMatchObject({ scale: 1, tintMix: 0, hopY: 0 });
    expect(view.alpha).toBeCloseTo(0.5);
    expect(passDurationMs('record', 'lite')).toBe(CONTINUE_ANIM.flag.fadeMs);
  });

  it('minimal: gone at once', () => {
    expect(passDurationMs('dailyBest', 'minimal')).toBe(0);
    expect(passView(0, 'dailyBest', 'minimal').done).toBe(true);
  });
});

describe('swayView', () => {
  it('moves on full and lite, stands still on minimal', () => {
    expect(swayView(300, 'full').wave).not.toBe(0);
    expect(swayView(300, 'lite').bob).not.toBe(0);
    expect(swayView(300, 'minimal')).toEqual({ pulse: 1, wave: 0, bob: 0 });
  });
});

describe('pennantX', () => {
  it('keeps the inset from the edge on both sides', () => {
    const inset = CONTINUE_ANIM.flag.labelInset;
    expect(pennantX(1, 200)).toBe(LOGICAL_SIZE.width - inset - 100);
    expect(pennantX(-1, 200)).toBe(inset + 100);
  });
});
