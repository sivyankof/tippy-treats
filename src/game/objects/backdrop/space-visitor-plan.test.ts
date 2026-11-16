import { describe, expect, it } from 'vitest';
import { LOGICAL_SIZE } from '../../../data/screen';
import { SPACE_VISITOR, SPACE_VISITOR_IDS } from '../../../data/space-visitor';
import {
  newVisitorPose,
  pickGuest,
  planVisitor,
  visitorBand,
  visitorPose,
  visitorScale,
  type VisitorPlan,
} from './space-visitor-plan';

const seq =
  (...values: number[]) =>
  () =>
    values.shift() ?? 0;

describe('planVisitor', () => {
  it('gives no guest when the chance roll fails', () => {
    expect(planVisitor(seq(SPACE_VISITOR.chancePerRun))).toBeNull();
    expect(planVisitor(seq(0.99))).toBeNull();
  });

  it('gives a guest when the roll is under the chance', () => {
    const plan = planVisitor(seq(0, 0, 0, 0, 0.9, 0.5));
    expect(plan).not.toBeNull();
    expect(plan?.guest).toBe('eclair');
    expect(plan?.delayMs).toBe(SPACE_VISITOR.delayMs[0]);
    expect(plan?.leftward).toBe(false);
    expect(plan?.bandShare).toBe(0.5);
  });

  it('keeps delay and duration inside the data ranges', () => {
    for (let i = 0; i < 50; i++) {
      const plan = planVisitor(Math.random, 'comet');
      const [dMin, dMax] = SPACE_VISITOR.guests.comet.flight.durationMs;
      expect(plan?.durationMs).toBeGreaterThanOrEqual(dMin);
      expect(plan?.durationMs).toBeLessThanOrEqual(dMax);
    }
  });

  it('a forced guest always comes, soon, without a chance roll', () => {
    const plan = planVisitor(() => 0.99, 'teapot');
    expect(plan?.guest).toBe('teapot');
    expect(plan?.delayMs).toBe(SPACE_VISITOR.forcedDelayMs);
  });

  it('is the same for the same stream', () => {
    const make = (): (() => number) => {
      let s = 7;
      return () => {
        s = (s * 16807) % 2147483647;
        return s / 2147483647;
      };
    };
    expect(planVisitor(make(), 'saucer')).toEqual(planVisitor(make(), 'saucer'));
  });

  it('every guest is reachable by the roll', () => {
    const seen = new Set(Array.from({ length: 100 }, (_, i) => pickGuest(i / 100)));
    expect([...seen].sort()).toEqual([...SPACE_VISITOR_IDS].sort());
  });
});

describe('visitorPose', () => {
  const width = 1080;
  const tall = 2340;
  const base: VisitorPlan = {
    guest: 'eclair',
    delayMs: 0,
    durationMs: 10000,
    leftward: false,
    bandShare: 0.5,
  };
  const at = (plan: VisitorPlan, p: number, time = 0, h = tall) =>
    visitorPose(plan, p, time, width, h, newVisitorPose());

  it('crosses from beyond one edge to beyond the other', () => {
    expect(at(base, 0).x).toBeLessThan(0);
    expect(at(base, 0.999).x).toBeGreaterThan(width);
    const back = at({ ...base, leftward: true }, 0.001);
    expect(back.x).toBeGreaterThan(width);
    expect(back.flipX).toBe(true);
  });

  it('stays between the HUD and the flying layer row on a tall screen', () => {
    const band = visitorBand(tall);
    for (const id of SPACE_VISITOR_IDS) {
      const spec = SPACE_VISITOR.guests[id];
      for (const bandShare of [0, 0.5, 1]) {
        for (let p = 0; p <= 1; p += 0.05) {
          const pose = at({ ...base, guest: id, bandShare }, p, p * 5000);
          expect(pose.scale).toBeGreaterThan(0);
          const half = (spec.height * pose.scale) / 2;
          expect(pose.y - half).toBeGreaterThanOrEqual(band.top - 1);
          expect(pose.y + half).toBeLessThanOrEqual(band.bottom + 1);
        }
      }
    }
  });

  it('shows no guest where the band is too short (the shortest screen)', () => {
    const shortest = LOGICAL_SIZE.minHeight;
    for (const id of SPACE_VISITOR_IDS) expect(visitorScale(id, shortest)).toBe(0);
    expect(visitorScale('saucer', tall)).toBeLessThan(1);
    expect(visitorScale('eclair', tall)).toBe(1);
  });

  it('is invisible at both ends of the pass and solid in the middle', () => {
    expect(at(base, 0).alpha).toBe(0);
    expect(at(base, 0.5).alpha).toBe(1);
  });

  it('tilts a comet head-first down its slope, mirrored when it flies left', () => {
    const right = at({ ...base, guest: 'comet' }, 0.5);
    const left = at({ ...base, guest: 'comet', leftward: true }, 0.5);
    expect(right.rotation).toBeGreaterThan(0);
    expect(left.rotation).toBeCloseTo(-right.rotation);
  });
});
