import { GOAL_LINE } from '../../data/run/goal-line';
import { daysBetween } from '../../util/calendar';
import type { RunMode } from './run-result';

/** Which result of the player a goal line stands for. */
export type GoalKind = 'yesterday' | 'lastTime' | 'record' | 'dailyBest';

export interface RunGoal {
  kind: GoalKind;
  height: number;
}

export interface RunGoalInput {
  mode: RunMode;
  tutorial: boolean;
  /** Finished runs in the save when the run starts. */
  runs: number;
  startHeight: number;
  /** Best Classic height of the last play day before `localToday` (`previousDayBest`). */
  prevBest: { day: string; bestHeight: number };
  /** Local day `YYYY-MM-DD`. */
  localToday: string;
  /** Saved Classic record. */
  record: number;
  /** Best daily attempt of today's UTC day, 0 when there is none. */
  dailyBest: number;
}

/**
 * The goals of a run, ascending: the line of the run stands on the nearest one above the tower.
 * None in the tutorial, in the first runs, and for a goal that is zero or not above the start
 * height. Classic: the best of the last play day, then the record (a best that reaches the record
 * is not shown apart). Daily: the best attempt of today.
 */
export function runGoals(input: RunGoalInput): RunGoal[] {
  if (input.tutorial || input.runs < GOAL_LINE.minRunsBefore) return [];
  const goals: RunGoal[] = [];
  if (input.mode === 'daily') {
    goals.push({ kind: 'dailyBest', height: input.dailyBest });
  } else {
    const prev = input.prevBest.bestHeight;
    if (prev < input.record) {
      const yesterday = daysBetween(input.prevBest.day, input.localToday) === 1;
      goals.push({ kind: yesterday ? 'yesterday' : 'lastTime', height: prev });
    }
    goals.push({ kind: 'record', height: input.record });
  }
  return goals.filter((goal) => goal.height > 0 && goal.height > input.startHeight);
}

/** The first goal above `height`, or null when every goal is passed. */
export function goalAbove(goals: readonly RunGoal[], height: number): RunGoal | null {
  return goals.find((goal) => goal.height > height) ?? null;
}

/** The goal the line stands on at `height`. */
export function resultGoal(input: RunGoalInput & { height: number }): RunGoal | null {
  return goalAbove(runGoals(input), input.height);
}
