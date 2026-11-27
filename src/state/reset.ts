// Wiping the progress, as a pure function over the save.
import { createDefaultSave } from '../core/save/defaults';
import type { Save } from '../core/save/schema';

/**
 * A new save as at the first launch. The install id and the settings (language, sound,
 * vibration, effects, notifications) stay: they describe the device, not the progress. So do the
 * store transactions already paid out (a reset never makes the store pay one again) and the
 * rating request (asked once per game version, whatever the progress). The cloud copy the device
 * knows stays too, with the progress marked as changed: otherwise the next launch would offer to
 * bring back what was just wiped.
 */
export function withProgressReset(save: Save, nowMs: number): Save {
  return {
    ...createDefaultSave(nowMs, save.installId),
    settings: save.settings,
    iap: save.iap,
    review: save.review,
    sync: { cloudRev: save.sync.cloudRev, cloudId: save.sync.cloudId, dirty: true },
  };
}
