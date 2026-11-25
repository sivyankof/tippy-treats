import * as Phaser from 'phaser';
import { MASTERY_FRAME } from '../../../data/creatures/mastery-look';
import { parseHex } from '../../../util/color';
import { fxGuard } from '../../common/fx-guard';
import { effectsMode } from '../../app/effects-mode';
import { FX_TEXTURES } from '../../fx/common/fx-textures';
import { FrameSparkleRota, type SparkleFrame } from './frame-sparkle-rota';
import {
  framePerimeterPoint,
  isCollectionBody,
  sparkleStartX,
  type FrameBody,
} from './mastery-frame-geometry';

const look = MASTERY_FRAME.sparkle;

/** How far past the camera view a frame may sit and still count as seen, pixels. */
const VIEW_SLACK = 40;

/** The share of the glint that shows at `progress` of the run: it fades in and out under the crown. */
export function sparkleEnvelope(progress: number): number {
  return Math.max(0, Math.min(1, progress / look.edge, (1 - progress) / look.edge));
}

/**
 * The running glint of one gold frame: the shared spark picture lying along the band, a small cross glint over
 * it and a fading trail, all moved and faded in place (nothing is made while it runs). Hidden at rest.
 */
class FrameGlint implements SparkleFrame {
  private readonly head: Phaser.GameObjects.Image;
  private readonly cross: Phaser.GameObjects.Image;
  private readonly trail: Phaser.GameObjects.Image[] = [];
  private readonly startX: number;
  private readonly size: number;

  constructor(
    private readonly scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    private readonly body: FrameBody,
    private readonly plate: Phaser.GameObjects.Image,
  ) {
    const tint = parseHex(look.tint);
    const make = (): Phaser.GameObjects.Image => {
      const img = scene.add.image(0, 0, FX_TEXTURES.spark).setTint(tint).setVisible(false);
      container.add(img);
      return img;
    };
    for (let i = 0; i < look.trail.count; i++) this.trail.push(make());
    this.head = make();
    this.cross = make();
    this.startX = sparkleStartX(body);
    this.size = isCollectionBody(body) ? 1 : look.plateScale;
  }

  isShown(): boolean {
    const { plate, scene } = this;
    if (!plate.active || !this.head.active) return false;
    let node: Phaser.GameObjects.GameObject | null = plate;
    while (node) {
      const g = node as Phaser.GameObjects.GameObject & { visible?: boolean; alpha?: number };
      if (!g.active || g.visible === false || (g.alpha ?? 1) <= 0) return false;
      node = (node as Phaser.GameObjects.Image).parentContainer;
    }
    const m = plate.getWorldTransformMatrix();
    const view = scene.cameras.main.worldView;
    return (
      m.tx > view.x - VIEW_SLACK &&
      m.tx < view.right + VIEW_SLACK &&
      m.ty > view.y - VIEW_SLACK &&
      m.ty < view.bottom + VIEW_SLACK
    );
  }

  show(progress: number): void {
    const env = sparkleEnvelope(progress);
    this.place(this.head, progress, look.head.scaleX, look.head.scaleY, look.head.alpha * env, 0);
    this.place(
      this.cross,
      progress,
      look.cross.scale * look.head.scaleX,
      look.cross.scale * look.head.scaleY,
      look.cross.alpha * env,
      Math.PI / 2,
    );
    let fade = 1;
    this.trail.forEach((img, i) => {
      fade *= look.trail.fade;
      const t = progress - (i + 1) * look.trail.spacing;
      this.place(
        img,
        t,
        look.head.scaleX * fade,
        look.head.scaleY * fade,
        t < 0 ? 0 : look.head.alpha * env * fade,
        0,
      );
    });
  }

  hide(): void {
    this.head.setVisible(false);
    this.cross.setVisible(false);
    for (const img of this.trail) img.setVisible(false);
  }

  /** Moves one picture of the glint onto the band at `t`, lying along the way (turned `extra` more). */
  private place(
    img: Phaser.GameObjects.Image,
    t: number,
    scaleX: number,
    scaleY: number,
    alpha: number,
    extra: number,
  ): void {
    if (alpha <= 0) {
      img.setVisible(false);
      return;
    }
    const p = framePerimeterPoint(this.body, t, this.startX);
    img
      .setPosition(p.x, p.y)
      .setRotation(p.angle - Math.PI / 2 + extra)
      .setScale(scaleX * this.size, scaleY * this.size)
      .setAlpha(alpha)
      .setVisible(true);
  }
}

const rotas = new WeakMap<Phaser.Scene, FrameSparkleRota>();

/** The rota of a scene, made on first use and dropped with the scene's shutdown. */
function sceneRota(scene: Phaser.Scene): FrameSparkleRota {
  const known = rotas.get(scene);
  if (known) return known;
  const made = new FrameSparkleRota(look, () => effectsMode.reduced);
  rotas.set(scene, made);
  const step = (_time: number, delta: number): void =>
    fxGuard.run(
      'frame_sparkle',
      () => made.update(delta),
      () => made.clear(),
    );
  const drop = (): void => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, step);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, drop);
    scene.events.off(Phaser.Scenes.Events.DESTROY, drop);
    made.clear();
    rotas.delete(scene);
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, step);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, drop);
  scene.events.once(Phaser.Scenes.Events.DESTROY, drop);
  return made;
}

/**
 * Gives the gold frame `plate` (an image in `container`, centred on it) its running sparkle: it takes its turn in
 * the scene's rota, so only one frame of the screen sparkles at a time. Leaves when the container is destroyed.
 * Nothing runs at the minimal effects level.
 */
export function attachFrameSparkle(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  body: FrameBody,
  plate: Phaser.GameObjects.Image,
): void {
  if (!scene.textures.exists(FX_TEXTURES.spark)) return;
  const glint = new FrameGlint(scene, container, body, plate);
  const rota = sceneRota(scene);
  const leave = rota.register(glint);
  container.once(Phaser.GameObjects.Events.DESTROY, leave);
}
