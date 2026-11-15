import * as Phaser from 'phaser';
import { ABILITY_ANIM } from '../../../data/ability-anim';
import { ANIM } from '../../../data/anim';
import { BALANCE } from '../../../data/balance';
import { DEPTH } from '../../depth';
import { effectsMode } from '../../effects-mode';
import type { LayerPose } from '../../objects/tower-view';
import { landedRimAlpha } from './active-state';
import { hueColor } from './hue';

const cfg = ABILITY_ANIM.active.rainbow.rim;
const HALF = cfg.width / 2;

/** What the rim is drawn around: centre and width of a layer. */
type Body = Readonly<{ x: number; y: number; width: number }>;

/**
 * The rainbow outline that says "this layer will not be cut": it rims the flying layer while the
 * rainbow is on and stays on the layer for a moment after a landing that was saved from the cut.
 * "Fewer effects" draws it still, in one colour.
 */
export class RainbowRim {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private landedIndex = -1;
  private landedAgeMs = 0;

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(DEPTH.flyingCoat + 2);
  }

  /** The layer at `index` came down whole although a normal drop would have cut it. */
  markLanded(index: number): void {
    this.landedIndex = index;
    this.landedAgeMs = 0;
  }

  /** `flying` is the drawn body of the flying layer (`null` while none flies); `landed` is the pose of the marked layer. */
  update(
    dtMs: number,
    timeMs: number,
    flying: Body | null,
    on: boolean,
    landed: (index: number) => Readonly<LayerPose> | null,
  ): void {
    this.gfx.clear();
    if (on && flying) this.rim(flying, timeMs, 1);
    if (this.landedIndex < 0) return;
    this.landedAgeMs += dtMs;
    const alpha = landedRimAlpha(this.landedAgeMs, cfg.landHoldMs, cfg.landFadeMs);
    const pose = alpha > 0 ? landed(this.landedIndex) : null;
    if (!pose) {
      this.landedIndex = -1;
      return;
    }
    this.rim(pose, timeMs, alpha);
  }

  private rim(body: Body, timeMs: number, fade: number): void {
    const still = effectsMode.reduced;
    const color = still ? cfg.staticColor : hueColor(timeMs / cfg.huePeriodMs, cfg.saturation);
    // The stroke sits on the outer edge of the layer: half of it inside, half outside.
    const height = BALANCE.layer.height;
    this.gfx
      .lineStyle(cfg.width, color, cfg.alpha * fade)
      .strokeRoundedRect(
        body.x - body.width / 2 + HALF,
        body.y - height / 2 + HALF,
        Math.max(1, body.width - cfg.width),
        height - cfg.width,
        Math.max(1, ANIM.layer.cornerRadius - HALF),
      );
  }
}
