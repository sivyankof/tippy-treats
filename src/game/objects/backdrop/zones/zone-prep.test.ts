import { describe, expect, it } from 'vitest';
import { zoneIndexOf } from '../../../../core/zones/zones';
import { SPACE_ZONE_INDEX } from '../../../../data/zones/zones';
import { PrepQueue, prepTarget, sameTarget } from './zone-prep';

const zoneAt = (height: number): number => zoneIndexOf(height + 1);

describe('prepTarget', () => {
  it('names the next zone from `lead` layers before the change on', () => {
    expect(prepTarget(73, zoneAt(73), 6)).toBeNull();
    expect(prepTarget(74, zoneAt(74), 6)).toEqual({ kind: 'zone', index: 4 });
    expect(prepTarget(79, zoneAt(79), 6)).toEqual({ kind: 'zone', index: 4 });
    // Layer 81 flies: the change has come, the zone after it is far away.
    expect(prepTarget(80, zoneAt(80), 6)).toBeNull();
    expect(prepTarget(14, zoneAt(14), 6)).toEqual({ kind: 'zone', index: 1 });
    expect(prepTarget(13, zoneAt(13), 6)).toBeNull();
  });

  it('names the next lap of Space the same way', () => {
    expect(zoneAt(100)).toBe(SPACE_ZONE_INDEX);
    expect(prepTarget(100, zoneAt(100), 6)).toBeNull();
    expect(prepTarget(114, zoneAt(114), 6)).toEqual({ kind: 'lap', lap: 2 });
    expect(prepTarget(120, zoneAt(120), 6)).toBeNull();
    expect(prepTarget(134, zoneAt(134), 6)).toEqual({ kind: 'lap', lap: 3 });
  });

  it('tells targets apart', () => {
    expect(sameTarget({ kind: 'zone', index: 2 }, { kind: 'zone', index: 2 })).toBe(true);
    expect(sameTarget({ kind: 'zone', index: 2 }, { kind: 'zone', index: 3 })).toBe(false);
    expect(sameTarget({ kind: 'lap', lap: 2 }, { kind: 'zone', index: 2 })).toBe(false);
    expect(sameTarget({ kind: 'lap', lap: 2 }, { kind: 'lap', lap: 2 })).toBe(true);
    expect(sameTarget(null, null)).toBe(true);
    expect(sameTarget(null, { kind: 'lap', lap: 2 })).toBe(false);
  });
});

/** A clock that each step moves on by its own length. */
function timedSteps(lengths: readonly number[], log: number[]) {
  let t = 0;
  const now = (): number => t;
  const steps = lengths.map((ms, i) => () => {
    t += ms;
    log.push(i);
  });
  return { now, steps };
}

describe('PrepQueue', () => {
  it('runs steps while they fit the budget, judged by the longest step seen', () => {
    const log: number[] = [];
    const { now, steps } = timedSteps([1, 1, 1, 3, 1, 1, 1], log);
    const queue = new PrepQueue();
    queue.add(steps);
    // 1 + 1 + 1 leave room for one more step as long as the one seen so far (1 ms): the 3 ms one
    // runs too, as it is not known yet.
    expect(queue.work(4, now)).toBe(4);
    expect(queue.pending).toBe(3);
    // Now the longest is 3 ms: after a 1 ms step, 1 + 3 still fits, after two 2 + 3 does not.
    expect(queue.work(4, now)).toBe(2);
    expect(queue.work(4, now)).toBe(1);
    expect(queue.pending).toBe(0);
    expect(log).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('runs one step a frame even when it is longer than the budget', () => {
    const log: number[] = [];
    const { now, steps } = timedSteps([9, 9], log);
    const queue = new PrepQueue();
    queue.add(steps);
    expect(queue.work(4, now)).toBe(1);
    expect(queue.work(4, now)).toBe(1);
    expect(queue.work(4, now)).toBe(0);
  });

  it('flushes what is left, and clears without running', () => {
    const log: number[] = [];
    const { now, steps } = timedSteps([5, 5, 5], log);
    const queue = new PrepQueue();
    queue.add(steps);
    queue.work(4, now);
    queue.flush();
    expect(log).toEqual([0, 1, 2]);
    queue.add(steps);
    queue.clear();
    expect(queue.pending).toBe(0);
    expect(queue.work(4, now)).toBe(0);
    expect(log).toEqual([0, 1, 2]);
  });

  it('forgets the longest step when the queue empties, so a later prep is not held back by it', () => {
    const log: number[] = [];
    const first = timedSteps([9], log);
    const queue = new PrepQueue();
    queue.add(first.steps);
    queue.work(4, first.now);
    expect(queue.pending).toBe(0);
    // With a remembered 9 ms, the second step would wait for the next frame.
    const second = timedSteps([1, 1, 1], []);
    queue.add(second.steps);
    expect(queue.work(4, second.now)).toBe(3);
  });
});
