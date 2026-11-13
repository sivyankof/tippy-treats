import * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { MENU_BUTTON } from '../../data/hud-layout';
import { PALETTE } from '../../data/palette';
import { services } from '../../services';
import { bakeTexture } from './bake-texture';
import { createOutlinedText } from './outlined-text';

export interface ButtonOptions {
  /** Centre of the button on screen. */
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  fill: number;
  shadowColor: number;
  shadowOffset: number;
  /** Key of the baked face texture. Buttons with the same look share one key. */
  textureKey: string;
  /** Extra art on the face; (0, 0) is the top-left corner of the face. */
  decorate?: (g: Phaser.GameObjects.Graphics, width: number, height: number) => void;
  /** Label or icon placed on the centre of the face. */
  content?: Phaser.GameObjects.GameObject;
  onClick: () => void;
}

/** Size and look of a text button: the shape fields of MENU_BUTTON and TOGGLE_BUTTON. */
export interface LabelButtonLayout {
  width: number;
  height: number;
  radius: number;
  shadowOffset: number;
}

/**
 * A text button with a dark drop shadow. `keyPrefix` names the baked face together with the
 * fill, so buttons of different sizes never share a texture.
 */
export function createLabelButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: Phaser.GameObjects.Text,
  fill: number,
  layout: LabelButtonLayout,
  keyPrefix: string,
  onClick: () => void,
): Button {
  const { width, height, radius, shadowOffset } = layout;
  return new Button(scene, {
    x,
    y,
    width,
    height,
    radius,
    fill,
    shadowColor: PALETTE.textDark,
    shadowOffset,
    textureKey: `${keyPrefix}_${fill.toString(16)}`,
    content: label,
    onClick,
  });
}

/** The big text button of the pause and results screens. */
export function createMenuButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  fill: number,
  onClick: () => void,
): Button {
  const label = createOutlinedText(scene, 0, 0, text, MENU_BUTTON.font);
  return createLabelButton(scene, x, y, label, fill, MENU_BUTTON, 'ui_menu_button', onClick);
}

/**
 * Rounded button with a drop shadow and press feedback. A click counts only when
 * the press started on the button and the pointer is still over it on release.
 */
export class Button extends Phaser.GameObjects.Container {
  private pressed = false;
  private readonly hitArea: Phaser.Geom.Rectangle;

  constructor(scene: Phaser.Scene, options: ButtonOptions) {
    super(scene, options.x, options.y);
    const { width, height, shadowOffset } = options;

    bakeTexture(scene, options.textureKey, width, height + shadowOffset, (g) => {
      g.fillStyle(options.shadowColor, 1).fillRoundedRect(
        0,
        shadowOffset,
        width,
        height,
        options.radius,
      );
      g.fillStyle(options.fill, 1).fillRoundedRect(0, 0, width, height, options.radius);
      options.decorate?.(g, width, height);
    });
    const face = new Phaser.GameObjects.Image(scene, 0, -height / 2, options.textureKey).setOrigin(
      0.5,
      0,
    );
    this.add(face);
    if (options.content) this.add(options.content);

    // Container hit areas are measured from the top-left corner of its size.
    this.hitArea = new Phaser.Geom.Rectangle(0, 0, width, height);
    this.setSize(width, height);
    this.setInteractive(this.hitArea, Phaser.Geom.Rectangle.Contains);

    this.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.pressed = true;
      this.pressTo(ANIM.ui.pressScale);
    });
    this.on(Phaser.Input.Events.POINTER_OUT, () => {
      this.pressed = false;
      this.pressTo(1);
    });
    this.on(Phaser.Input.Events.POINTER_UP, () => {
      if (!this.pressed) return;
      this.pressed = false;
      this.release();
      options.onClick();
      // After the action, so a toggle that was just switched on confirms itself.
      services.audio.click();
      services.haptics.play('selection');
    });
    scene.add.existing(this);
  }

  /** A disabled button ignores the pointer. */
  setEnabled(enabled: boolean): this {
    this.pressed = false;
    if (enabled) this.setInteractive(this.hitArea, Phaser.Geom.Rectangle.Contains);
    else this.disableInteractive();
    return this;
  }

  private pressTo(scale: number): void {
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({ targets: this, scale, duration: ANIM.ui.pressMs });
  }

  /** A click pops the button slightly past its size and lets it settle back. */
  private release(): void {
    this.scene.tweens.killTweensOf(this);
    this.setScale(ANIM.ui.releaseScale);
    this.scene.tweens.add({
      targets: this,
      scale: 1,
      duration: ANIM.ui.releaseMs,
      ease: ANIM.ui.releaseEase,
    });
  }
}
