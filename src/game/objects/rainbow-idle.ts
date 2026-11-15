import * as Phaser from 'phaser';
import { Rng } from '../../core/rng';
import { arcCurve } from '../fx/abilities/rainbow-arc-geometry';
import { paintBand } from '../fx/abilities/rainbow-band';
import { outlineColor } from '../fx/plain-style';
import { easeFn } from '../fx/ease';
import { artRecipe } from '../../data/creature-looks';
import { PALETTE } from '../../data/palette';
import { RAINBOW_BAND_COLORS as BAND_COLORS, RAINBOW_LOOK } from '../../data/rainbow-look';
import { mixColor } from '../../util/color';
import { DEG_TO_RAD, TWO_PI } from '../../util/math';
import { effectsMode } from '../effects-mode';
import { fillPolygon, type Pt } from '../fx/plain-style';
import { paintStar } from './creature-art/rainbow';
import { bodySpan, spongeRows, starPoints, waveAt } from './creature-art/rainbow-geometry';
import { humpAt, sparkleAt, waveProgress } from './creature-art/rainbow-idle-geometry';
import { layerBox, type LayerBox } from './layer-draw';

const { idle, star } = RAINBOW_LOOK;
const { joke } = idle;
const JOKE_OUTLINE = outlineColor(BAND_COLORS[1] ?? 0);
const jokeGrow = easeFn(joke.growEase);
/** Points of the white sparkle. */
const SPARKLE_POINTS = 4;
const jokeRng = new Rng(joke.seed).fork('rainbow-joke');
/** When the next joke may start (scene time, ms); shared, so only one Rainbow tells it at a time. */
let nextJokeAt = -1;

/**
 * What the Rainbow layer does besides its baked picture: the gold star (it is not baked, so it
 * can sway and flash) behind the body, so the body hides its foot, and, while it rests, a colour
 * wave in which the sponges swell one after another over the body. Two small `Graphics` per layer
 * redrawn from their own clock (only while something moves); "fewer effects" leaves the star
 * still and the wave off. Both are hidden while the body is squashed against the screen edge.
 */
export class RainbowIdle {
  /** The star and the joke, under the body. */
  private readonly back: Phaser.GameObjects.Graphics;
  /** The wave and the sparkle, over the body. */
  private readonly g: Phaser.GameObjects.Graphics;
  private width = 0;
  private on = false;
  private hidden = false;
  /** The picture is out of date although nothing moves (a new width, shown again). */
  private dirty = true;
  private wasLive = false;
  private rows: Array<{ top: number; bottom: number }> = [];
  private jokeStart = -1;
  private jokeDir = 1;
  private squint = false;

  constructor(
    scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    art: Phaser.GameObjects.GameObject,
  ) {
    this.back = new Phaser.GameObjects.Graphics(scene).setVisible(false);
    this.g = new Phaser.GameObjects.Graphics(scene).setVisible(false);
    const at = parent.getIndex(art);
    parent.addAt(this.back, at);
    parent.addAt(this.g, at + 2);
  }

  /** Shows the overlay for a rainbow layer of `width` (a layer of another look hides it). */
  set(on: boolean, width: number): void {
    this.on = on;
    this.width = width;
    this.rows = on ? this.sponges(layerBox(width)) : [];
    this.dirty = true;
    this.show();
    if (on) this.draw(this.g.scene.time.now, 0, false);
    else this.clear();
  }

  /** Hides the overlay (the body is drawn squashed instead) or shows it again. */
  setHidden(hidden: boolean): void {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    this.dirty = true;
    this.show();
  }

  /** Draws the star (and the wave while `animate`) for the moment `timeMs`; `phaseMs` shifts it per layer. */
  draw(timeMs: number, phaseMs: number, animate: boolean): void {
    if (!this.on || this.hidden) return;
    const live = animate && !effectsMode.reduced;
    // A still star stays as drawn; only a moving one (or a change of state) needs a redraw.
    if (!live && !this.dirty && !this.wasLive) return;
    this.dirty = false;
    this.wasLive = live;
    this.clear();
    const star0 = this.back;
    const g = this.g;
    const box = layerBox(this.width);
    if (live) this.drawWave(timeMs + phaseMs, box);
    const cy = box.top - star.lift;
    const flash = live ? sparkleAt(timeMs, phaseMs) : 0;
    const sway = live
      ? Math.sin((TWO_PI * (timeMs + phaseMs)) / idle.swayMs) * idle.swayDeg * DEG_TO_RAD
      : 0;
    paintStar(star0, cy, sway, 1 + flash * idle.sparkleScale);
    if (live) this.drawJoke(timeMs, cy);
    if (flash > 0) {
      const size = star.radius * idle.sparkleSize * flash;
      const x = idle.sparkleOffset.x * star.radius;
      const y = cy + idle.sparkleOffset.y * star.radius;
      g.fillStyle(PALETTE.textLight, 1);
      fillPolygon(g, starPoints(x, y, size, idle.sparkleNotch, SPARKLE_POINTS));
    }
  }

  private show(): void {
    const visible = this.on && !this.hidden;
    this.back.setVisible(visible);
    this.g.setVisible(visible);
  }

  private clear(): void {
    this.back.clear();
    this.g.clear();
  }

  /** The rows of the sponges of a layer of this width (the wave swells them one by one). */
  private sponges(box: LayerBox): Array<{ top: number; bottom: number }> {
    const recipe = artRecipe('rainbow');
    if (recipe.kind !== 'rainbow') return [];
    const top = box.innerTop + box.height * recipe.creamShare;
    return spongeRows(top, box.innerBottom - top, BAND_COLORS.length);
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
      this.jokeDir = jokeRng.next() < joke.leftChance ? -1 : 1;
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
    const from = { x: 0, y: cy + star.radius * joke.startY };
    const to = { x: this.jokeDir * joke.spanPx, y: cy + star.radius * joke.endY };
    const curve = arcCurve(from, to, 0, joke.risePx, grown, joke.steps);
    const fade = age > total - joke.fadeMs ? (total - age) / joke.fadeMs : 1;
    paintBand(this.back, curve, {
      colors: BAND_COLORS,
      bandPx: joke.bandPx,
      outline: JOKE_OUTLINE,
      outlinePx: joke.outlinePx,
      glossShare: joke.glossShare,
      glossAlpha: joke.glossAlpha,
      alpha: fade,
    });
  }

  /** Each sponge swells and brightens in a window that runs across it left to right, top sponge first. */
  private drawWave(timeMs: number, box: LayerBox): void {
    const column = (x: number, row: { top: number; bottom: number }, bulge: number): Pt[] => {
      const span = bodySpan(box, x);
      const up = row.top + waveAt(x) - bulge;
      const down = row.bottom + waveAt(x);
      return [
        { x, y: Math.max(span.top, up) },
        { x, y: Math.min(span.bottom, down) },
      ];
    };
    this.rows.forEach((row, i) => {
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
