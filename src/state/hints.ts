// Tutorial hints: what was shown, plus the debug override that holds for one page load.
import type { HintId, Save } from '../core/save/schema';

/**
 * Debug override of the hints, for the current page load only (never saved):
 * `fresh` shows every hint again, `off` counts every hint as shown.
 */
type HintOverride = 'fresh' | 'off' | null;

export class Hints {
  private override: HintOverride = null;
  private readonly overrideSeen = new Set<HintId>();

  /**
   * Applies `?tutorial=`: `true` shows every hint fresh on every run, `false` counts every hint
   * as shown; `undefined` changes nothing.
   */
  force(value?: boolean): void {
    if (value === true) {
      this.override = 'fresh';
      this.overrideSeen.clear();
    } else if (value === false) {
      this.override = 'off';
    }
  }

  has(save: Save, id: HintId): boolean {
    if (this.override === 'off') return true;
    if (this.override === 'fresh') return this.overrideSeen.has(id);
    return save.tutorial.hintsShown.includes(id);
  }

  /** The save with the hint marked; `null` when the save does not change (override or already shown). */
  mark(save: Save, id: HintId): Save | null {
    if (this.override === 'fresh') {
      this.overrideSeen.add(id);
      return null;
    }
    if (this.override === 'off' || save.tutorial.hintsShown.includes(id)) return null;
    return {
      ...save,
      tutorial: { ...save.tutorial, hintsShown: [...save.tutorial.hintsShown, id] },
    };
  }
}
