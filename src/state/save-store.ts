// Persistence of the save: load with timeout, debounced write, backup, retry and the clock touch.
import { createDefaultSave } from '../core/save/defaults';
import { loadSave, serializeSave, type SaveSource } from '../core/save/load';
import type { Save } from '../core/save/schema';
import { SAVE_RETRY_MS, SAVE_WRITE_DEBOUNCE_MS, STORAGE_KEYS } from '../data/storage';
import type { StorageService } from '../services/storage/types';

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
  /**
   * The game clock (`util/clock.now`, shifted by `?dayOffset=` in dev): the local day of a run,
   * the streak, the missions. Tests pass their own; the game uses the default.
   */
  now?: () => number;
  makeInstallId: () => string;
  scheduler: Scheduler;
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

/**
 * Holds the current save and moves it to and from the storage. Every `replace` marks it dirty;
 * the write follows `SAVE_WRITE_DEBOUNCE_MS` later, or at once on `flush()`.
 */
export class SaveStore {
  private current: Save;
  private dirty = false;
  private timer: unknown = null;
  /** The text last written to `save`; it becomes the backup of the next write. */
  private lastWritten: string | null = null;
  private previousSeenAt: number;
  /** False after a load timeout: nothing goes to the storage, so the unread save cannot be overwritten. */
  private persist = true;

  constructor(private readonly deps: GameStateDeps) {
    const nowMs = deps.realNow();
    this.current = createDefaultSave(nowMs, deps.makeInstallId());
    this.previousSeenAt = nowMs;
  }

  get save(): Save {
    return this.current;
  }

  /** Swaps in the changed save and schedules its write. */
  replace(next: Save): void {
    this.current = next;
    this.markDirty();
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
    this.current = result.save;
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

  /** Writes now if anything changed. Also called when the page goes to the background. */
  flush(): void {
    this.clearTimer();
    if (!this.dirty || !this.persist) return;
    this.dirty = false;
    this.touch(this.deps.realNow());
    const text = serializeSave(this.current);
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
    if (nowMs > this.current.lastSeenAt) this.current = { ...this.current, lastSeenAt: nowMs };
  }
}
