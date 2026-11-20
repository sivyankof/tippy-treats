import { createDefaultSave } from '../../src/core/save/defaults';
import { serializeSave } from '../../src/core/save/load';
import { HINT_IDS, type Save } from '../../src/core/save/schema';
import { spaceLap } from '../../src/core/zones/space-laps';
import { checkpointsReached } from '../../src/core/zones/checkpoints';
import { STORE_CLOCK, STORE_SAVE, type StoreLang } from '../../src/data/debug/store-shots';

/** The local day of the stopped clock (`YYYY-MM-DD`); the shots run in UTC, so it is also the UTC day. */
export function storeDay(): string {
  return STORE_CLOCK.start.slice(0, 10);
}

/** Epoch ms of the stopped clock in UTC. */
export function storeNowMs(): number {
  return Date.parse(`${STORE_CLOCK.start}Z`);
}

/** The day before `day` (`YYYY-MM-DD`). */
function dayBefore(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

/**
 * The save every shot starts from (`STORE_SAVE`): the tutorial and every hint behind the player,
 * the streak claimed today, so no window opens over a screen by itself. `lang` is the language of
 * the interface.
 */
export function storeSave(lang: StoreLang): Save {
  const nowMs = storeNowMs();
  const today = storeDay();
  const s = STORE_SAVE;
  const save = createDefaultSave(nowMs - 40 * 86_400_000, s.installId);
  const creatures: Save['creatures'] = {};
  for (const [id, level] of Object.entries(s.creatures))
    creatures[id as keyof typeof creatures] = { level };
  return {
    ...save,
    lastSeenAt: nowMs,
    coins: s.coins,
    berries: s.berries,
    bakerLevel: s.bakerLevel,
    creatures,
    team: [...s.team],
    records: { ...s.records },
    stats: { ...s.stats },
    streak: {
      count: s.streak.count,
      best: s.streak.best,
      lastDay: dayBefore(today),
      cycle: 0,
      claimedDay: today,
    },
    today: { day: today, bestHeight: 0 },
    daily: {
      day: today,
      attemptsUsed: s.daily.attemptsUsed,
      extraAttemptUsed: false,
      best: s.daily.best,
      claimedTiers: [],
    },
    gift: { nextAt: nowMs + 3_600_000 },
    tutorial: { firstRunDone: true, hintsShown: [...HINT_IDS] },
    settings: { ...save.settings, lang },
    ads: { ...save.ads, sessions: s.sessions, offerDay: today },
    checkpoints: checkpointsReached(s.records.classicHeight),
    bestLap: spaceLap(s.records.classicHeight),
    consent: { attAsked: true, notifAsked: true },
  };
}

/** The save as the game keeps it in `localStorage` (key `save`). */
export function storeSaveText(lang: StoreLang): string {
  return serializeSave(storeSave(lang));
}
