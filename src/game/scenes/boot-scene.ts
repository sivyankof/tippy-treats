import * as Phaser from 'phaser';
import { createFxTextures } from '../fx/fx-textures';
import { loadFaceTextures } from '../objects/face-textures';
import { SCENES } from '../scene-keys';

/** Prepares shared textures, then starts the run and its HUD. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  preload(): void {
    loadFaceTextures(this);
  }

  create(): void {
    createFxTextures(this);
    this.scene.launch(SCENES.hud);
    this.scene.start(SCENES.game);
  }
}
