import * as Phaser from 'phaser';
import { createFaceTextures } from '../objects/face-textures';
import { SCENES } from '../scene-keys';

/** Prepares shared textures, then starts the run and its HUD. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    createFaceTextures(this);
    this.scene.launch(SCENES.hud);
    this.scene.start(SCENES.game);
  }
}
