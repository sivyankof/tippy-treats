// The best Classic height of the play day before the current one (docs/08-architecture.md, section 5).
import type { Save } from '../save/schema';

export type DayBest = Save['today'];

/**
 * `today` and `prevDay` after a Classic run of height `height` on the local day `day`. `today` only
 * changes when a Classic run is recorded, so during the first run of a new day it still holds the
 * last play day: a run on a later day moves it to `prevDay` first. A run on an earlier day (the
 * clock was set back) changes neither, so the bests of the real days are not lost.
 */
export function withDayBest(
  save: Pick<Save, 'today' | 'prevDay'>,
  day: string,
  height: number,
): Pick<Save, 'today' | 'prevDay'> {
  const { today } = save;
  if (today.day !== '' && day < today.day) return { today, prevDay: save.prevDay };
  const later = today.day !== '' && day > today.day;
  const best = today.day === day ? today.bestHeight : 0;
  return {
    today: { day, bestHeight: Math.max(best, height) },
    prevDay: later ? { ...today } : save.prevDay,
  };
}

/**
 * The best Classic height of the last play day before `localToday`: `today` itself when it is
 * from an earlier day (no Classic run yet today), else `prevDay`. `{ day: '', bestHeight: 0 }`
 * when there is none.
 */
export function previousDayBest(
  save: Pick<Save, 'today' | 'prevDay'>,
  localToday: string,
): DayBest {
  const { today } = save;
  return today.day !== '' && today.day < localToday ? today : save.prevDay;
}
