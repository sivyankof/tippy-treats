import { describe, expect, it } from 'vitest';
import type { MissionProgress } from '../../../core/save/schema';
import { justCompleted, missionStatus, movedMissions } from './missions-model';

const item = (progress: number, claimed = false, target = 10): MissionProgress => ({
  id: 'runs_3',
  group: 'easy',
  target,
  progress,
  claimed,
});

describe('missions model', () => {
  it('tells open, claimable and claimed missions apart', () => {
    expect(missionStatus(item(3))).toBe('open');
    expect(missionStatus(item(10))).toBe('claimable');
    expect(missionStatus(item(10, true))).toBe('claimed');
  });

  it('finds the missions a run moved', () => {
    const before = [item(2), item(5), item(10, true)];
    const after = [item(2), item(8), item(10, true)];
    const moved = movedMissions(before, after);
    expect(moved).toHaveLength(1);
    expect(moved[0]?.after.progress).toBe(8);
  });

  it('spots a mission completed by the run', () => {
    expect(justCompleted(item(8), item(10))).toBe(true);
    expect(justCompleted(item(10), item(10))).toBe(false);
    expect(justCompleted(item(3), item(5))).toBe(false);
  });
});
