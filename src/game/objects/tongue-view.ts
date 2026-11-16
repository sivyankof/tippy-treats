import * as Phaser from 'phaser';
import { LICK } from '../../data/lick';
import { PALETTE } from '../../data/palette';
import { bakeTexture } from '../ui/bake-texture';
import { loopPoint, type LickScene, type LoopShape } from './lick-plan';
import type { TongueParts } from './tongue-graphics';
import { newRibbon, sampleRibbon, type Ribbon } from './tongue-ribbon';
import { tongueWidthAt } from './tongue-shape';
import { createTongueParts } from './tongue-strip';

/** Texture keys of the saliva drop and the wet trail; the pictures of the ribbon are baked in `tongue-strip-texture.ts`. */
const TONGUE_TEXTURES = {
  /** A drop of saliva hanging from the tip. */
  saliva: 'lick_tongue_saliva',
  /** A glossy wet blob of the trail. */
  wet: 'lick_tongue_wet',
} as const;

/** The wet blob is this much longer than wide, and has a brighter streak. */
const WET_STRETCH = 1.6;
const WET_RINGS = [
  { scale: 1, alpha: 0.35 },
  { scale: 0.7, alpha: 0.35 },
] as const;
const WET_SHINE = { y: 0.3, w: 0.4, h: 0.18, alpha: 0.9 } as const;
/** The saliva drop: its height as a share of its width, the outline and a shine. */
const SALIVA = { tall: 1.4, outline: 2, outlineShade: 0x6fa3c6, shine: 0.3 } as const;

/** The white of the saliva shine and of the wet trail. */
const WHITE = PALETTE.textLight;

/** Bakes the saliva and trail pictures once (the pictures of the ribbon are baked with its strips). */
export function bakeTongue(scene: Phaser.Scene): void {
  const white = WHITE;
  const s = LICK.saliva;
  const sh = s.size * SALIVA.tall;
  bakeTexture(scene, TONGUE_TEXTURES.saliva, s.size, sh, (g) => {
    const r = s.size / 2;
    g.fillStyle(SALIVA.outlineShade, s.alpha)
      .fillCircle(r, sh - r, r)
      .fillTriangle(r, 0, 0, sh - r, s.size, sh - r);
    const ri = r - SALIVA.outline;
    g.fillStyle(s.color, s.alpha)
      .fillCircle(r, sh - r, ri)
      .fillTriangle(r, SALIVA.outline * 2, r - ri, sh - r, r + ri, sh - r);
    g.fillStyle(white, 1).fillCircle(
      r - ri * SALIVA.shine * 1.5,
      sh - r - ri * SALIVA.shine,
      ri * SALIVA.shine,
    );
  });
  const size = LICK.trail.size;
  const long = size * WET_STRETCH;
  bakeTexture(scene, TONGUE_TEXTURES.wet, long, size, (g) => {
    for (const ring of WET_RINGS) {
      g.fillStyle(white, ring.alpha).fillEllipse(
        long / 2,
        size / 2,
        long * ring.scale,
        size * ring.scale,
      );
    }
    g.fillStyle(white, WET_SHINE.alpha).fillEllipse(
      long / 2,
      size * WET_SHINE.y,
      long * WET_SHINE.w,
      size * WET_SHINE.h,
    );
  });
}

const RAD_TO_DEG = 180 / Math.PI;
const TANGENT_STEP = 0.002;

/**
 * The long tongue of a lick, drawn over the face: one ribbon smoothed along the points of
 * `tongueBody` and shown as baked strips that only bend (`tongue-strip.ts`: the outline under the
 * fill, the light stripe and the groove baked into it, a rounded tip on top), a drop of saliva at
 * the tip and the wet trail the tip leaves round the loop, drying fast. Lives in the face
 * container, in face pixels.
 */
export class TongueView extends Phaser.GameObjects.Container {
  private readonly parts: TongueParts;
  private readonly ribbon: Ribbon;
  private readonly saliva: Phaser.GameObjects.Image;
  private readonly wet: Phaser.GameObjects.Image[] = [];
  /** Lick time each trail blob was laid at (-1: not yet). */
  private readonly wetAt: number[] = [];
  /** The scene and width share of the tongue being laid, read by `width`. */
  private laying: LickScene | null = null;
  private layingMul = 1;
  /** The width at a fractional point index of the tongue being laid (made once, not per frame). */
  private readonly widthAt = (i: number): number =>
    tongueWidthAt(this.laying!, i / LICK.tongue.segments) * this.layingMul;
  private readonly a = { x: 0, y: 0 };
  private readonly b = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene) {
    super(scene);
    bakeTongue(scene);
    const image = (key: string, originY: number): Phaser.GameObjects.Image =>
      new Phaser.GameObjects.Image(scene, 0, 0, key).setOrigin(0.5, originY).setVisible(false);
    for (let i = 0; i < LICK.trail.count; i++) {
      this.wet.push(image(TONGUE_TEXTURES.wet, 0.5));
      this.wetAt.push(-1);
    }
    this.parts = createTongueParts(scene);
    this.ribbon = newRibbon(this.parts.sub);
    this.saliva = image(TONGUE_TEXTURES.saliva, 0);
    // Trail under the tongue; the tip over the saliva that hangs on the body.
    this.add([...this.wet, ...this.parts.under, this.saliva, ...this.parts.over]);
  }

  /**
   * Lays the tongue of `scene` along `points` (flat `[x0, y0, ...]`, from the mouth to the tip),
   * `widthMul` of its width: narrow at the root, wide from the middle to the tip.
   */
  layTongue(points: readonly number[], scene: LickScene, widthMul: number): void {
    this.laying = scene;
    this.layingMul = widthMul;
    const drawn = sampleRibbon(points, this.widthAt, this.ribbon);
    this.laying = null;
    if (drawn) this.parts.lay(this.ribbon);
    else this.parts.hide();
  }

  /** A drop of saliva hangs under the tip, `grow` (0..1) of its size; 0 hides it. */
  hangSaliva(points: readonly number[], grow: number): void {
    const n = LICK.tongue.segments;
    if (grow <= 0) {
      this.saliva.setVisible(false);
      return;
    }
    const s = Math.min(1, grow);
    this.saliva
      .setPosition(points[n * 2]!, points[n * 2 + 1]! + LICK.saliva.hangPx * s)
      .setScale(s, s * (1 + (grow > 1 ? grow - 1 : 0)))
      .setVisible(true);
  }

  /** The tongue is in. */
  hideTongue(): void {
    this.parts.hide();
    this.saliva.setVisible(false);
  }

  /**
   * The wet trail: a blob appears where the tip has passed (`reached` of the way round `shape`,
   * between `from` and `to`) at lick time `nowMs`, and dries in `LICK.trail.dryMs`. With `lay`
   * off no new blob is laid, the ones already down keep drying.
   */
  updateTrail(
    reached: number,
    from: number,
    to: number,
    shape: LoopShape,
    nowMs: number,
    lay = true,
  ): void {
    const { count, alpha, dryMs } = LICK.trail;
    for (let k = 0; k < count; k++) {
      const image = this.wet[k]!;
      const phase = from + ((to - from) * k) / (count - 1);
      if (this.wetAt[k]! < 0) {
        if (!lay || reached < phase) continue;
        this.wetAt[k] = nowMs;
        loopPoint(phase - TANGENT_STEP, shape, this.a);
        loopPoint(phase + TANGENT_STEP, shape, this.b);
        const angle = Math.atan2(this.b.y - this.a.y, this.b.x - this.a.x) * RAD_TO_DEG;
        loopPoint(phase, shape, this.a);
        image.setPosition(this.a.x, this.a.y).setAngle(angle).setVisible(true);
      }
      const dry = (nowMs - this.wetAt[k]!) / dryMs;
      if (dry >= 1) {
        image.setVisible(false);
        continue;
      }
      image.setAlpha(alpha * (1 - dry * dry));
    }
  }

  /** Back to nothing shown, the trail forgotten (a new lick). */
  clear(): void {
    this.hideTongue();
    for (let k = 0; k < this.wet.length; k++) {
      this.wet[k]!.setVisible(false);
      this.wetAt[k] = -1;
    }
  }
}
