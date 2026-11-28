// The cloud copy of the save as pure rules (docs/08-architecture.md, section 5, "Облачная копия"):
// reading its text, the merge table and the next copy to send.
import { CLOUD } from '../../data/app/cloud';
import { createDefaultSave } from './defaults';
import { readStoredSave } from './load';
import { SAVE_VERSION, type Save } from './schema';

/** One copy of the save in the cloud. */
export interface CloudCopy {
  /** Number of the write; a new one gets `max(cloud.rev, sync.cloudRev) + 1`. */
  rev: number;
  /** Random, new on every write: two devices offline may both write the same `rev`. */
  id: string;
  /** Ids of the copies this one grew from, newest last, at most `CLOUD.lineageKeep`. */
  lineage: string[];
  /** `installId` of the device that wrote it. */
  writer: string;
  /** Epoch ms of the write. */
  savedAt: number;
  save: Save;
}

/**
 * What the cloud holds: nothing; a copy this game can use (an older save version already
 * migrated); a copy of a newer game version; or a text that cannot be used.
 */
export type CloudRead =
  | { kind: 'empty' }
  | { kind: 'copy'; copy: CloudCopy }
  | { kind: 'newer'; version: number }
  | { kind: 'unusable' };

/** A cloud the merge table can decide on: anything but an unusable text. */
export type UsableCloud = Exclude<CloudRead, { kind: 'unusable' }>;

type Obj = Record<string, unknown>;

const isObj = (value: unknown): value is Obj =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

/**
 * Reads the text of the cloud copy. Anything that is not a whole copy (no JSON, a missing or
 * wrongly typed field, a save without its key fields) is `unusable`: it is neither taken nor
 * written over. `nowMs` is the time of the read, for the migrations.
 */
export function readCloudText(text: string | null, nowMs: number): CloudRead {
  if (text === null || text === '') return { kind: 'empty' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { kind: 'unusable' };
  }
  if (!isObj(raw)) return { kind: 'unusable' };
  const { rev, id, lineage, writer, savedAt, save } = raw;
  if (
    !isCount(rev) ||
    rev < 1 ||
    typeof id !== 'string' ||
    id === '' ||
    !Array.isArray(lineage) ||
    !lineage.every((entry) => typeof entry === 'string') ||
    typeof writer !== 'string' ||
    !isCount(savedAt) ||
    !isObj(save)
  ) {
    return { kind: 'unusable' };
  }
  const version = save.version;
  if (typeof version === 'number' && Number.isInteger(version) && version > SAVE_VERSION) {
    return { kind: 'newer', version };
  }
  try {
    // The defaults only fill gaps of a damaged copy, which is refused below anyway.
    const parsed = readStoredSave(save, createDefaultSave(nowMs, writer || 'cloud'), nowMs);
    if (!parsed.intact) return { kind: 'unusable' };
    const ids = (lineage as string[]).filter((entry) => entry !== '');
    return { kind: 'copy', copy: { rev, id, lineage: ids, writer, savedAt, save: parsed.save } };
  } catch {
    return { kind: 'unusable' };
  }
}

/**
 * What to do with the cloud: `blocked` (a newer game wrote it: neither take nor write);
 * `send` the local save; `wait` before the first write; `none`; `adopt` the copy silently;
 * `found` (the "Progress found" window); `choose` (the window with both saves).
 */
export type CloudDecision =
  | { kind: 'blocked' }
  | { kind: 'send' }
  | { kind: 'wait' }
  | { kind: 'none' }
  | { kind: 'adopt'; copy: CloudCopy }
  | { kind: 'found'; copy: CloudCopy }
  | { kind: 'choose'; copy: CloudCopy };

/**
 * Next to nothing here that a player would miss: never synced, baker level 1, at most
 * `CLOUD.almostEmptyRuns` runs, nothing bought.
 */
export function almostEmpty(save: Save): boolean {
  return (
    save.sync.cloudRev === 0 &&
    save.bakerLevel === 1 &&
    save.stats.runs <= CLOUD.almostEmptyRuns &&
    !save.purchases.removeAds &&
    !save.purchases.starterPack &&
    save.iap.processedTx.length === 0
  );
}

/**
 * The merge table, rows tested from the top. An unusable cloud text never reaches it (the
 * caller keeps away from the cloud then); an older save version was migrated by `readCloudText`.
 */
export function decide(local: Save, cloud: UsableCloud): CloudDecision {
  if (cloud.kind === 'newer') return { kind: 'blocked' };
  const { sync } = local;
  if (cloud.kind === 'empty') return sync.cloudRev > 0 ? { kind: 'send' } : { kind: 'wait' };
  const { copy } = cloud;
  if (copy.id === sync.cloudId) return sync.dirty ? { kind: 'send' } : { kind: 'none' };
  if (sync.cloudId !== '' && copy.lineage.includes(sync.cloudId) && !sync.dirty) {
    return { kind: 'adopt', copy };
  }
  if (almostEmpty(local)) return { kind: 'found', copy };
  return { kind: 'choose', copy };
}

/**
 * The first write of a device that never synced, over an empty cloud, waits for the store's
 * first change notification or until the save is `CLOUD.firstWriteWaitMs` old.
 */
export function firstWriteDue(save: Save, notified: boolean, nowMs: number): boolean {
  return notified || nowMs - save.createdAt >= CLOUD.firstWriteWaitMs;
}

/**
 * The copy that replaces `over` (the copy now in the cloud, or none) with the local save. Its
 * lineage keeps what `over` grew from, `over` itself and the copy this device knew, so devices
 * that synced with any of them and changed nothing take it silently.
 */
export function nextCopy(
  local: Save,
  over: CloudCopy | null,
  id: string,
  nowMs: number,
): CloudCopy {
  const rev = Math.max(over?.rev ?? 0, local.sync.cloudRev) + 1;
  const earlier = [...(over?.lineage ?? []), over?.id ?? '', local.sync.cloudId];
  const lineage: string[] = [];
  for (const entry of earlier) {
    if (entry === '' || entry === id) continue;
    const at = lineage.indexOf(entry);
    if (at >= 0) lineage.splice(at, 1);
    lineage.push(entry);
  }
  return {
    rev,
    id,
    lineage: lineage.slice(-CLOUD.lineageKeep),
    writer: local.installId,
    savedAt: nowMs,
    save: { ...local, sync: { cloudRev: rev, cloudId: id, dirty: false } },
  };
}

export function serializeCopy(copy: CloudCopy): string {
  return JSON.stringify(copy);
}
