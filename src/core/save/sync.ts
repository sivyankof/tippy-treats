// The "progress changed since the cloud copy" flag of the save (docs/08-architecture.md, section 5).
import type { Save } from './schema';

/** The `sync` of a device that never sent or took a cloud copy: its progress counts as changed. */
export const NEVER_SYNCED: Readonly<Save['sync']> = { cloudRev: 0, cloudId: '', dirty: true };

/** The save after a change of the progress: `sync.dirty` is set (the same save when it already is). */
export function withProgressChanged(save: Save): Save {
  return save.sync.dirty ? save : { ...save, sync: { ...save.sync, dirty: true } };
}
