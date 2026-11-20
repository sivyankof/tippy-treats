import { readDebugParams } from './debug-params';
import { applyDayOffset } from './calendar';

/** The system clock, never shifted: for what must stay true to the device (`lastSeenAt`, the clock-back check). */
export function realNow(): number {
  return Date.now();
}

/** The one time source of the game: the system clock, shifted by `?dayOffset=` in dev builds. */
export function now(): number {
  const offset = typeof window === 'undefined' ? 0 : (readDebugParams().dayOffset ?? 0);
  return applyDayOffset(Date.now(), offset);
}
