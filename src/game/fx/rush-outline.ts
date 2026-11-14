import type * as Phaser from 'phaser';
import { RULE_ANIM } from '../../data/rule-anim';
import { oscillate01, smoothstep } from '../../util/math';
import { FLYING_FX_DEPTH } from './flying-fx-depth';
import {
  createTreasureTextures,
  OUTLINE_HEIGHT,
  OUTLINE_MARGIN,
  OUTLINE_WIDTH,
  TREASURE_TEXTURES,
} from './treasure-textures';

const cfg = RULE_ANIM.outline;
/** Room the outline takes beyond the layer body on each side: the gap and the glow around the stroke. */
const REACH = cfg.pad + OUTLINE_MARGIN;

/**
 * A pulsing red outline laid around the flying layer of a rush: it shows from the spawn on, so
 * the player knows a dash is coming. One stretchable picture, nothing is redrawn per frame.
 */
export class RushOutline {
  private readonly image: Phaser.GameObjects.NineSlice;
  private width = -1;

  constructor(scene: Phaser.Scene) {
    createTreasureTextures(scene);
    this.image = scene.add
      .nineslice(
        0,
        0,
        TREASURE_TEXTURES.outline,
        undefined,
        OUTLINE_WIDTH,
        OUTLINE_HEIGHT,
        cfg.slice,
        cfg.slice,
        0,
        0,
      )
      .setTint(RULE_ANIM.colors.rush)
      .setDepth(FLYING_FX_DEPTH.outline)
      .setVisible(false);
  }

  /**
   * `x`, `y` is the centre of the layer body, `width` its width. `ageMs` is the time since the
   * layer spawned (the outline fades in over it), `flash` 0..1 the flare of the release, and
   * (`scaleX`, `scaleY`) the squash of the layer body, which the outline follows.
   */
  update(
    on: boolean,
    x: number,
    y: number,
    width: number,
    timeMs: number,
    ageMs: number,
    flash = 0,
    scaleX = 1,
    scaleY = 1,
  ): void {
    this.image.setVisible(on);
    if (!on) return;
    const wide = Math.max(Math.round(width + REACH * 2), cfg.slice * 2);
    if (wide !== this.width) {
      this.width = wide;
      this.image.setSize(wide, OUTLINE_HEIGHT);
    }
    const pulse = oscillate01(timeMs, cfg.pulsePeriodMs);
    const [minAlpha, maxAlpha] = cfg.alpha;
    const alpha = minAlpha + (maxAlpha - minAlpha) * pulse;
    const grow = 1 + cfg.pulseGrow * pulse + cfg.flashGrow * flash;
    this.image
      .setPosition(x, y)
      .setAlpha((alpha + (1 - alpha) * flash) * smoothstep(ageMs / cfg.fadeInMs))
      .setScale(grow * scaleX, grow * scaleY);
  }
}
