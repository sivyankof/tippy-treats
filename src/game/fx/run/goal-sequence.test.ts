import { describe, expect, it } from 'vitest';
import type { RunGoal } from '../../../core/run/result-goal';
import { passDurationMs } from './goal-line-phase';
import { GoalSequence } from './goal-sequence';

const goals: RunGoal[] = [
  { kind: 'yesterday', height: 10 },
  { kind: 'record', height: 20 },
];

describe('GoalSequence', () => {
  it('starts on the first goal above the height', () => {
    expect(new GoalSequence(goals, 0).goal?.kind).toBe('yesterday');
    expect(new GoalSequence(goals, 10).goal?.kind).toBe('record');
    expect(new GoalSequence(goals, 20).goal).toBeNull();
    expect(new GoalSequence([], 0).goal).toBeNull();
  });

  it('stands while the height does not exceed the goal', () => {
    const seq = new GoalSequence(goals, 0);
    expect(seq.update(100, 10, 'full')).toBe(false);
    expect(seq.passing).toBe(false);
    expect(seq.ageMs).toBe(100);
  });

  it('is passed, fades, then the next goal appears', () => {
    const seq = new GoalSequence(goals, 0);
    expect(seq.update(16, 11, 'full')).toBe(true);
    expect(seq.passing).toBe(true);
    expect(seq.goal?.kind).toBe('yesterday');
    expect(seq.update(16, 11, 'full')).toBe(false);
    seq.update(passDurationMs('yesterday', 'full'), 11, 'full');
    expect(seq.passing).toBe(false);
    expect(seq.goal?.kind).toBe('record');
    expect(seq.ageMs).toBe(0);
  });

  it('jumps to the next goal at once on minimal', () => {
    const seq = new GoalSequence(goals, 0);
    expect(seq.update(16, 11, 'minimal')).toBe(true);
    expect(seq.goal?.kind).toBe('record');
    expect(seq.passing).toBe(false);
  });

  it('skips goals passed in one jump and ends after the last', () => {
    const seq = new GoalSequence(goals, 0);
    seq.update(16, 15, 'minimal');
    expect(seq.goal?.kind).toBe('record');
    seq.update(16, 25, 'minimal');
    expect(seq.goal).toBeNull();
    expect(seq.update(16, 30, 'full')).toBe(false);
    const jump = new GoalSequence(goals, 0);
    jump.update(16, 25, 'minimal');
    expect(jump.goal).toBeNull();
  });
});
