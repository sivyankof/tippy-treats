import { isComplete } from '../../../core/missions';
import type { MissionProgress } from '../../../core/save/schema';

/** What a mission card offers right now. */
export type MissionStatus = 'open' | 'claimable' | 'claimed';

export function missionStatus(item: MissionProgress): MissionStatus {
  if (item.claimed) return 'claimed';
  return isComplete(item) ? 'claimable' : 'open';
}

/** Missions whose progress grew between two lists of the same day, with both states. */
export function movedMissions(
  before: readonly MissionProgress[],
  after: readonly MissionProgress[],
): Array<{ before: MissionProgress; after: MissionProgress }> {
  const moved: Array<{ before: MissionProgress; after: MissionProgress }> = [];
  after.forEach((item, i) => {
    const prev = before[i];
    if (prev && prev.id === item.id && item.progress > prev.progress) {
      moved.push({ before: prev, after: item });
    }
  });
  return moved;
}

/** True for a mission that was open before the run and is complete after it. */
export function justCompleted(before: MissionProgress, after: MissionProgress): boolean {
  return !isComplete(before) && isComplete(after);
}
