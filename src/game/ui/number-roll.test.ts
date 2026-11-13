import { describe, expect, it } from 'vitest';
import { ANIM } from '../../data/anim';
import { NumberRoll, rollDurationMs } from './number-roll';

const [MIN_MS, MAX_MS] = ANIM.ui.numberRollMs;

describe('rollDurationMs', () => {
  it('stays inside the range and grows with the change', () => {
    expect(rollDurationMs(1)).toBe(MIN_MS);
    expect(rollDurationMs(-1)).toBe(MIN_MS);
    expect(rollDurationMs(ANIM.ui.numberRollBigChange)).toBe(MAX_MS);
    expect(rollDurationMs(1_000_000)).toBe(MAX_MS);
    const mid = rollDurationMs(50);
    expect(mid).toBeGreaterThan(MIN_MS);
    expect(mid).toBeLessThan(MAX_MS);
    expect(rollDurationMs(100)).toBeGreaterThan(mid);
  });
});

describe('NumberRoll', () => {
  it('shows the first value at once', () => {
    const roll = new NumberRoll();
    roll.set(96);
    expect(roll.update(0)).toBe(96);
  });

  it('rolls up through the numbers in between and lands on the target', () => {
    const roll = new NumberRoll();
    roll.set(0);
    roll.set(100);
    const seen: number[] = [];
    for (let t = 0; t < MAX_MS; t += 16) seen.push(roll.update(16));
    expect(seen.at(-1)).toBe(100);
    expect(seen.some((v) => v > 0 && v < 100)).toBe(true);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1] ?? 0);
  });

  it('takes the whole roll time to arrive', () => {
    const roll = new NumberRoll();
    roll.set(0);
    roll.set(10);
    const half = rollDurationMs(10) / 2;
    expect(roll.update(half)).toBeLessThan(10);
    expect(roll.update(half)).toBe(10);
  });

  it('continues from the shown number when the target changes mid-roll', () => {
    const roll = new NumberRoll();
    roll.set(0);
    roll.set(100);
    const midway = roll.update(100);
    roll.set(200);
    expect(roll.update(0)).toBe(midway);
    expect(roll.update(MAX_MS)).toBe(200);
  });

  it('keeps rolling when the same target is set again', () => {
    const roll = new NumberRoll();
    roll.set(0);
    roll.set(50);
    const first = roll.update(100);
    roll.set(50);
    expect(roll.update(100)).toBeGreaterThanOrEqual(first);
  });

  it('jumps when asked to snap', () => {
    const roll = new NumberRoll();
    roll.set(5);
    roll.set(0, true);
    expect(roll.update(0)).toBe(0);
  });
});
