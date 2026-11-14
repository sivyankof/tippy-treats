import { services } from '../services';
import { gameState } from '../state';
import { effectsMode } from './effects-mode';

/** Puts the saved settings into the services and the effects mode; called once at start-up. */
export function applySavedSettings(): void {
  const { sfx, haptics, reducedFx } = gameState.settings;
  services.audio.setEnabled(sfx);
  services.haptics.setEnabled(haptics);
  effectsMode.setChoice(reducedFx);
}

/** The sound switch of the pause window: the service follows at once, the save with its delay. */
export function setSoundOn(on: boolean): void {
  services.audio.setEnabled(on);
  gameState.updateSettings({ sfx: on });
}

export function setVibrationOn(on: boolean): void {
  services.haptics.setEnabled(on);
  gameState.updateSettings({ haptics: on });
}

/** A tap on the "fewer effects" switch is the player's own choice, so it wins over `auto`. */
export function setReducedFxOn(on: boolean): void {
  const setting = on ? 'on' : 'off';
  effectsMode.setChoice(setting);
  gameState.updateSettings({ reducedFx: setting });
}
