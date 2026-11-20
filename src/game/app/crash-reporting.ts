import type * as Phaser from 'phaser';
import { services } from '../../services';
import { CrashReporter, installErrorHandlers } from '../../services/crash/reporter';
import { gameState } from '../../state';
import { fxGuard } from '../common/fx-guard';

let activeScenes: () => string = () => '';

/** The failure reports of this page load (docs/09-services-analytics.md, section 7). */
export const crashReporter = new CrashReporter(services.crash, {
  scene: () => activeScenes(),
  saveVersion: () => gameState.data.version,
});

/**
 * Starts reporting: uncaught errors and unhandled promise rejections of the page, and the
 * decorations `fxGuard` skips, go to Crashlytics as non-fatal reports. Call it first thing at start-up.
 */
export function installCrashReporting(target: Window = window): void {
  installErrorHandlers(target, crashReporter);
  fxGuard.setReporter((name, error) => crashReporter.reportEffect(name, error));
}

/** Tells the reports which scenes are on screen (the run and its HUD show as `game+hud`). */
export function bindCrashScenes(game: Phaser.Game): void {
  activeScenes = () =>
    game.scene
      .getScenes(true)
      .map((scene) => scene.scene.key)
      .join('+');
}
