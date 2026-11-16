import type { EffectLevel } from './effect-levels';

/** Logical screen: fixed width, height follows the device proportions. */
export const LOGICAL_SIZE = {
  width: 1080,
  minHeight: 1920,
  maxHeight: 2520,
} as const;

/** Most canvas pixels per CSS pixel at each effects level (a device with fewer pixels is not changed). */
export const RENDER_DENSITY = {
  capByLevel: { full: 2, lite: 1.75, minimal: 1.5 } satisfies Record<EffectLevel, number>,
} as const;
