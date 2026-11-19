import * as Phaser from 'phaser';
import { MENU } from '../../../data/common/menu-layout';
import { attachPressFeedback, type PressFeedback } from '../button';
import { fitText } from '../menu/fit-text';
import { createOutlinedText } from '../outlined-text';
import { createVolumeImage, faceOffsetY, lookOf } from './volume';

const cfg = MENU.style.toggle;

export interface ToggleSwitchOptions {
  /** What the switch turns on and off, such as "Sounds". */
  label: string;
  /** Width of the whole row: the label on the left, the switch at the right end. */
  width: number;
  /** Reads the setting. */
  read: () => boolean;
  /** Writes the setting; the switch then shows what `read` gives. */
  write: (on: boolean) => void;
}

/** The track of the switch in one colour, centred on the face of its body. */
function createTrack(scene: Phaser.Scene, fill: number): Phaser.GameObjects.Image {
  const look = lookOf('chip', cfg.trackHeight / 2);
  const key = `ui_toggle_track_${cfg.trackWidth}_${fill.toString(16)}`;
  return createVolumeImage(scene, key, cfg.trackWidth, cfg.trackHeight, look, { fill });
}

/**
 * An on/off setting of the style kit: the label on the left and a glossy track with a round knob
 * on the right. The track is green when on and grey when off, and the knob slides to its end, so
 * the state never rests on colour alone. A tap anywhere on the row flips the setting.
 *
 *   const sound = new ToggleSwitch(scene, 0, y, { label: t('run.sounds'), width, read, write });
 *   sound.refresh(); // after the setting changed elsewhere
 */
export class ToggleSwitch extends Phaser.GameObjects.Container {
  private readonly onTrack: Phaser.GameObjects.Image;
  private readonly offTrack: Phaser.GameObjects.Image;
  private readonly knob: Phaser.GameObjects.Image;
  private readonly hitArea: Phaser.Geom.Rectangle;
  private readonly press: PressFeedback;
  private readonly trackX: number;
  private shownOn: boolean | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly options: ToggleSwitchOptions,
  ) {
    super(scene, x, y);
    const { width } = options;
    this.trackX = width / 2 - cfg.trackWidth / 2;
    const label = createOutlinedText(scene, -width / 2, 0, options.label, cfg.font).setOrigin(
      0,
      0.5,
    );
    fitText(label, width - cfg.trackWidth - cfg.labelGap);
    this.onTrack = createTrack(scene, cfg.onFill).setX(this.trackX);
    this.offTrack = createTrack(scene, cfg.offFill).setX(this.trackX);
    const knobSize = cfg.trackHeight - cfg.knobInset * 2;
    this.knob = createVolumeImage(
      scene,
      `ui_toggle_knob_${knobSize}`,
      knobSize,
      knobSize,
      lookOf('button', knobSize / 2, 0),
      { fill: cfg.knobFill },
    ).setY(faceOffsetY('chip'));
    this.add([label, this.offTrack, this.onTrack, this.knob]);

    // Container hit areas are measured from the top-left corner of its size.
    this.hitArea = new Phaser.Geom.Rectangle(0, 0, width, cfg.height);
    this.setSize(width, cfg.height);
    this.setInteractive(this.hitArea, Phaser.Geom.Rectangle.Contains);
    this.press = attachPressFeedback(this, {
      onTap: () => {
        options.write(!options.read());
        this.show(true);
      },
    });
    scene.add.existing(this);
    this.refresh();
  }

  /** Shows the current state of the setting at once. */
  refresh(): this {
    this.show(false);
    return this;
  }

  /** A disabled switch ignores the pointer. */
  setEnabled(enabled: boolean): this {
    this.press.cancel();
    if (enabled) this.setInteractive(this.hitArea, Phaser.Geom.Rectangle.Contains);
    else this.disableInteractive();
    return this;
  }

  private show(animate: boolean): void {
    const on = this.options.read();
    if (on === this.shownOn && !animate) return;
    this.shownOn = on;
    this.onTrack.setVisible(on);
    this.offTrack.setVisible(!on);
    const travel = cfg.trackWidth / 2 - cfg.trackHeight / 2;
    const x = this.trackX + (on ? travel : -travel);
    this.scene.tweens.killTweensOf(this.knob);
    if (!animate) {
      this.knob.setX(x);
      return;
    }
    this.scene.tweens.add({
      targets: this.knob,
      x,
      duration: cfg.slideMs,
      ease: cfg.slideEase,
    });
  }
}
