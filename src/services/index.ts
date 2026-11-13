import { WebAudioService } from './audio/web';
import type { AudioService } from './audio/types';
import type { HapticsService } from './haptics/types';
import { WebHaptics } from './haptics/web';

/** Everything the game asks of the device. Scenes use these and never pick an implementation. */
export interface Services {
  audio: AudioService;
  haptics: HapticsService;
}

/**
 * The single place that picks implementations. Capacitor is not installed yet, so these are
 * the web ones; native haptics chosen by Capacitor.isNativePlatform() arrive in stage M7.
 */
export const services: Services = {
  audio: new WebAudioService(),
  haptics: new WebHaptics(),
};
