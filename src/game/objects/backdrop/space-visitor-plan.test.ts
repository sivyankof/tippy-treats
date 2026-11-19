import { describe, expect, it } from 'vitest';
import { HUD_LAYOUT } from '../../../data/run/hud-layout';
import { LOGICAL_SIZE } from '../../../data/app/screen';
import { flightClearBand } from '../../camera-layout';
import { SPACE_VISITOR, SPACE_VISITOR_IDS } from '../../../data/guests/space-visitor';
import {
  newVisitorPose,
  planVisitor,
  visitorBand,
  visitorLane,
  visitorPose,
  visitorScale,
  type VisitorPlan,
} from './space-visitor-plan';

const seq =
  (...values: number[]) =>
  () =>
    values.shift() ?? 0;

describe('planVisitor', () => {
  it('rolls delay, length, side and height of the given guest', () => {
    const plan = planVisitor('eclair', seq(0, 0, 0.9, 0.5));
    expect(plan.guest).toBe('eclair');
    expect(plan.delayMs).toBe(SPACE_VISITOR.delayMs[0]);
    expect(plan.leftward).toBe(false);
    expect(plan.bandShare).toBe(0.5);
  });

  it('keeps delay and duration inside the data ranges', () => {
    for (let i = 0; i < 50; i++) {
      const plan = planVisitor('comet', Math.random);
      const [dMin, dMax] = SPACE_VISITOR.guests.comet.flight.durationMs;
      expect(plan.durationMs).toBeGreaterThanOrEqual(dMin);
      expect(plan.durationMs).toBeLessThanOrEqual(dMax);
    }
  });

  it('a forced guest comes soon', () => {
    const plan = planVisitor('teapot', () => 0.99, true);
    expect(plan.guest).toBe('teapot');
    expect(plan.delayMs).toBe(SPACE_VISITOR.forcedDelayMs);
  });

  it('is the same for the same stream', () => {
    const make = (): (() => number) => {
      let s = 7;
      return () => {
        s = (s * 16807) % 2147483647;
        return s / 2147483647;
      };
    };
    expect(planVisitor('saucer', make())).toEqual(planVisitor('saucer', make()));
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

  it('stays in its lane: under the HUD and clear of the stripe around the flying layer line', () => {
    const clear = flightClearBand(tall);
    for (const id of SPACE_VISITOR_IDS) {
      const spec = SPACE_VISITOR.guests[id];
      const lane = visitorLane(id, tall);
      expect(lane).not.toBeNull();
      const band = visitorBand(tall, lane ?? 'above');
      for (const bandShare of [0, 0.5, 1]) {
        for (let p = 0; p <= 1; p += 0.05) {
          const pose = at({ ...base, guest: id, bandShare }, p, p * 5000);
          expect(pose.scale).toBeGreaterThan(0);
          const half = (spec.height * pose.scale) / 2;
          expect(pose.y - half).toBeGreaterThanOrEqual(band.top - 1);
          expect(pose.y + half).toBeLessThanOrEqual(band.bottom + 1);
          expect(pose.y - half).toBeGreaterThanOrEqual(HUD_LAYOUT.badgeRowBottom);
          const crosses = pose.y + half > clear.top && pose.y - half < clear.bottom;
          expect(crosses).toBe(false);
        }
      }
    }
  });

  it('never flies in the clear stripe on any screen height', () => {
    for (let h = LOGICAL_SIZE.minHeight; h <= LOGICAL_SIZE.maxHeight; h += 60) {
      const clear = flightClearBand(h);
      for (const id of SPACE_VISITOR_IDS) {
        const lane = visitorLane(id, h);
        if (!lane) continue;
        const band = visitorBand(h, lane);
        expect(band.bottom <= clear.top || band.top >= clear.bottom).toBe(true);
      }
    }
  });

  it('shows no guest on the shortest screen (390x693)', () => {
    for (const id of SPACE_VISITOR_IDS) expect(visitorScale(id, LOGICAL_SIZE.minHeight)).toBe(0);
  });

  it('puts a guest below the flying row when it does not fit above', () => {
    expect(visitorLane('eclair', tall)).toBe('above');
    expect(visitorLane('saucer', tall)).toBe('below');
    expect(visitorScale('saucer', tall)).toBeGreaterThan(0);
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
