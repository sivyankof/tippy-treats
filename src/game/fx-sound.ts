import type { SoundArgs, SoundId } from '../services/audio/sound-args';
import { services } from '../services';
import { fxGuard } from './fx-guard';

/**
 * Plays a registry sound from a decorative effect: through the guard, so a failing sound skips
 * itself and the effect goes on (the audio service never throws either; this keeps the rule that
 * every effect call is named). Core code and screens call `services.audio` directly.
 */
export function playFx<K extends SoundId>(id: K, ...args: SoundArgs[K]): void {
  fxGuard.run(`sound ${id}`, () => services.audio.play(id, ...args));
}
