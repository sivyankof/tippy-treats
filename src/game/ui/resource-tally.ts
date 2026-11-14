import * as Phaser from 'phaser';
import { BERRY_LOOK } from '../../data/berry-look';
import { TREASURE } from '../../data/treasure-anim';
import { formatNumber } from '../../i18n';
import { MS_PER_SECOND, oscillate01, sineWave } from '../../util/math';
import { spinScale, shownTotal, type Point } from '../fx/coin-flight-math';
import { easeFn } from '../fx/ease';
import { FX_TEXTURES } from '../fx/fx-textures';
import { createTreasureTextures } from '../fx/treasure-textures';
import { createOutlinedText } from './outlined-text';
import { NumberRoll } from './number-roll';

const cfg = TREASURE.counter;
const revealEase = easeFn(cfg.revealEase);
const idle = BERRY_LOOK.idle;

export interface CounterOptions {
  /** Texture of the icon. */
  texture: string;
  /** 0 is the top row; each row sits `cfg.rowGap` lower. */
  row: number;
  /** The counter stays hidden until its value is above zero, then pops in. */
  hiddenUntilFirst: boolean;
  /** The icon sways and gives a spark now and then instead of turning like a coin. */
  sway?: boolean;
}

/**
 * An icon and a number in the top right corner (coins, berries). The number rolls to the run
 * total minus whatever is still flying towards the counter, so it rises as each coin arrives.
 * At rest the counter breathes, the icon turns (or sways) and a glint twinkles on it.
 */
export class ResourceCounter {
  /** The whole counter, for screen transitions. */
  readonly root: Phaser.GameObjects.Container;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly glint: Phaser.GameObjects.Image;
  private readonly text: Phaser.GameObjects.Text;
  private readonly roll = new NumberRoll();
  private readonly center: Point = { x: 0, y: 0 };
  private pending = 0;
  private shown = -1;
  private revealed: boolean;
  private revealMs = 0;
  /** Time since the last arrival; the hop plays while it is short. */
  private hopMs: number = cfg.hopMs;

  constructor(
    scene: Phaser.Scene,
    private readonly options: CounterOptions,
  ) {
    createTreasureTextures(scene);
    this.icon = scene.add.image(0, 0, options.texture);
    this.glint = scene.add
      .image(cfg.iconSize * cfg.glintOffset, -cfg.iconSize * cfg.glintOffset, FX_TEXTURES.star)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.text = createOutlinedText(
      scene,
      -(cfg.iconSize / 2 + cfg.gap),
      0,
      formatNumber(0),
      cfg.font,
    ).setOrigin(1, 0.5);
    this.root = scene.add.container(0, 0, [this.text, this.icon, this.glint]);
    this.revealed = !options.hiddenUntilFirst;
    this.root.setVisible(this.revealed);
  }

  /** Screen position of the icon centre: where flying coins land. The object is reused. */
  get anchor(): Readonly<Point> {
    this.center.x = this.root.x;
    this.center.y = this.root.y;
    return this.center;
  }

  /** Places the counter in the top right corner of a screen `width` wide. */
  layout(width: number): void {
    this.root.setPosition(
      width - cfg.margin - cfg.iconSize / 2,
      cfg.y + this.options.row * cfg.rowGap,
    );
  }

  /** `amount` is on its way: the number waits for it. */
  addPending(amount: number): void {
    this.pending += amount;
  }

  /** `amount` has arrived: the number may count it, and the counter hops. */
  arrive(amount: number): void {
    this.pending = Math.max(0, this.pending - amount);
    this.hopMs = 0;
  }

  /** `total` is the run total as the game knows it. */
  update(total: number, timeMs: number, dtMs: number): void {
    const target = shownTotal(total, this.pending);
    this.roll.set(target);
    const value = this.roll.update(dtMs);
    if (value !== this.shown) {
      this.shown = value;
      this.text.setText(formatNumber(value));
    }
    if (!this.revealed && target > 0) {
      this.revealed = true;
      this.revealMs = 0;
      this.root.setVisible(true);
    }
    if (!this.revealed) return;
    this.revealMs += dtMs;
    this.hopMs += dtMs;
    this.animate(timeMs);
  }

  private animate(timeMs: number): void {
    const phase = this.options.row * cfg.rowPhase;
    const breathe = 1 + sineWave(timeMs, cfg.breathePeriodMs, phase) * cfg.breatheScale;
    const hopLeft = Math.max(0, 1 - this.hopMs / cfg.hopMs);
    const hop = 1 + (cfg.hopScale - 1) * hopLeft * hopLeft;
    const reveal = revealEase(Math.min(1, this.revealMs / cfg.revealMs));
    this.root.setScale(breathe * hop * reveal);

    const iconScale = cfg.iconSize / this.icon.width;
    if (this.options.sway) {
      this.animateSway(timeMs, iconScale, phase);
      return;
    }
    this.icon.setScale(
      iconScale * spinScale(timeMs, cfg.spinPeriodMs, cfg.spinMinScale),
      iconScale,
    );
    const glint = oscillate01(timeMs, cfg.glintPeriodMs, phase);
    const [minScale, maxScale] = cfg.glintScale;
    const [minAlpha, maxAlpha] = cfg.glintAlpha;
    this.glint
      .setScale(minScale + (maxScale - minScale) * glint)
      .setAlpha(minAlpha + (maxAlpha - minAlpha) * glint)
      .setAngle((timeMs * cfg.glintSpinDegPerSec) / MS_PER_SECOND);
  }

  /** The berry: it swings on its stalk, bobs a little and flashes a spark every couple of seconds. */
  private animateSway(timeMs: number, iconScale: number, phase: number): void {
    this.icon
      .setScale(iconScale)
      .setAngle(sineWave(timeMs, idle.swayPeriodMs, phase) * idle.swayDeg)
      .setY(sineWave(timeMs, idle.bobPeriodMs, phase) * idle.bobPx);
    const cycle = ((timeMs + phase * idle.sparkEveryMs) % idle.sparkEveryMs) / idle.sparkEveryMs;
    // A flash rises and falls inside the lit share of the period.
    const lit = cycle < idle.sparkShare ? Math.sin((Math.PI * cycle) / idle.sparkShare) : 0;
    this.glint
      .setPosition(cfg.iconSize * idle.sparkX, cfg.iconSize * idle.sparkY)
      .setScale(idle.sparkScale * lit)
      .setAlpha(idle.sparkAlpha * lit)
      .setAngle(lit * idle.sparkTurnDeg);
  }
}
