import * as Phaser from 'phaser';
import { Rng } from '../../core/rng';
import { arcCurve } from '../fx/abilities/rainbow-arc-geometry';
import { paintBand } from '../fx/abilities/rainbow-band';
import { outlineColor } from '../fx/plain-style';
import { easeFn } from '../fx/ease';
import { artRecipe } from '../../data/creature-looks';
import { PALETTE } from '../../data/palette';
import { RAINBOW_BANDS, RAINBOW_LOOK } from '../../data/rainbow-look';
import { mixColor, parseHex } from '../../util/color';
import { TWO_PI } from '../../util/math';
import { effectsMode } from '../effects-mode';
import { fillPolygon, type Pt } from '../fx/plain-style';
import { paintStar } from './creature-art/rainbow';
import { bodySpan, spongeRows, waveAt } from './creature-art/rainbow-geometry';
import {
  humpAt,
  sparkleAt,
  sparklePoints,
  waveProgress,
} from './creature-art/rainbow-idle-geometry';
import { layerBox, type LayerBox } from './layer-draw';

const { idle, star } = RAINBOW_LOOK;
const BAND_COLORS = RAINBOW_BANDS.map(parseHex);
const DEG = Math.PI / 180;
const { joke } = idle;
const JOKE_OUTLINE = outlineColor(BAND_COLORS[1] ?? 0);
const jokeGrow = easeFn('Back.easeOut');
const jokeRng = new Rng(joke.seed).fork('rainbow-joke');
/** When the next joke may start (scene time, ms); shared, so only one Rainbow tells it at a time. */
let nextJokeAt = -1;

/**
 * What the Rainbow layer does on top of its baked picture: the gold star (it is not baked, so it
 * can sway and flash) and, while it rests, a colour wave in which the sponges swell one after
 * another. One small `Graphics` per layer, redrawn from its own clock; "fewer effects" leaves the
 * star still and the wave off.
 */
export class RainbowIdle {
  private readonly g: Phaser.GameObjects.Graphics;
  private width = 0;
  private on = false;
  private jokeStart = -1;
  private jokeDir = 1;
  private squint = false;

  constructor(
    scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    before: Phaser.GameObjects.GameObject,
  ) {
    this.g = new Phaser.GameObjects.Graphics(scene).setVisible(false);
    parent.addAt(this.g, parent.getIndex(before));
  }

  /** Shows the overlay for a rainbow layer of `width` (a layer of another look hides it). */
  set(on: boolean, width: number): void {
    this.on = on;
    this.width = width;
    this.g.setVisible(on);
    if (on) this.draw(this.g.scene.time.now, 0, false);
    else this.g.clear();
  }

  /** Draws the star (and the wave while `animate`) for the moment `timeMs`; `phaseMs` shifts it per layer. */
  draw(timeMs: number, phaseMs: number, animate: boolean): void {
    if (!this.on) return;
    const live = animate && !effectsMode.reduced;
    const g = this.g.clear();
    const box = layerBox(this.width);
    if (live) this.drawWave(timeMs + phaseMs, box);
    const cy = box.top - star.lift;
    const flash = live ? sparkleAt(timeMs, phaseMs) : 0;
    const sway = live
      ? Math.sin((TWO_PI * (timeMs + phaseMs)) / idle.swayMs) * idle.swayDeg * DEG
      : 0;
    paintStar(g, cy, sway, 1 + flash * idle.sparkleScale);
    if (live) this.drawJoke(timeMs, cy);
    if (flash > 0) {
      const size = star.radius * idle.sparkleSize * flash;
      const x = idle.sparkleOffset.x * star.radius;
      const y = cy + idle.sparkleOffset.y * star.radius;
      g.fillStyle(PALETTE.textLight, 1);
      fillPolygon(g, sparklePoints(x, y, size, idle.sparkleNotch));
    }
  }

  /** True once after a joke started: the Rainbow squints shyly. */
  takeSquint(): boolean {
    const was = this.squint;
    this.squint = false;
    return was;
  }

  /** Schedules and paints the joke: a small rainbow arch that pops out of the star and fades. */
  private drawJoke(timeMs: number, cy: number): void {
    if (this.jokeStart < 0) {
      if (nextJokeAt < 0) nextJokeAt = timeMs + jokeRng.range(joke.firstMinMs, joke.firstMaxMs);
      if (timeMs < nextJokeAt) return;
      this.jokeStart = timeMs;
      this.jokeDir = jokeRng.next() < 0.5 ? -1 : 1;
      this.squint = true;
      nextJokeAt = timeMs + jokeRng.range(joke.minGapMs, joke.maxGapMs);
    }
    const age = timeMs - this.jokeStart;
    const total = joke.growMs + joke.holdMs + joke.fadeMs;
    if (age > total) {
      this.jokeStart = -1;
      return;
    }
    const grown = Math.max(0.05, jokeGrow(Math.min(1, age / joke.growMs)));
    const from = { x: 0, y: cy - star.radius * 0.3 };
    const to = { x: this.jokeDir * joke.spanPx, y: cy + star.radius };
    const curve = arcCurve(from, to, 0, joke.risePx, grown, joke.steps);
    const fade = age > total - joke.fadeMs ? (total - age) / joke.fadeMs : 1;
    paintBand(this.g, curve, {
      colors: BAND_COLORS,
      bandPx: joke.bandPx,
      outline: JOKE_OUTLINE,
      outlinePx: joke.outlinePx,
      glossShare: 0.45,
      glossAlpha: 0.85,
      alpha: fade,
    });
  }

  /** Each sponge swells and brightens in a window that runs across it left to right, top sponge first. */
  private drawWave(timeMs: number, box: LayerBox): void {
    const recipe = artRecipe('rainbow');
    if (recipe.kind !== 'rainbow') return;
    const top = box.innerTop + box.height * recipe.creamShare;
    const rows = spongeRows(top, box.innerBottom - top, BAND_COLORS.length);
    const column = (x: number, row: { top: number; bottom: number }, bulge: number): Pt[] => {
      const span = bodySpan(box, x);
      const up = row.top + waveAt(x) - bulge;
      const down = row.bottom + waveAt(x);
      return [
        { x, y: Math.max(span.top, up) },
        { x, y: Math.min(span.bottom, down) },
      ];
    };
    rows.forEach((row, i) => {
      const p = waveProgress(timeMs, i);
      const color = BAND_COLORS[i];
      if (p === null || color === undefined) return;
      const center = box.innerLeft - idle.halfPx + p * (box.innerW + idle.halfPx * 2);
      const from = Math.max(box.innerLeft, center - idle.halfPx);
      const to = Math.min(box.innerRight, center + idle.halfPx);
      for (let x = from; x < to; x += idle.sliceStep) {
        const x2 = Math.min(to, x + idle.sliceStep);
        const mid = humpAt((x + x2) / 2, center, idle.halfPx);
        if (mid <= 0) continue;
        const a = column(x, row, idle.bulgePx * humpAt(x, center, idle.halfPx));
        const b = column(x2, row, idle.bulgePx * humpAt(x2, center, idle.halfPx));
        this.g.fillStyle(mixColor(color, PALETTE.textLight, idle.brighten * mid), 1);
        fillPolygon(this.g, [a[0]!, b[0]!, b[1]!, a[1]!]);
      }
    });
  }
}
