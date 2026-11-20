import { ignore } from '../common/fire-and-forget';
import { ImpactStyle, NotificationType } from '@capacitor/haptics';
import { HAPTICS } from '../../data/app/haptics';
import { SwitchableHaptics } from './switchable';
import type { HapticKind } from './types';

/** What the game needs of `@capacitor/haptics` (injected, so tests run without the app). */
export interface HapticsPlugin {
  impact(options: { style: ImpactStyle }): Promise<void>;
  notification(options: { type: NotificationType }): Promise<void>;
  selectionStart(): Promise<void>;
  selectionChanged(): Promise<void>;
  selectionEnd(): Promise<void>;
}

type Schedule = (run: () => void, delayMs: number) => unknown;

const IMPACT: Partial<Record<HapticKind, ImpactStyle>> = {
  light: ImpactStyle.Light,
  medium: ImpactStyle.Medium,
  heavy: ImpactStyle.Heavy,
};

const NOTIFICATION: Partial<Record<HapticKind, NotificationType>> = {
  success: NotificationType.Success,
  error: NotificationType.Error,
};

/** How many medium hits the record series has (docs/06, section 8). */
const TRIPLE_HITS = 3;

/**
 * The system haptics of the phone (docs/06-art-animation-audio.md, section 8): impacts, the
 * success and error notifications, the selection tick of buttons and the record series of three
 * medium hits `HAPTICS.tripleGap` ms apart. A failing call is dropped.
 */
export class NativeHaptics extends SwitchableHaptics {
  constructor(
    private readonly plugin: HapticsPlugin,
    private readonly schedule: Schedule = (run, delayMs) => setTimeout(run, delayMs),
  ) {
    super();
  }

  protected emit(kind: HapticKind): void {
    const impact = IMPACT[kind];
    if (impact) {
      this.plugin.impact({ style: impact }).catch(ignore);
      return;
    }
    const notification = NOTIFICATION[kind];
    if (notification) {
      this.plugin.notification({ type: notification }).catch(ignore);
      return;
    }
    if (kind === 'selection') {
      // iOS ticks only between a start and an end of a selection.
      this.plugin
        .selectionStart()
        .then(() => this.plugin.selectionChanged())
        .then(() => this.plugin.selectionEnd())
        .catch(ignore);
      return;
    }
    // 'triple': the record series.
    for (let hit = 0; hit < TRIPLE_HITS; hit++) {
      this.schedule(() => {
        if (this.enabled) this.plugin.impact({ style: ImpactStyle.Medium }).catch(ignore);
      }, hit * HAPTICS.tripleGap);
    }
  }
}
