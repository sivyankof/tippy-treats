import { earn, grantCreature, spend, type Cost, type Wallet } from '../core/economy';
import { addXp, levelReward, xpForRun } from '../core/progression';
import type { RunResult } from '../core/run-result';
import { createDefaultSave } from '../core/save/defaults';
import { loadSave, serializeSave, type SaveSource } from '../core/save/load';
import type { HintId, Save } from '../core/save/schema';
import type { LevelReward } from '../data/progression';
import { SAVE_RETRY_MS, SAVE_WRITE_DEBOUNCE_MS, STORAGE_KEYS } from '../data/storage';
import type { StorageService } from '../services/storage/types';
import { clockWentBack } from '../util/clock';

/** Starts and stops the delayed write; the page uses timers, the tests a manual one. */
export interface Scheduler {
  set(callback: () => void, delayMs: number): unknown;
  clear(handle: unknown): void;
}

export interface GameStateDeps {
  storage: StorageService;
  /**
   * The real system clock, never shifted by `?dayOffset=`: `lastSeenAt` and the clock-back
   * check must not follow a dev time shift. Game features read the shifted `util/clock.now`.
   */
  realNow: () => number;
  makeInstallId: () => string;
  scheduler: Scheduler;
}

/** One level reached by a run, with what it paid. */
export interface LevelUp {
  level: number;
  reward: LevelReward;
  /** The reward creature was already owned: what was paid instead of it. */
  duplicate: Cost | null;
}

/** What a finished run changed, for the results screen. */
export interface RunSummary {
  /** A new best classic height; the very first run of a player is never a record. */
  isRecord: boolean;
  xpGained: number;
  levelUps: LevelUp[];
}

/** How the save was found at start-up. */
export interface LoadInfo {
  source: SaveSource;
  /** An unreadable text was kept under `save_corrupt_<time>`. */
  corruptKept: boolean;
  /** `lastSeenAt` before this launch, for the clock check. */
  previousSeenAt: number;
}

/**
 * `timeout`: the save was not read in time; `read_failed`: the storage failed to answer. Both
 * run the game on a new in-memory save that is never written, so the real one stays untouched.
 */
export type LoadOutcome =
  (LoadInfo & { status: 'loaded' }) | { status: 'timeout' } | { status: 'read_failed' };

export interface LoadOptions {
  /** Dev `?reset=1`: start from a new save and overwrite the old one. */
  reset?: boolean;
  /** Longest wait for the storage; no limit when omitted. */
  timeoutMs?: number;
}

export type SettingsPatch = Partial<
  Pick<Save['settings'], 'music' | 'sfx' | 'haptics' | 'reducedFx' | 'lang'>
>;

/**
 * Debug override of the hints, for the current page load only (never saved):
 * `fresh` shows every hint again, `off` counts every hint as shown.
 */
type HintOverride = 'fresh' | 'off' | null;

/**
 * The only owner of the save while the game runs (docs/08-architecture.md, section 5): the
 * rest of the game reads it here and changes it through these methods. Every change marks it
 * dirty; the write follows `SAVE_WRITE_DEBOUNCE_MS` later, or at once on `flush()`.
 */
export class GameState {
  private save: Save;
  private dirty = false;
  private timer: unknown = null;
  /** The text last written to `save`; it becomes the backup of the next write. */
  private lastWritten: string | null = null;
  private previousSeenAt: number;
  /** False after a load timeout: nothing goes to the storage, so the unread save cannot be overwritten. */
  private persist = true;
  private hintOverride: HintOverride = null;
  private readonly overrideSeen = new Set<HintId>();

  constructor(private readonly deps: GameStateDeps) {
    const nowMs = deps.realNow();
    this.save = createDefaultSave(nowMs, deps.makeInstallId());
    this.previousSeenAt = nowMs;
  }

  /**
   * Reads the save: `save`, then `save_backup`, then a new one. An unreadable text is kept as
   * `save_corrupt_<time>`. Never throws. A key that cannot be read (as opposed to one that is
   * missing) means a new save for this session that is never written: the real one may be fine.
   * When `timeoutMs` passes first the result is `timeout`: the state stays a new in-memory save,
   * nothing is written for the rest of this page load, and a read that ends later is dropped.
   */
  async load({ reset = false, timeoutMs }: LoadOptions = {}): Promise<LoadOutcome> {
    if (timeoutMs === undefined) return this.readSave(reset);
    let handle: unknown = null;
    const timeout = new Promise<'timeout'>((resolve) => {
      handle = this.deps.scheduler.set(() => resolve('timeout'), timeoutMs);
    });
    const outcome = await Promise.race([this.readSave(reset), timeout]);
    if (outcome === 'timeout') {
      this.persist = false;
      this.clearTimer();
      console.warn(`Save not read after ${timeoutMs} ms: playing without saving this session`);
      return { status: 'timeout' };
    }
    this.deps.scheduler.clear(handle);
    return outcome;
  }

  private async readSave(reset: boolean): Promise<LoadOutcome> {
    const nowMs = this.deps.realNow();
    const { storage } = this.deps;
    let primary: string | null = null;
    let backup: string | null = null;
    if (!reset) {
      try {
        [primary, backup] = await Promise.all([
          storage.get(STORAGE_KEYS.save),
          storage.get(STORAGE_KEYS.backup),
        ]);
      } catch (error) {
        if (!this.persist) return { status: 'timeout' };
        this.persist = false;
        this.clearTimer();
        console.warn('Save could not be read: playing without saving this session', error);
        return { status: 'read_failed' };
      }
    }
    // A read that finished after the timeout must not swap the state or touch the storage.
    if (!this.persist) return { status: 'timeout' };
    const result = loadSave(primary, backup, nowMs, this.deps.makeInstallId);
    let corruptKept = result.corrupt.length > 0;
    for (const { key, text } of result.corrupt) {
      const suffix = key === 'backup' ? STORAGE_KEYS.corruptBackupSuffix : '';
      const kept = await storage
        .set(`${STORAGE_KEYS.corruptPrefix}${nowMs}${suffix}`, text)
        .then(() => true)
        .catch(() => false);
      corruptKept &&= kept;
    }
    if (reset) await storage.remove(STORAGE_KEYS.backup).catch(() => undefined);
    if (!this.persist) return { status: 'timeout' };
    this.save = result.save;
    this.previousSeenAt = result.save.lastSeenAt;
    this.lastWritten =
      result.source === 'primary' ? primary : result.source === 'backup' ? backup : null;
    this.touch(nowMs);
    this.markDirty();
    if (reset) this.flush();
    return {
      status: 'loaded',
      source: result.source,
      corruptKept,
      previousSeenAt: this.previousSeenAt,
    };
  }

  // --- Reading ---

  /** Read-only view of the save; do not keep it, it is replaced on every change. */
  get data(): Readonly<Save> {
    return this.save;
  }

  get coins(): number {
    return this.save.coins;
  }

  get berries(): number {
    return this.save.berries;
  }

  get wallet(): Wallet {
    return { coins: this.save.coins, berries: this.save.berries };
  }

  get settings(): Readonly<Save['settings']> {
    return this.save.settings;
  }

  /** The clock is behind the last launch by more than the tolerance (docs/09-services-analytics.md, section 9). */
  get clockBehind(): boolean {
    return clockWentBack(this.deps.realNow(), this.save.lastSeenAt);
  }

  /** Best classic height to beat in the current run; `null` before the first run ever ends. */
  get recordHeight(): number | null {
    return this.save.stats.runs === 0 ? null : this.save.records.classicHeight;
  }

  // --- Runs ---

  /**
   * Registers a finished run: stats, records, the coins of the run, XP and the level rewards.
   * Berries are not touched here: they were added the moment they were earned (`addBerries`).
   * `startHeight` is the checkpoint a run began from; those layers earn no XP.
   */
  recordRun(result: RunResult, startHeight = 0): RunSummary {
    const before = this.save;
    const isRecord =
      result.mode === 'classic' &&
      before.stats.runs > 0 &&
      result.height > before.records.classicHeight;
    const xpGained = xpForRun(result.height, startHeight);
    const progress = addXp(before.bakerLevel, before.bakerXp, xpGained);
    let next: Save = {
      ...earn(before, { coins: result.coins }),
      bakerLevel: progress.level,
      bakerXp: progress.xp,
      stats: {
        ...before.stats,
        runs: before.stats.runs + 1,
        totalLayers: before.stats.totalLayers + xpGained,
        perfects: before.stats.perfects + Math.max(0, Math.floor(result.perfects)),
      },
      tutorial: { ...before.tutorial, firstRunDone: true },
    };
    if (result.mode === 'classic') {
      next = {
        ...next,
        records: {
          classicHeight: Math.max(before.records.classicHeight, result.height),
          classicScore: Math.max(before.records.classicScore, result.score),
          bestCombo: Math.max(before.records.bestCombo, result.bestCombo),
        },
      };
    }
    const levelUps: LevelUp[] = [];
    for (const level of progress.levelsGained) {
      const reward = levelReward(level);
      const applied = applyLevelReward(next, reward);
      next = applied.value;
      levelUps.push({ level, reward, duplicate: applied.duplicate });
    }
    this.replace(next);
    return { isRecord, xpGained, levelUps };
  }

  // --- Wallet ---

  /** Berries go in the moment they are earned, so they can pay for the continue of the same run. */
  addBerries(berries: number): void {
    const whole = Math.floor(berries);
    if (!(whole > 0)) return;
    this.replace({ ...this.save, berries: this.save.berries + whole });
  }

  /** Pays `cost`; false (nothing taken) when the wallet is not enough. A balance never goes below zero. */
  spend(cost: Cost): boolean {
    const paid = spend(this.save, cost);
    if (!paid) return false;
    this.replace(paid);
    return true;
  }

  spendBerries(berries: number): boolean {
    return berries >= 0 && this.spend({ berries });
  }

  canAffordBerries(berries: number): boolean {
    return berries >= 0 && this.save.berries >= berries;
  }

  // --- Hints ---

  /**
   * Called when a run starts: true when it is the tutorial run. The tutorial stays pending
   * (restarts included) until the director marks it done. `force` comes from `?tutorial=` and
   * holds for this page load only, nothing of it is saved: `true` shows every hint fresh on
   * every run, `false` counts every hint as shown.
   */
  beginRun(force?: boolean): boolean {
    if (force === true) {
      this.hintOverride = 'fresh';
      this.overrideSeen.clear();
    } else if (force === false) {
      this.hintOverride = 'off';
    }
    return !this.hasHint('tutorial');
  }

  hasHint(id: HintId): boolean {
    if (this.hintOverride === 'off') return true;
    if (this.hintOverride === 'fresh') return this.overrideSeen.has(id);
    return this.save.tutorial.hintsShown.includes(id);
  }

  markHint(id: HintId): void {
    if (this.hintOverride === 'fresh') {
      this.overrideSeen.add(id);
      return;
    }
    if (this.hintOverride === 'off' || this.save.tutorial.hintsShown.includes(id)) return;
    this.replace({
      ...this.save,
      tutorial: { ...this.save.tutorial, hintsShown: [...this.save.tutorial.hintsShown, id] },
    });
  }

  // --- Settings ---

  updateSettings(patch: SettingsPatch): void {
    this.replace({ ...this.save, settings: { ...this.save.settings, ...patch } });
  }

  // --- Writing ---

  /** Writes now if anything changed. Also called when the page goes to the background. */
  flush(): void {
    this.clearTimer();
    if (!this.dirty || !this.persist) return;
    this.dirty = false;
    this.touch(this.deps.realNow());
    const text = serializeSave(this.save);
    const previous = this.lastWritten;
    this.lastWritten = text;
    const { storage } = this.deps;
    // Both calls start at once (no await in between): a page that is closing still gets them out.
    const writes = [
      previous === null ? Promise.resolve() : storage.set(STORAGE_KEYS.backup, previous),
      storage.set(STORAGE_KEYS.save, text),
    ];
    Promise.all(writes).catch((error: unknown) => {
      console.warn('Saving failed', error);
      if (this.lastWritten === text) this.lastWritten = previous;
      // Try again later, but not in a tight loop while the storage keeps failing.
      this.markDirty(SAVE_RETRY_MS);
    });
  }

  private replace(next: Save): void {
    this.save = next;
    this.markDirty();
  }

  private markDirty(delayMs: number = SAVE_WRITE_DEBOUNCE_MS): void {
    this.dirty = true;
    if (!this.persist) return;
    this.timer ??= this.deps.scheduler.set(() => {
      this.timer = null;
      this.flush();
    }, delayMs);
  }

  private clearTimer(): void {
    if (this.timer === null) return;
    this.deps.scheduler.clear(this.timer);
    this.timer = null;
  }

  /** `lastSeenAt` only moves forward: a clock set back must not hide the set-back. */
  private touch(nowMs: number): void {
    if (nowMs > this.save.lastSeenAt) this.save = { ...this.save, lastSeenAt: nowMs };
  }
}

/** Coins and berries of a level reward, and the creature it hands over (or its compensation). */
function applyLevelReward(
  save: Save,
  reward: LevelReward,
): { value: Save; duplicate: Cost | null } {
  const paid = earn(save, { coins: reward.coins, berries: reward.berries });
  if (reward.creature === undefined) return { value: paid, duplicate: null };
  return grantCreature(paid, reward.creature);
}
