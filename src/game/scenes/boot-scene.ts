import * as Phaser from 'phaser';
import { COLORS, FONT_FAMILY, FONT_WEIGHT } from '../config';

const TITLE = 'Tippy Treats';
const TITLE_SIZE = 120;
const INFO_SIZE = 48;
const EDGE_MARGIN = 96;

/** Skeleton scene: proves that the engine, the font and the scaling work. */
export class BootScene extends Phaser.Scene {
  private title!: Phaser.GameObjects.Text;
  private fps!: Phaser.GameObjects.Text;
  private sizeInfo!: Phaser.GameObjects.Text;

  constructor() {
    super('boot');
  }

  create(): void {
    this.title = this.add
      .text(0, 0, TITLE, {
        fontFamily: FONT_FAMILY,
        fontStyle: FONT_WEIGHT.black,
        fontSize: TITLE_SIZE,
        color: COLORS.textPrimary,
      })
      .setOrigin(0.5);

    const infoStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
      fontStyle: FONT_WEIGHT.extraBold,
      fontSize: INFO_SIZE,
      color: COLORS.textSecondary,
    };
    this.fps = this.add.text(0, 0, '', infoStyle).setOrigin(0.5, 0);
    this.sizeInfo = this.add.text(0, 0, '', infoStyle).setOrigin(0.5, 1);

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
  }

  override update(): void {
    this.fps.setText(`${Math.round(this.game.loop.actualFps)} FPS`);
  }

  private layout(): void {
    const { width, height } = this.scale.gameSize;
    this.title.setPosition(width / 2, height / 2);
    this.fps.setPosition(width / 2, EDGE_MARGIN);
    this.sizeInfo.setPosition(width / 2, height - EDGE_MARGIN).setText(`${width} × ${height}`);
  }
}
