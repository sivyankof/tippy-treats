import type * as Phaser from 'phaser';
import { BOOT_SCREEN } from '../../../data/app/boot-screen';
import { withBootPrefs, type BootFx, type BootHandle } from '../../../util/boot/boot-screen';
import { onFirstScreen } from './first-screen';

/** What index.html leaves on the window: the boot screen of this page load (src/util/boot/boot-screen.ts). */
type BootWindow = Window & { __tippyBoot?: Pick<BootHandle, 'done'> };

/** The boot screen of index.html dissolves after the first frame of a screen of the game (Home or the tutorial run). */
export function closeBootScreenOnFirstScreen(game: Phaser.Game, win: BootWindow = window): void {
  onFirstScreen(game, () => closeBootScreen(win));
}

/** Lets the boot screen go now (a page with no game screen, such as the sound test page). */
export function closeBootScreen(win: BootWindow = window): void {
  win.__tippyBoot?.done();
}

/**
 * Copies the settings the boot screen needs into its own record: the save loads after the screen
 * is up, so the next cold start reads the language and "fewer effects" from there.
 */
export function rememberBootPrefs(
  lang: Parameters<typeof withBootPrefs>[1],
  fx: BootFx,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(
      BOOT_SCREEN.storageKey,
      withBootPrefs(storage.getItem(BOOT_SCREEN.storageKey), lang, fx),
    );
  } catch {
    // A blocked storage: the next boot screen follows the system instead.
  }
}

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
