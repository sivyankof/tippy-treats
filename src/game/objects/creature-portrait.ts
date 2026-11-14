import * as Phaser from 'phaser';
import { CREATURE_IDS, clampLevel, type CreatureId } from '../../data/creatures';
import { MENU } from '../../data/menu-layout';
import { services } from '../../services';
import { LayerView } from './layer-view';

const cfg = MENU.portrait;

/** Squeak pitch of a creature: every creature has its own (docs/06, section 7). */
export function squeakPitch(id: CreatureId): number {
  return cfg.squeakBase + CREATURE_IDS.indexOf(id) * cfg.squeakStep;
}

/**
 * A live creature for the menus: its layer with a face that blinks, breathing a little.
 * `poke()` makes it hop with a happy face and a squeak. Call `tick` every frame.
 */
export class CreaturePortrait extends Phaser.GameObjects.Container {
  private readonly view: LayerView;
  private readonly inner: Phaser.GameObjects.Container;
  private timeMs = Math.random() * cfg.breathePeriodMs;
  private hopTween: Phaser.Tweens.Tween | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly creature: CreatureId,
    level: number,
    layerWidth: number,
    scale = 1,
  ) {
    super(scene, x, y);
    this.view = new LayerView(scene)
      .setLook({ kind: 'creature', creature, level: clampLevel(level) })
      .setLayer(1, layerWidth);
    this.inner = scene.add.container(0, 0, [this.view]);
    this.add(this.inner);
    this.setScale(scale);
    scene.add.existing(this);
  }

  tick(dtMs: number): void {
    this.timeMs += dtMs;
    this.view.tick(dtMs);
    const phase = (this.timeMs / cfg.breathePeriodMs) * Math.PI * 2;
    const breathe = Math.sin(phase) * cfg.breatheScale;
    this.inner.setScale(1 - breathe / 2, 1 + breathe);
  }

  /** Hop, a happy face and the squeak of this creature. */
  poke(): void {
    this.view.faceView.react('joy', cfg.joyMs);
    services.audio.squeak(squeakPitch(this.creature));
    this.hopTween?.stop();
    this.inner.y = 0;
    this.hopTween = this.scene.tweens.add({
      targets: this.inner,
      y: -cfg.hopHeight,
      duration: cfg.hopMs / 2,
      ease: 'Quad.easeOut',
      yoyo: true,
    });
  }

  /** The face looks towards a point given relative to the portrait. */
  lookAt(dx: number, dy: number): void {
    this.view.faceView.lookAt(dx, dy);
  }
}
