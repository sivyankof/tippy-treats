import type { Lang, Save } from '../core/save/schema';
import { resolveLang, setLang } from '../i18n';
import { services } from '../services';
import { gameState } from '../state';
import { effectsMode } from './effects-mode';

/** Puts the saved settings into the services and the effects mode; called once at start-up. */
export function applySavedSettings(): void {
  const { sfx, haptics, reducedFx, lang } = gameState.settings;
  setLang(resolveLang(lang, navigator.languages));
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

/** The language switch of the settings: the save and the texts follow at once (`auto` is the system's). */
export function setLanguage(lang: Lang): void {
  gameState.updateSettings({ lang });
  setLang(resolveLang(lang, navigator.languages));
}

export type NotificationKind = keyof Save['settings']['notifications'];

/** Only stores the choice; the notifications service (M8) reads it. */
export function setNotificationOn(kind: NotificationKind, on: boolean): void {
  const { notifications } = gameState.settings;
  gameState.updateSettings({ notifications: { ...notifications, [kind]: on } });
}

/** The general notifications switch has no field of its own: it is on while any type is on. */
export function notificationsAnyOn(): boolean {
  return Object.values(gameState.settings.notifications).some(Boolean);
}

/** The general switch sets every type. */
export function setAllNotifications(on: boolean): void {
  gameState.updateSettings({
    notifications: { gift: on, streak: on, daily: on, comeback: on },
  });
}
