import * as Phaser from 'phaser';
import { SCENES } from '../scene-keys';

/** Calls `call` once, after the first frame of a screen of the game (not of the boot scene); returns the function that calls it at once instead. */
export function onFirstScreen(game: Phaser.Game, call: () => void): () => void {
  let called = false;
  function shown(): void {
    const screen = game.scene.getScenes(true).some((scene) => scene.scene.key !== SCENES.boot);
    if (screen) now();
  }
  function now(): void {
    if (called) return;
    called = true;
    game.events.off(Phaser.Core.Events.POST_RENDER, shown);
    call();
  }
  game.events.on(Phaser.Core.Events.POST_RENDER, shown);
  return now;
}
