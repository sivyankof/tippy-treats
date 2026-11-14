import { describe, expect, it } from 'vitest';
import { RULE_ANIM } from '../../data/rule-anim';
import {
  easeOutPower,
  pullShare,
  releasePose,
  RELEASE_TOTAL_MS,
  restPose,
  RushWindup,
  windupPose,
} from './rush-windup';

const cfg = RULE_ANIM.windup;
const STEP = 1000 / 60;

describe('pullShare', () => {
  it('goes from nothing to the full pull and never moves back', () => {
    expect(pullShare(0)).toBe(0);
    expect(pullShare(1)).toBeCloseTo(1);
    let last = 0;
    for (let i = 1; i <= 20; i++) {
      const share = pullShare(i / 20);
      expect(share).toBeGreaterThanOrEqual(last);
      last = share;
    }
  });

  it('eases out: the first half covers more than half of the pull', () => {
    expect(pullShare(0.5)).toBeGreaterThan(0.5);
  });

  it('is still moving at the end, so the layer never looks stuck before it lets go', () => {
    const lastStep = pullShare(1) - pullShare(1 - 1 / 20);
    expect(lastStep).toBeGreaterThan(0.005);
  });

  it('limits progress to 0..1', () => {
    expect(pullShare(-1)).toBe(0);
    expect(pullShare(2)).toBeCloseTo(1);
  });
});

describe('easeOutPower', () => {
  it('is fast at the start and flat at the end', () => {
    expect(easeOutPower(0, 2)).toBe(0);
    expect(easeOutPower(1, 2)).toBe(1);
    expect(easeOutPower(0.5, 2)).toBeCloseTo(0.75);
  });
});

describe('windupPose', () => {
  it('starts at rest and ends at the full pull with the load squash', () => {
    expect(windupPose(0, restPose())).toEqual(restPose());
    const end = windupPose(1, restPose());
    expect(end.pull).toBeCloseTo(cfg.pullPx);
    expect(end.scaleX).toBeCloseTo(cfg.load.scaleX);
    expect(end.scaleY).toBeCloseTo(cfg.load.scaleY);
  });
});

describe('releasePose', () => {
  const from = windupPose(1, restPose());

  it('starts exactly where the wind-up ended, so there is no jump', () => {
    expect(releasePose(0, from, restPose())).toEqual(from);
  });

  it('returns the pull to zero within releaseMs, never going past it', () => {
    let last = from.pull;
    for (let age = 0; age <= cfg.releaseMs; age += 5) {
      const pull = releasePose(age, from, restPose()).pull;
      expect(pull).toBeLessThanOrEqual(last);
      expect(pull).toBeGreaterThanOrEqual(0);
      last = pull;
    }
    expect(releasePose(cfg.releaseMs, from, restPose()).pull).toBeCloseTo(0);
  });

  it('snaps to the dash stretch, then settles back to the own shape', () => {
    const dash = releasePose(cfg.releaseMs, from, restPose());
    expect(dash.scaleX).toBeCloseTo(cfg.dash.scaleX);
    expect(dash.scaleY).toBeCloseTo(cfg.dash.scaleY);
    expect(releasePose(RELEASE_TOTAL_MS, from, restPose())).toEqual(restPose());
  });

  it('is continuous around the end of the snap', () => {
    const before = releasePose(cfg.releaseMs - 1, from, restPose());
    const after = releasePose(cfg.releaseMs + 1, from, restPose());
    expect(Math.abs(before.scaleX - after.scaleX)).toBeLessThan(0.01);
    expect(Math.abs(before.scaleY - after.scaleY)).toBeLessThan(0.01);
  });
});

describe('RushWindup', () => {
  it('stays at rest for a layer without a wind-up', () => {
    const windup = new RushWindup();
    expect(windup.update(STEP, false, 0)).toEqual(restPose());
    expect(windup.released).toBe(false);
  });

  it('draws the pull while winding and reports the release exactly once', () => {
    const windup = new RushWindup();
    const pose = windup.update(STEP, true, 0.5);
    expect(pose.pull).toBeCloseTo(pullShare(0.5) * cfg.pullPx);
    expect(windup.released).toBe(false);

    const first = windup.update(STEP, false, 0);
    expect(windup.released).toBe(true);
    expect(first.pull).toBeCloseTo(pullShare(0.5) * cfg.pullPx);
    windup.update(STEP, false, 0);
    expect(windup.released).toBe(false);
  });

  it('never jumps by a large step from the spawn through the release to rest', () => {
    const windup = new RushWindup();
    const windupMs = 300;
    let last = 0;
    let biggest = 0;
    for (let t = 0; t < windupMs; t += STEP) {
      const pull = windup.update(STEP, true, t / windupMs).pull;
      biggest = Math.max(biggest, Math.abs(pull - last));
      last = pull;
    }
    for (let t = 0; t < RELEASE_TOTAL_MS + 100; t += STEP) {
      const pull = windup.update(STEP, false, 0).pull;
      biggest = Math.max(biggest, Math.abs(pull - last));
      last = pull;
    }
    expect(biggest).toBeLessThan(cfg.pullPx / 2);
    expect(last).toBe(0);
  });

  it('is back at rest after the release has run its course', () => {
    const windup = new RushWindup();
    windup.update(STEP, true, 1);
    let pose = windup.update(STEP, false, 0);
    for (let t = 0; t < RELEASE_TOTAL_MS + STEP; t += STEP) pose = windup.update(STEP, false, 0);
    expect(pose).toEqual(restPose());
  });

  it('forgets a layer on reset', () => {
    const windup = new RushWindup();
    windup.update(STEP, true, 1);
    windup.reset();
    expect(windup.update(STEP, false, 0)).toEqual(restPose());
    expect(windup.released).toBe(false);
  });

  it('lets a layer that is dropped mid wind-up go from its partial pull', () => {
    const windup = new RushWindup();
    const held = windup.update(STEP, true, 0.4).pull;
    const dropped = windup.update(STEP, false, 0);
    expect(dropped.pull).toBeCloseTo(held);
  });
});
