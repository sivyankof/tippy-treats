import * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { MENU_BUTTON } from '../../data/hud-layout';
import { PALETTE } from '../../data/palette';
import { services } from '../../services';
import { createGlossBand, sweepGloss } from '../fx/gloss-sweep';
import { bakeTexture } from './bake-texture';
import { fitText } from './menu/fit-text';
import { createOutlinedText } from './outlined-text';
import { bakeVolume, lookOf } from './style/volume';

/**
 * 'flat': the run look, a face over a hard dark shadow. 'volume': the menu look of
 * `style/volume.ts`, a glossy gradient face over a darker bevel, outlined, with a soft shadow.
 */
export type ButtonLook = 'flat' | 'volume';

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
  /** 'flat' when left out. In the 'volume' look `shadowOffset` is the bevel under the face. */
  look?: ButtonLook;
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
  label: Phaser.GameObjects.GameObject,
  fill: number,
  layout: LabelButtonLayout,
  keyPrefix: string,
  onClick: () => void,
  look: ButtonLook = 'flat',
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
    look,
  });
}

export interface TextButtonOptions {
  text: string;
  font: number;
  /** The label shrinks (see `fitText`) to fit this width. */
  maxLabelWidth: number;
  fill: number;
  layout: LabelButtonLayout;
  keyPrefix: string;
  onClick: () => void;
  /** Centre of the button; (0, 0) when left out. */
  x?: number;
  y?: number;
  /** The menu look ('volume') when left out. */
  look?: ButtonLook;
}

/** A label button whose outlined text shrinks to fit, so long Russian labels stay inside. */
export function createTextButton(
  scene: Phaser.Scene,
  options: TextButtonOptions,
): { button: Button; label: Phaser.GameObjects.Text } {
  const label = fitText(
    createOutlinedText(scene, 0, 0, options.text, options.font),
    options.maxLabelWidth,
  );
  const button = createLabelButton(
    scene,
    options.x ?? 0,
    options.y ?? 0,
    label,
    options.fill,
    options.layout,
    options.keyPrefix,
    options.onClick,
    options.look ?? 'volume',
  );
  return { button, label };
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

export interface PressFeedbackOptions {
  /** Resting scale of the target (default 1). */
  baseScale?: () => number;
  /** A press that moves farther than this is cancelled (default: no limit). */
  tolerancePx?: number;
  onTap: () => void;
}

export interface PressFeedback {
  /** Drops a press in progress and lets the target settle back. */
  cancel(): void;
}

/**
 * Press feedback shared by buttons and tappable cards: a press shrinks the target, a release on
 * it pops it past its size, plays the click and haptics and calls `onTap`. The target must be
 * interactive. Only the press tween is replaced: a running screen transition keeps moving it.
 */
export function attachPressFeedback(
  target: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform,
  options: PressFeedbackOptions,
): PressFeedback {
  const { pressScale, pressMs, releaseScale, releaseMs, releaseEase } = ANIM.ui;
  const base = (): number => options.baseScale?.() ?? 1;
  let start: { x: number; y: number } | null = null;
  let tween: Phaser.Tweens.Tween | null = null;
  const tweenScale = (scale: number, duration: number, ease?: string): void => {
    tween?.stop();
    tween = target.scene.tweens.add({ targets: target, scale, duration, ease });
  };
  const cancel = (): void => {
    if (!start) return;
    start = null;
    tweenScale(base(), pressMs);
  };

  target.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
    start = { x: pointer.x, y: pointer.y };
    tweenScale(base() * pressScale, pressMs);
  });
  target.on(Phaser.Input.Events.POINTER_OUT, cancel);
  target.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
    const limit = options.tolerancePx;
    if (
      start &&
      limit !== undefined &&
      Math.hypot(pointer.x - start.x, pointer.y - start.y) > limit
    )
      cancel();
  });
  target.on(Phaser.Input.Events.POINTER_UP, () => {
    if (!start) return;
    start = null;
    target.setScale(base() * releaseScale);
    tweenScale(base(), releaseMs, releaseEase);
    options.onTap();
    // After the action, so a toggle that was just switched on confirms itself.
    services.audio.click();
    services.haptics.play('selection');
  });
  return { cancel };
}

/**
 * Rounded button with a drop shadow and press feedback. A click counts only when
 * the press started on the button and the pointer is still over it on release.
 *
 * The press scales the button itself, the breathing scales `breatheRoot` inside it, and
 * screen transitions move it: none of the three stops another.
 */
export class Button extends Phaser.GameObjects.Container {
  private readonly press: PressFeedback;
  private readonly hitArea: Phaser.Geom.Rectangle;
  private readonly breatheRoot: Phaser.GameObjects.Container;
  private breathing = false;

  constructor(
    scene: Phaser.Scene,
    private readonly options: ButtonOptions,
  ) {
    super(scene, options.x, options.y);
    const { width, height } = options;
    const face = Button.createFace(scene, options);
    this.breatheRoot = new Phaser.GameObjects.Container(scene, 0, 0, [face]);
    if (options.content) this.breatheRoot.add(options.content);
    this.add(this.breatheRoot);

    // Container hit areas are measured from the top-left corner of its size.
    this.hitArea = new Phaser.Geom.Rectangle(0, 0, width, height);
    this.setSize(width, height);
    this.setInteractive(this.hitArea, Phaser.Geom.Rectangle.Contains);

    this.press = attachPressFeedback(this, { onTap: options.onClick });
    scene.add.existing(this);
  }

  /** The baked face, placed so that (0, 0) is the centre of the face (not of its shadow). */
  private static createFace(scene: Phaser.Scene, options: ButtonOptions): Phaser.GameObjects.Image {
    const { width, height, shadowOffset, radius, fill } = options;
    if (options.look === 'volume') {
      const art = bakeVolume(
        scene,
        `${options.textureKey}_vol`,
        width,
        height + shadowOffset,
        lookOf('button', radius, shadowOffset),
        { fill },
        options.decorate ? (g) => options.decorate?.(g, width, height) : undefined,
      );
      return new Phaser.GameObjects.Image(scene, 0, 0, art.key).setOrigin(
        (art.left + width / 2) / art.textureWidth,
        (art.top + height / 2) / art.textureHeight,
      );
    }
    bakeTexture(scene, options.textureKey, width, height + shadowOffset, (g) => {
      g.fillStyle(options.shadowColor, 1).fillRoundedRect(0, shadowOffset, width, height, radius);
      g.fillStyle(fill, 1).fillRoundedRect(0, 0, width, height, radius);
      options.decorate?.(g, width, height);
    });
    return new Phaser.GameObjects.Image(scene, 0, -height / 2, options.textureKey).setOrigin(
      0.5,
      0,
    );
  }

  /** A disabled button ignores the pointer. */
  setEnabled(enabled: boolean): this {
    this.press.cancel();
    if (enabled) this.setInteractive(this.hitArea, Phaser.Geom.Rectangle.Contains);
    else this.disableInteractive();
    return this;
  }

  /**
   * The main call to play: the button breathes all the time and a gloss runs
   * over its face every few seconds (`gloss: false` for a small button: breathing only).
   */
  breathe(gloss = true): this {
    if (this.breathing) return this;
    this.breathing = true;
    const { width, height, radius } = this.options;
    const ui = ANIM.ui;
    this.scene.tweens.add({
      targets: this.breatheRoot,
      scale: ui.breatheScale,
      duration: ui.breathePeriodMs / 2,
      ease: ui.breatheEase,
      yoyo: true,
      repeat: -1,
    });
    if (!gloss) return this;
    const band = createGlossBand(this.scene, height - ui.glossInset * 2);
    // Over the face, under the label.
    this.breatheRoot.addAt(band, 1);
    const travel = width / 2 - radius - ANIM.perfect.glossSweepWidth / 2;
    const timer = this.scene.time.addEvent({
      delay: ui.glossEveryMs,
      loop: true,
      callback: () => sweepGloss(band, travel, ui.glossMs, ui.glossAlpha),
    });
    this.once(Phaser.GameObjects.Events.DESTROY, () => timer.remove(false));
    return this;
  }
}
