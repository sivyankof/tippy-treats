import { goalAbove, type RunGoal } from '../../../core/run/result-goal';
import type { EffectLevel } from '../../../data/app/effect-levels';
import { passDurationMs } from './goal-line-phase';

/**
 * Which goal the line stands on and how long: it appears, stands until the height rises above it,
 * is passed (flash, fade), and then the next goal above the height appears.
 */
export class GoalSequence {
  /** The goal on show; null when none is left. */
  goal: RunGoal | null;
  /** The goal has been passed and is going away. */
  passing = false;
  /** Time since the goal appeared, or since it was passed. */
  ageMs = 0;

  constructor(
    private readonly goals: readonly RunGoal[],
    height: number,
  ) {
    this.goal = goalAbove(goals, height);
  }

  /** Moves time and the height on; true on the frame a goal was just passed. */
  update(dtMs: number, height: number, level: EffectLevel): boolean {
    const goal = this.goal;
    if (!goal) return false;
    this.ageMs += dtMs;
    let passedNow = false;
    if (!this.passing && height > goal.height) {
      this.passing = true;
      this.ageMs = 0;
      passedNow = true;
    }
    if (this.passing && this.ageMs >= passDurationMs(goal.kind, level)) {
      this.goal = goalAbove(this.goals, height);
      this.passing = false;
      this.ageMs = 0;
    }
    return passedNow;
  }
}
