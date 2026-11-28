import { CLOUD } from '../../data/app/cloud';
import {
  decide,
  firstWriteDue,
  nextCopy,
  readCloudText,
  serializeCopy,
  type CloudCopy,
  type CloudDecision,
  type UsableCloud,
} from '../../core/save/cloud-merge';
import type { Save } from '../../core/save/schema';
import type { CloudSaveService } from '../../services/cloud-save/types';
import type { Scheduler } from '../../state/save-store';

/**
 * What the settings say about the cloud: `unsupported` (no cloud on this platform, no line at
 * all), `off` (iCloud is off), `waiting` (no answer yet, the first write waits, or a choice waits
 * on Home), `saved` (`savedAt` is the last write or take), `update` (a newer game wrote the copy),
 * `error` (a read or write failed, the copy is unusable, or the local save was not read).
 */
export type CloudStatus = 'unsupported' | 'off' | 'waiting' | 'saved' | 'update' | 'error';

/** The part of `GameState` the cloud needs. */
export interface CloudState {
  readonly data: Readonly<Save>;
  readonly progressMark: number;
  adopt(copy: Pick<CloudCopy, 'rev' | 'id' | 'save'>): void;
  markCloudSent(rev: number, id: string, mark: number): void;
  keepReplaced(save: Readonly<Save>): Promise<boolean>;
}

export interface CloudSyncDeps {
  service: CloudSaveService;
  state: CloudState;
  /** The real clock (epoch ms). */
  now: () => number;
  /** A new random id for a copy. */
  newId: () => string;
  scheduler: Scheduler;
  /** True while the cloud must not be touched (a debug writer changed the progress). */
  blocked?: () => boolean;
  /** After a copy was taken: the purchase check. */
  afterAdopt?: () => Promise<void>;
}

/** A decision that needs Home: a silent take or one of the two windows. */
export type HomeDecision = Extract<CloudDecision, { kind: 'adopt' | 'found' | 'choose' }>;

/** What one pass over the cloud may do. */
interface PassOptions {
  /**
   * The player chose the local save over the copy with this id: it goes over the cloud if the
   * cloud still holds that copy (or nothing). A copy that came meanwhile is left for Home to ask again.
   */
  over?: string;
  /** Write now, without waiting for the end of the write interval. */
  immediate?: boolean;
}

/**
 * Keeps the cloud copy in step with the save (docs/08-architecture.md, section 5, "Облачная
 * копия"). Every pass reads the cloud, decides by the merge table and sends the local save when
 * the table says so; a take or a choice is left for Home (`homeDecision`). One pass runs at a
 * time; nothing throws.
 */
export class CloudSync {
  private status_: CloudStatus = 'waiting';
  private savedAt_: number | null = null;
  private readonly listeners = new Set<() => void>();
  private started = false;
  /** When the cloud started in this launch: a save created later counts from here (`firstWriteDue`). */
  private startedAt = 0;
  /** The cloud as last read; null while unknown (never read, or the read failed). */
  private cloud: UsableCloud | null = null;
  private cloudText: string | null = null;
  /** The store sent a change notification in this launch (the first download came). */
  private notified = false;
  private lastWriteAt = Number.NEGATIVE_INFINITY;
  private writeTimer: unknown = null;
  private waitTimer: unknown = null;
  private queue: Promise<void> = Promise.resolve();
  private answered = false;
  private readonly firstAnswer: Promise<void>;
  private answer: () => void = () => undefined;

  constructor(private readonly deps: CloudSyncDeps) {
    this.firstAnswer = new Promise((resolve) => (this.answer = resolve));
  }

  get status(): CloudStatus {
    return this.status_;
  }

  /** Moment of the last write or take of a copy known in this launch; null when none. */
  get savedAt(): number | null {
    return this.savedAt_;
  }

  /** Calls `listener` on every change of the status; returns the unsubscribe. */
  onStatus(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** No cloud this launch: `unsupported` (no cloud here) or `error` (the local save was not read). */
  disable(status: 'unsupported' | 'error'): void {
    this.setStatus(status);
    this.settle();
  }

  /** Starts once, after the local save was read: the first pass, and the remote changes. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.startedAt = this.deps.now();
    this.deps.service.onRemoteChange(() => {
      this.notified = true;
      this.sync();
    });
    this.sync();
  }

  /** Resolves when the first pass gave its answer, or after `timeoutMs`, whichever comes first. */
  waitFirstAnswer(timeoutMs: number): Promise<void> {
    if (this.answered) return Promise.resolve();
    return new Promise((resolve) => {
      const handle = this.deps.scheduler.set(resolve, timeoutMs);
      void this.firstAnswer.then(() => {
        this.deps.scheduler.clear(handle);
        resolve();
      });
    });
  }

  /** A pass: read, decide, send if due. Triggers: a run, a purchase, the background, a remote change. */
  sync(options: PassOptions = {}): Promise<void> {
    if (!this.started) return Promise.resolve();
    this.queue = this.queue
      .then(() => this.pass(options))
      .catch((error: unknown) => {
        console.warn('Cloud pass failed', error);
        this.setStatus('error');
        this.settle();
      });
    return this.queue;
  }

  /**
   * The decision Home has to act on now, by the cloud as last read and the save as it is now;
   * null when there is none (or the cloud is unknown, blocked or off).
   */
  homeDecision(): HomeDecision | null {
    if (!this.started || this.cloud === null || this.deps.blocked?.()) return null;
    if (this.status_ === 'error' || this.status_ === 'off' || this.status_ === 'update')
      return null;
    const decision = decide(this.deps.state.data as Save, this.cloud);
    return decision.kind === 'adopt' || decision.kind === 'found' || decision.kind === 'choose'
      ? decision
      : null;
  }

  /**
   * Takes the copy (silently, or by the player's choice: then the local save is kept aside
   * under `save_replaced_*` first), then the purchase check.
   */
  takeCloud(copy: CloudCopy, keepLocal: boolean): Promise<void> {
    let taken = false;
    // In the queue: a pass on its way never mixes with the take.
    this.queue = this.queue
      .then(async () => {
        const { state } = this.deps;
        if (!keepLocal) {
          // A silent take holds only while nothing changed here since it was decided.
          const now = this.cloud ? decide(state.data as Save, this.cloud) : null;
          if (now?.kind !== 'adopt' || now.copy.id !== copy.id) return;
        } else if (!(await this.inTime(state.keepReplaced(state.data), false))) {
          // The losing save could not be kept: nothing is replaced, and Home asks again.
          return;
        }
        state.adopt(copy);
        taken = true;
        this.cloud = { kind: 'copy', copy };
        this.cloudText = serializeCopy(copy);
        this.setSaved(copy.savedAt);
      })
      .catch((error: unknown) => console.warn('Taking the cloud copy failed', error));
    return this.queue.then(() =>
      taken ? this.deps.afterAdopt?.().catch(() => undefined) : undefined,
    );
  }

  /** The player keeps the local save: the copy's save is kept aside, then the local one goes over the cloud at once. */
  async keepLocal(copy: CloudCopy): Promise<void> {
    // The losing save could not be kept: nothing is written, and Home asks again.
    if (!(await this.inTime(this.deps.state.keepReplaced(copy.save), false))) return;
    await this.sync({ over: copy.id, immediate: true });
  }

  private async pass({ over, immediate = false }: PassOptions): Promise<void> {
    if (this.deps.blocked?.()) return this.settle();
    const { service } = this.deps;
    if (!(await this.inTime(service.available(), false))) {
      this.cloud = null;
      this.setStatus('off');
      return this.settle();
    }
    const text = await this.read();
    if (text === undefined) {
      this.cloud = null;
      this.setStatus('error');
      return this.settle();
    }
    const read = readCloudText(text, this.deps.now());
    if (read.kind === 'unusable') {
      // Never written over: only a fault could leave it, and it may still be someone's progress.
      this.cloud = null;
      this.setStatus('error');
      return this.settle();
    }
    this.cloud = read;
    this.cloudText = text;
    const local = this.deps.state.data as Save;
    const chosen =
      over !== undefined &&
      (read.kind === 'empty' || (read.kind === 'copy' && read.copy.id === over));
    const decision: CloudDecision = chosen ? { kind: 'send' } : decide(local, read);
    switch (decision.kind) {
      case 'blocked':
        this.setStatus('update');
        break;
      case 'none':
        if (read.kind === 'copy') this.setSaved(read.copy.savedAt);
        else this.setStatus('saved');
        break;
      case 'wait':
        if (firstWriteDue(local, this.notified, this.deps.now(), this.startedAt)) {
          await this.send(immediate);
        } else this.waitForFirstWrite(local);
        break;
      case 'send':
        await this.send(immediate);
        break;
      default:
        // A take or a choice: it waits for Home, and nothing is written before it.
        this.setStatus('waiting');
    }
    this.settle();
  }

  /** The cloud now holds the copy `id`. */
  private async landed(id: string): Promise<boolean> {
    const text = await this.read();
    if (text === undefined) return false;
    const read = readCloudText(text, this.deps.now());
    return read.kind === 'copy' && read.copy.id === id;
  }

  /** The cloud text; undefined when the read failed or took too long. */
  private read(): Promise<string | null | undefined> {
    return this.inTime<string | null | undefined>(this.deps.service.read(), undefined);
  }

  /** What `call` gives, or `late` when it fails or takes longer than `CLOUD.readTimeoutMs`: a stuck store never holds the queue. */
  private async inTime<T>(call: Promise<T>, late: T): Promise<T> {
    let handle: unknown = null;
    const timeout = new Promise<T>((resolve) => {
      handle = this.deps.scheduler.set(() => resolve(late), CLOUD.readTimeoutMs);
    });
    try {
      return await Promise.race([call, timeout]);
    } catch {
      return late;
    } finally {
      this.deps.scheduler.clear(handle);
    }
  }

  /** Sends the local save over the cloud as read, now or at the end of the write interval. */
  private async send(immediate: boolean): Promise<void> {
    const nowMs = this.deps.now();
    const dueAt = this.lastWriteAt + CLOUD.writeIntervalMs;
    if (!immediate && nowMs < dueAt) {
      this.writeTimer ??= this.deps.scheduler.set(() => {
        this.writeTimer = null;
        void this.sync();
      }, dueAt - nowMs);
      if (this.status_ !== 'saved' || this.savedAt_ === null) this.setStatus('waiting');
      return;
    }
    const { state, service } = this.deps;
    const local = state.data as Save;
    const over = this.cloud?.kind === 'copy' ? this.cloud.copy : null;
    const mark = state.progressMark;
    const copy = nextCopy(local, over, this.deps.newId(), nowMs);
    const text = serializeCopy(copy);
    if (text.length > CLOUD.maxTextChars) {
      this.setStatus('error');
      return;
    }
    // A copy this device did not write last (another device's, or one it never knew) goes to
    // the second key: a way back by hand.
    const foreign =
      over !== null && (over.writer !== local.installId || over.id !== local.sync.cloudId);
    const previous = foreign && this.cloudText !== null ? this.cloudText : undefined;
    this.lastWriteAt = nowMs;
    // A write that answered late (or not at all) may still have landed: the cloud tells.
    const ok =
      (await this.inTime(service.write(text, previous), false)) || (await this.landed(copy.id));
    if (!ok) {
      this.setStatus('error');
      return;
    }
    state.markCloudSent(copy.rev, copy.id, mark);
    this.cloud = { kind: 'copy', copy };
    this.cloudText = text;
    this.setSaved(copy.savedAt);
  }

  /** The first write of a device that never synced waits; a pass comes again when the wait ends. */
  private waitForFirstWrite(local: Save): void {
    this.setStatus('waiting');
    if (this.waitTimer !== null) return;
    // A save created "in the future" (a clock put back) counts from the start, like `firstWriteDue`.
    const left =
      Math.min(local.createdAt, this.startedAt) + CLOUD.firstWriteWaitMs - this.deps.now();
    this.waitTimer = this.deps.scheduler.set(
      () => {
        this.waitTimer = null;
        void this.sync();
      },
      Math.max(0, left),
    );
  }

  private settle(): void {
    if (this.answered) return;
    this.answered = true;
    this.answer();
  }

  /** A copy was written or taken at `at`: the line moves even when the status stays `saved`. */
  private setSaved(at: number): void {
    const moved = at !== this.savedAt_;
    this.savedAt_ = at;
    if (this.status_ !== 'saved') this.setStatus('saved');
    else if (moved) this.notify();
  }

  private setStatus(next: CloudStatus): void {
    if (next === this.status_) return;
    this.status_ = next;
    this.notify();
  }

  private notify(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch {
        // A status line is a decoration.
      }
    }
  }
}
