import type { RunCues } from './run-cues';

/** Moments of a run that are not sim events: the continue window and the record line. */
export type MomentKind = 'offerOpened' | 'timerTick' | 'continued' | 'declined' | 'recordCrossed';

/**
 * Sounds and haptics of a moment. Declining plays nothing of its own: the collapse that
 * follows has its sounds.
 */
export function cuesForMoment(kind: MomentKind): RunCues {
  switch (kind) {
    case 'offerOpened':
      return { sounds: [{ kind: 'click' }], haptics: ['light'] };
    case 'timerTick':
      return { sounds: [{ kind: 'click' }], haptics: ['selection'] };
    case 'continued':
      return { sounds: [{ kind: 'berry' }], haptics: ['success'] };
    case 'recordCrossed':
      // A short blip and a light tap: the fanfare and the triple vibration stay on the results screen.
      return { sounds: [{ kind: 'recordBlip' }], haptics: ['light'] };
    case 'declined':
      return { sounds: [], haptics: [] };
  }
}
