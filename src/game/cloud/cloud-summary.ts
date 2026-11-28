import type { Save } from '../../core/save/schema';
import { CREATURE_IDS } from '../../data/creatures/creatures';

/** What the cloud windows show of one save (docs/07-ui-screens.md, section 2.4). */
export interface SaveSummary {
  bakerLevel: number;
  /** Best Classic height. */
  record: number;
  /** Creatures owned. */
  creatures: number;
  coins: number;
  berries: number;
  /** Epoch ms of its last write. */
  savedAt: number;
}

/** The summary of `save`, last written at `savedAt`. */
export function summarize(save: Readonly<Save>, savedAt: number): SaveSummary {
  return {
    bakerLevel: save.bakerLevel,
    record: save.records.classicHeight,
    creatures: CREATURE_IDS.filter((id) => save.creatures[id] !== undefined).length,
    coins: save.coins,
    berries: save.berries,
    savedAt,
  };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long ago `thenMs` was, as an i18n key under `cloud.ago` and its number. */
export function agoOf(
  thenMs: number,
  nowMs: number,
): { key: 'now' | 'min' | 'h' | 'd'; n: number } {
  const ms = Math.max(0, nowMs - thenMs);
  if (ms < MINUTE) return { key: 'now', n: 0 };
  if (ms < HOUR) return { key: 'min', n: Math.floor(ms / MINUTE) };
  if (ms < DAY) return { key: 'h', n: Math.floor(ms / HOUR) };
  return { key: 'd', n: Math.floor(ms / DAY) };
}

/** The day, short month and time of `ms` in `lang` ("28 нояб., 14:05"). */
export function formatSavedAt(ms: number, lang: string): string {
  return new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}
