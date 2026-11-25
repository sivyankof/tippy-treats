import type { Lang, Save } from '../../core/save/schema';
import { resolveLang, setLang } from '../../i18n';
import { services } from '../../services';
import { gameState } from '../../state';
import { effectsMode } from './effects-mode';
import { askNotifPermission } from './ask-notif-permission';
import { rememberBootPrefs } from './boot/boot-screen-close';

/** Puts the saved settings into the services and the effects mode; called once at start-up. */
export function applySavedSettings(): void {
  const { sfx, music, haptics, reducedFx, lang } = gameState.settings;
  setLang(resolveLang(lang, navigator.languages));
  services.audio.setEnabled(sfx);
  services.audio.setMusicEnabled(music);
  services.haptics.setEnabled(haptics);
  effectsMode.setChoice(reducedFx);
  rememberBootPrefs(lang, reducedFx);
}

/** The sound switch of the pause window: the service follows at once, the save with its delay. */
export function setSoundOn(on: boolean): void {
  services.audio.setEnabled(on);
  gameState.updateSettings({ sfx: on });
}

/** The music switch: the music bus follows at once, the save with its delay. */
export function setMusicOn(on: boolean): void {
  services.audio.setMusicEnabled(on);
  gameState.updateSettings({ music: on });
}

export function setVibrationOn(on: boolean): void {
  services.haptics.setEnabled(on);
  gameState.updateSettings({ haptics: on });
}

/**
 * A tap on the "fewer effects" switch is the player's own choice: it sets the ceiling of the effects level.
 * On: never above lite (the automatic steps may still go lower); off: the automatic steps move over all tiers.
 */
export function setReducedFxOn(on: boolean): void {
  const setting = on ? 'on' : 'off';
  effectsMode.setChoice(setting);
  gameState.updateSettings({ reducedFx: setting });
  rememberBootPrefs(gameState.settings.lang, setting);
}

/** The language switch of the settings: the save and the texts follow at once (`auto` is the system's). */
export function setLanguage(lang: Lang): void {
  gameState.updateSettings({ lang });
  setLang(resolveLang(lang, navigator.languages));
  rememberBootPrefs(lang, gameState.settings.reducedFx);
}

export type NotificationKind = keyof Save['settings']['notifications'];

/** Stores the choice (the plan reads it when the app goes to the background); turning one on asks the system for the permission if the game has none. */
export function setNotificationOn(kind: NotificationKind, on: boolean): void {
  const { notifications } = gameState.settings;
  gameState.updateSettings({ notifications: { ...notifications, [kind]: on } });
  if (on) void askNotifPermission();
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
  if (on) void askNotifPermission();
}
