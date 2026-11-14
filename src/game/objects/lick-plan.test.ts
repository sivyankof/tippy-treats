import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { ANIM } from '../../data/anim';
import { LICK } from '../../data/lick';
import {
  clearsEyes,
  dropCenter,
  inReach,
  isAiming,
  lickAllowed,
  lickDurationMs,
  lickFrame,
  LickScheduler,
  tongueTransform,
  type LickCheck,
} from './lick-plan';

const ok: LickCheck = {
  plain: true,
  faceFree: true,
  index: 3,
  topIndex: 9,
  aiming: false,
  y: 500,
  bandTop: 0,
  bandBottom: 1000,
};

describe('lickFrame', () => {
  it('goes through glance, reach, lap, retract and happy in order', () => {
    const stages: string[] = [];
    for (let t = 0; t <= lickDurationMs() + 50; t += 10) {
      const s = lickFrame(t).stage;
      if (stages[stages.length - 1] !== s) stages.push(s);
    }
    expect(stages).toEqual(['glance', 'reach', 'lap', 'retract', 'happy', 'done']);
  });

  it('keeps the tongue in during the glance and the squint, fully out while lapping', () => {
    expect(lickFrame(0).reach).toBe(0);
    const lapT = LICK.glanceMs + LICK.reachMs + LICK.lapMs / 2;
    expect(lickFrame(lapT).reach).toBe(1);
    const happyT = lickDurationMs() - LICK.happyMs / 2;
    expect(lickFrame(happyT).reach).toBe(0);
  });

  it('laps the drip away from 0 to 1 and a shorter glance moves everything earlier', () => {
    const start = LICK.glanceMs + LICK.reachMs;
    expect(lickFrame(start).lap).toBe(0);
    expect(lickFrame(start + LICK.lapMs - 1).lap).toBeGreaterThan(0.99);
    expect(lickFrame(LICK.dropGlanceMs, LICK.dropGlanceMs).stage).toBe('reach');
    expect(lickDurationMs(LICK.dropGlanceMs)).toBeLessThan(lickDurationMs());
  });
});

describe('tongueTransform', () => {
  it('points straight down for a target below and turns towards the side of the target', () => {
    expect(tongueTransform(0, 50, 1).angleDeg).toBeCloseTo(0);
    expect(tongueTransform(50, 0, 1).angleDeg).toBeCloseTo(-90);
    expect(tongueTransform(-50, 0, 1).angleDeg).toBeCloseTo(90);
  });

  it('stretches with the reach, never below the minimum once out, and hides at 0', () => {
    const full = tongueTransform(0, 80, 1);
    expect(full.scaleY).toBeCloseTo((80 - LICK.tongueTipPx) / LICK.tongueTextureHeight);
    expect(full.tipDistance).toBeCloseTo(80 - LICK.tongueTipPx);
    expect(tongueTransform(0, 80, 0).scaleY).toBe(0);
    expect(tongueTransform(0, 80, 0.01).tipDistance).toBeCloseTo(
      LICK.tongueMinPx - LICK.tongueTipPx,
    );
  });
});

describe('clearsEyes', () => {
  it('lets the tongue go straight down and to the lower sides, not across an eye', () => {
    const mouth = ANIM.face.mouthOffsetY;
    expect(clearsEyes(0, mouth + 60)).toBe(true);
    expect(clearsEyes(ANIM.face.eyeSpacing / 2, 0)).toBe(false);
    expect(clearsEyes(ANIM.face.eyeSpacing, -30)).toBe(false);
    expect(clearsEyes(ANIM.face.eyeSpacing, mouth + 40)).toBe(true);
  });
});

describe('inReach', () => {
  it('measures from the mouth, not too near and not too far', () => {
    const mouth = ANIM.face.mouthOffsetY;
    expect(inReach(0, mouth + 5)).toBe(false);
    expect(inReach(60, mouth)).toBe(true);
    expect(inReach(LICK.reachPx[1] + 1, mouth)).toBe(false);
  });
});

describe('LickScheduler', () => {
  it('waits the first delay, then a whole interval between licks', () => {
    const rng = new Rng(7);
    const s = new LickScheduler(() => rng.next());
    expect(s.ready).toBe(false);
    s.tick(LICK.firstDelayMs[1]);
    expect(s.ready).toBe(true);
    s.started();
    expect(s.ready).toBe(false);
    s.tick(LICK.intervalMs[0] - 1);
    expect(s.ready).toBe(false);
    s.tick(LICK.intervalMs[1] - LICK.intervalMs[0] + 1);
    expect(s.ready).toBe(true);
  });

  it('looks again soon when there was nothing to lick', () => {
    const s = new LickScheduler(() => 0);
    s.tick(LICK.firstDelayMs[1]);
    s.retry();
    expect(s.ready).toBe(false);
    s.tick(LICK.retryMs);
    expect(s.ready).toBe(true);
  });

  it('gives the same intervals for the same seed', () => {
    const run = (seed: number): number[] => {
      const rng = new Rng(seed).fork('lick');
      const s = new LickScheduler(() => rng.next());
      const gaps: number[] = [];
      for (let i = 0; i < 4; i++) {
        let t = 0;
        while (!s.ready) {
          s.tick(100);
          t += 100;
        }
        gaps.push(t);
        s.started();
      }
      return gaps;
    };
    expect(run(3)).toEqual(run(3));
    expect(run(3)).not.toEqual(run(4));
  });
});

describe('lickAllowed', () => {
  it('allows a free plain layer on screen', () => {
    expect(lickAllowed(ok)).toBe(true);
  });

  it('refuses creatures, busy faces and layers near or past the screen edge', () => {
    expect(lickAllowed({ ...ok, plain: false })).toBe(false);
    expect(lickAllowed({ ...ok, faceFree: false })).toBe(false);
    expect(lickAllowed({ ...ok, y: LICK.screenMarginPx - 1 })).toBe(false);
    expect(lickAllowed({ ...ok, y: 1000 - LICK.screenMarginPx + 1 })).toBe(false);
  });

  it('keeps the top layer still while a layer is aimed, not the others', () => {
    expect(lickAllowed({ ...ok, index: 9, aiming: true })).toBe(false);
    expect(lickAllowed({ ...ok, index: 9, aiming: false })).toBe(true);
    expect(lickAllowed({ ...ok, index: 8, aiming: true })).toBe(true);
  });
});

describe('isAiming', () => {
  it('counts the flight, the fall and the spawn pause even when the flying layer is hidden', () => {
    expect(isAiming('flying', false)).toBe(true);
    expect(isAiming('pause', false)).toBe(true);
    expect(isAiming('falling', false)).toBe(true);
    expect(isAiming('await_continue', true)).toBe(true);
    expect(isAiming('await_continue', false)).toBe(false);
    expect(isAiming('over', false)).toBe(false);
  });
});

describe('dropCenter', () => {
  it('starts at the drop centre and slides down by the fall distance', () => {
    const out = { x: 0, y: 0 };
    const drop = { x: 40, y: 100, bornMs: 0 };
    dropCenter(drop, 0, (t) => t, out);
    expect(out).toEqual({ x: 40, y: 100 + ANIM.bite.dripSize / 2 });
    dropCenter(drop, ANIM.bite.dripMs * 3, (t) => t, out);
    expect(out.y).toBeCloseTo(100 + ANIM.bite.dripSize / 2 + ANIM.bite.dripSlide);
  });
});
