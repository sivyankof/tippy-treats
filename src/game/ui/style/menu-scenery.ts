import * as Phaser from 'phaser';
import { ANIM } from '../../../data/anim';
import { MENU } from '../../../data/menu-layout';
import { bakeSharedArt } from '../../objects/backdrop/art-kit';
import { kitchenArt } from '../../objects/backdrop/kitchen-zone';
import type { FrameCtx } from '../../objects/backdrop/life';
import { ZoneScenery } from '../../objects/backdrop/zone-scenery';
import { bakeTexture } from '../bake-texture';

const cfg = MENU.style.scenery;
const SHADE_KEY = 'ui_scenery_shade';
/** Pixels per band of the baked shade strip, and its width. */
const BAND_PX = 4;
const STRIP_WIDTH = 4;

/** How much the kitchen steps back: Home keeps it bright, lists and cards mute it more. */
export type SceneryVeil = keyof typeof cfg.veils;

/** A strip that fades from the shade colour at its top to nothing at its bottom. */
function bakeShade(scene: Phaser.Scene): void {
  const { color, bands } = cfg.shade;
  bakeTexture(scene, SHADE_KEY, STRIP_WIDTH, bands * BAND_PX, (g) => {
    for (let i = 0; i < bands; i++) {
      const t = 1 - i / bands;
      g.fillStyle(color, t * t);
      g.fillRect(0, i * BAND_PX, STRIP_WIDTH, BAND_PX);
    }
  });
}

/**
 * The kitchen of the run behind a menu screen, with all its background life (steam, ladles,
 * the clock, the fly), standing still (no run camera) and drifting slowly. A veil mutes it
 * and the top and bottom of the screen are a little darker, so panels stand out in front.
 */
export class MenuScenery {
  private readonly scenery: ZoneScenery;
  private readonly veil: Phaser.GameObjects.Rectangle;
  private readonly top: Phaser.GameObjects.Image;
  private readonly bottom: Phaser.GameObjects.Image;
  private readonly ctx: FrameCtx;

  constructor(
    private readonly scene: Phaser.Scene,
    veil: SceneryVeil = 'list',
  ) {
    const { width, height } = scene.scale.gameSize;
    bakeSharedArt(scene);
    kitchenArt.bake(scene);
    bakeShade(scene);
    this.ctx = { timeMs: scene.time.now, deltaMs: 0, width, height };
    this.scenery = new ZoneScenery(
      scene,
      'kitchen',
      cfg.depth,
      kitchenArt.build(scene),
      width,
      height,
    );
    const { color, alpha } = cfg.veils[veil];
    this.veil = scene.add
      .rectangle(0, 0, width, height, color, alpha)
      .setOrigin(0)
      .setDepth(cfg.depth);
    this.top = scene.add
      .image(0, 0, SHADE_KEY)
      .setOrigin(0)
      .setAlpha(cfg.shade.top)
      .setDepth(cfg.depth);
    this.bottom = scene.add
      .image(0, 0, SHADE_KEY)
      .setOrigin(0, 1)
      .setFlipY(true)
      .setAlpha(cfg.shade.bottom)
      .setDepth(cfg.depth);
    this.resize(width, height);
  }

  resize(width: number, height: number): void {
    this.ctx.width = width;
    this.ctx.height = height;
    this.scenery.resize(width, height);
    this.veil.setSize(width, height);
    this.top.setDisplaySize(width, height * cfg.shade.topShare);
    this.bottom.setPosition(0, height).setDisplaySize(width, height * cfg.shade.bottomShare);
    this.scenery.update(this.ctx, 0);
  }

  /** Call every frame: the layers drift and the life moves. */
  update(dtMs: number): void {
    this.ctx.deltaMs = Math.min(Math.max(dtMs, 0), ANIM.fx.maxSimMs);
    this.ctx.timeMs = this.scene.time.now;
    this.scenery.update(this.ctx, 0);
  }
}
