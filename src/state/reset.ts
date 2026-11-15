// Wiping the progress, as a pure function over the save.
import { createDefaultSave } from '../core/save/defaults';
import type { Save } from '../core/save/schema';

/**
 * A new save as at the first launch. The install id and the settings (language, sound,
 * vibration, effects, notifications) stay: they describe the device, not the progress.
 */
export function withProgressReset(save: Save, nowMs: number): Save {
  return { ...createDefaultSave(nowMs, save.installId), settings: save.settings };
}
