import * as Phaser from 'phaser';
import { TREASURE } from '../../data/treasure-anim';
import { PALETTE } from '../../data/palette';
import { sineWave, TWO_PI } from '../../util/math';
import { DEPTH } from '../depth';
import { easeFn } from '../fx/ease';
import { spinScale, type Point } from '../fx/coin-flight-math';
import { FX_TEXTURES } from '../fx/fx-textures';
import type { Particles } from '../fx/particles';
import { twinkle } from '../fx/sparkle-fx';
import { createTreasureTextures, TREASURE_TEXTURES } from '../fx/treasure-textures';

const cfg = TREASURE.floating;
const appearEase = easeFn(cfg.appearEase);
const COIN_DEPTH = DEPTH.hint + cfg.depthOffset;

type Phase = 'hidden' | 'hanging';

/**
 * The coin that hangs at the height of the layer being placed: it spins (its width squashes),
 * bobs up and down and twinkles now and then. It is drawn in world coordinates, over the tower
 * and under the flying layer. A coin that was missed swells and fades on a pair of pictures of
 * its own, so that the next coin can already hang while it goes.
 */
export class FloatingCoin {
  private readonly coin: Phaser.GameObjects.Image;
  private readonly halo: Phaser.GameObjects.Image;
  private readonly popCoin: Phaser.GameObjects.Image;
  private readonly popHalo: Phaser.GameObjects.Image;
  /** Age of the pop-away; it is over once it passes `cfg.popAwayMs`. */
  private popMs: number = cfg.popAwayMs;
  private phase: Phase = 'hidden';
  private baseX = 0;
  private baseY = 0;
  /** Age of the current phase. */
  private ageMs = 0;
  private sparkleMs = 0;
  private readonly pos: Point = { x: 0, y: 0 };

  constructor(
    scene: Phaser.Scene,
    private readonly particles: Particles,
  ) {
    createTreasureTextures(scene);
    this.halo = this.addHalo(scene);
    this.coin = this.addCoin(scene);
    this.popHalo = this.addHalo(scene);
    this.popCoin = this.addCoin(scene);
  }

  private addHalo(scene: Phaser.Scene): Phaser.GameObjects.Image {
    return scene.add
      .image(0, 0, FX_TEXTURES.halo)
      .setTint(PALETTE.gold)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(cfg.haloAlpha)
      .setDepth(COIN_DEPTH)
      .setVisible(false);
  }

  private addCoin(scene: Phaser.Scene): Phaser.GameObjects.Image {
    return scene.add
      .image(0, 0, TREASURE_TEXTURES.coin)
      .setDepth(COIN_DEPTH + 0.1)
      .setVisible(false);
  }

  /** Where the coin is drawn now, `null` while none hangs. The object is reused: read it at once. */
  position(): Readonly<Point> | null {
    return this.phase === 'hanging' ? this.pos : null;
  }

  /** The coin hangs at (x, y); a new coin pops into being, a known one just follows. */
  hang(x: number, y: number): void {
    this.baseX = x;
    this.baseY = y;
    if (this.phase === 'hanging') return;
    this.phase = 'hanging';
    this.ageMs = 0;
    this.sparkleMs = 0;
    this.coin.setVisible(true).setAlpha(1);
    this.halo.setVisible(true).setAlpha(cfg.haloAlpha);
  }

  /** The coin was caught: it leaves (the HUD flies its own copy to the counter). */
  take(): void {
    this.hide();
  }

  /** The coin was missed: it swells and fades away where it hangs. */
  popAway(): void {
    if (this.phase !== 'hanging') return;
    this.popCoin.setPosition(this.pos.x, this.pos.y).setAlpha(1).setVisible(true);
    this.popHalo
      .setPosition(this.pos.x, this.pos.y)
      .setScale(this.halo.scaleX)
      .setAlpha(cfg.haloAlpha)
      .setVisible(true);
    this.popMs = 0;
    this.hide();
  }

  update(dtMs: number, timeMs: number): void {
    this.updatePopping(dtMs);
    if (this.phase === 'hidden') return;
    this.ageMs += dtMs;
    const size = cfg.size / this.coin.width;
    const appear = appearEase(Math.min(1, this.ageMs / cfg.appearMs));
    const bob = sineWave(timeMs, cfg.bobPeriodMs, this.baseX) * cfg.bobAmplitude;
    this.pos.x = this.baseX;
    this.pos.y = this.baseY + bob;
    const spin = spinScale(
      timeMs + this.baseX * cfg.spinPhasePerPx,
      cfg.spinPeriodMs,
      cfg.spinMinScale,
    );
    this.coin.setPosition(this.pos.x, this.pos.y).setScale(size * spin * appear, size * appear);
    this.halo
      .setPosition(this.pos.x, this.pos.y)
      .setScale((cfg.size * cfg.haloScale * appear) / this.halo.width);

    this.sparkleMs += dtMs;
    if (this.sparkleMs >= cfg.sparkleEveryMs) {
      this.sparkleMs -= cfg.sparkleEveryMs;
      const angle = Math.random() * TWO_PI;
      const reach = cfg.size * cfg.sparkleReach;
      twinkle(
        this.particles,
        this.pos.x + Math.cos(angle) * reach,
        this.pos.y + Math.sin(angle) * reach,
      );
    }
  }

  private updatePopping(dtMs: number): void {
    if (this.popMs >= cfg.popAwayMs) return;
    this.popMs += dtMs;
    const t = this.popMs / cfg.popAwayMs;
    if (t >= 1) {
      this.popCoin.setVisible(false);
      this.popHalo.setVisible(false);
      return;
    }
    const size = (cfg.size * (1 + (cfg.popAwayScale - 1) * t)) / this.popCoin.width;
    this.popCoin.setScale(size).setAlpha(1 - t);
    this.popHalo.setAlpha(cfg.haloAlpha * (1 - t));
  }

  private hide(): void {
    this.phase = 'hidden';
    this.coin.setVisible(false);
    this.halo.setVisible(false).setAlpha(cfg.haloAlpha);
  }
}
