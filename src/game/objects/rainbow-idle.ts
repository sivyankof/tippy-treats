import * as Phaser from 'phaser';
import { Rng } from '../../core/common/rng';
import { arcCurve } from '../fx/abilities/rainbow-arc-geometry';
import { paintBand } from '../fx/abilities/rainbow-band';
import { outlineColor } from '../fx/plain-style';
import { easeFn } from '../fx/ease';
import { ANIM } from '../../data/common/anim';
import { artRecipe } from '../../data/creatures/creature-looks';
import { PALETTE } from '../../data/common/palette';
import { GROWN_LOOKS } from '../../data/creatures/mastery-look';
import {
  RAINBOW_BAND_COLORS as BAND_COLORS,
  RAINBOW_LOOK,
} from '../../data/creatures/rainbow-look';
import { mixColor } from '../../util/color';
import { DEG_TO_RAD, TWO_PI } from '../../util/math';
import { DEPTH } from '../depth';
import { effectsMode } from '../effects-mode';
import { fillQuad, type Pt } from '../fx/plain-style';
import { RAINBOW_TEXTURES } from '../fx/abilities/rainbow-textures';
import { rainbowGlaze } from './creature-art/rainbow';
import { bodySpan, spongeRows, waveAt } from './creature-art/rainbow-geometry';
import {
  glazeFloorAt,
  humpAt,
  sparkleAt,
  waveProgress,
} from './creature-art/rainbow-idle-geometry';
import { DRIP_WIDTH, glazeLayout, layerBox, type LayerBox } from './layer-draw';

const { idle, star } = RAINBOW_LOOK;
const { joke } = idle;
const SCRATCH = new Phaser.GameObjects.Components.TransformMatrix();
const JOKE_OUTLINE = outlineColor(BAND_COLORS[1] ?? 0);
const jokeGrow = easeFn(joke.growEase);
const jokeRng = new Rng(joke.seed).fork('rainbow-joke');
/** When the next joke may start (scene time, ms); shared, so only one Rainbow tells it at a time. */
let nextJokeAt = -1;

/** Lets the next live Rainbow layer tell its joke right away (a dev hook). */
export function startRainbowJokeNow(): void {
  nextJokeAt = 0;
}

/** Whether the view and every container above it show something (visible, not fully transparent). */
function shownUp(owner: Phaser.GameObjects.Container): boolean {
  let node: Phaser.GameObjects.Container | null = owner;
  while (node) {
    if (!node.visible || node.alpha <= 0) return false;
    node = node.parentContainer;
  }
  return true;
}

/** The scene-level joke picture: drawn only while the layer that tells it is shown. */
class JokeGraphics extends Phaser.GameObjects.Graphics {
  constructor(
    scene: Phaser.Scene,
    private readonly owner: Phaser.GameObjects.Container,
  ) {
    super(scene);
  }

  override willRender(camera: Phaser.Cameras.Scene2D.Camera): boolean {
    return shownUp(this.owner) && super.willRender(camera);
  }
}

/**
 * What the Rainbow layer does besides its baked picture: the gold star (it is not baked, so it
 * can sway and flash) behind the body, so the body hides its foot, and, while it rests, a colour
 * wave in which the sponges swell one after another over the body. The star and its sparkle are
 * baked pictures that only turn and scale; one small `Graphics` per layer is redrawn while the wave
 * runs, and another at scene level for the joke, so the small rainbow shows over the layer above;
 * "fewer effects" leaves the star still and the wave and the joke off. All of it is hidden while
 * the body is squashed against the screen edge.
 */
export class RainbowIdle {
  /** The crown star, under the body. */
  private readonly star: Phaser.GameObjects.Image;
  /** The wave, over the body (empty while no wave runs). */
  private readonly g: Phaser.GameObjects.Graphics;
  /** The white sparkle of the star's flash, over the wave. */
  private readonly sparkle: Phaser.GameObjects.Image;
  /** The joke, over every layer of the tower (it follows the layer's own transform). */
  private readonly front: Phaser.GameObjects.Graphics;
  private width = 0;
  private on = false;
  /** The grown look: a bigger star, lifted higher. */
  private grown = false;
  private hidden = false;
  /** The picture is out of date although nothing moves (a new width, shown again). */
  private dirty = true;
  private wasLive = false;
  private rows: Array<{ top: number; bottom: number }> = [];
  /** Lowest y of the baked glaze every `idle.floorStepPx` from the left of the body: the wave keeps below it. */
  private glazeFloor: Float32Array = new Float32Array(0);
  private floorLeft = 0;
  private jokeStart = -1;
  private jokeDir = 1;
  private squint = false;
  /** The layer is in the run's tower, so the joke may show over the layer above it. */
  private jokeAllowed = false;

  constructor(
    scene: Phaser.Scene,
    private readonly parent: Phaser.GameObjects.Container,
    art: Phaser.GameObjects.GameObject,
  ) {
    this.star = new Phaser.GameObjects.Image(scene, 0, 0, RAINBOW_TEXTURES.star).setVisible(false);
    this.g = new Phaser.GameObjects.Graphics(scene).setVisible(false);
    this.sparkle = new Phaser.GameObjects.Image(scene, 0, 0, RAINBOW_TEXTURES.sparkle);
    this.sparkle.setVisible(false);
    this.front = new JokeGraphics(scene, parent).setVisible(false).setDepth(DEPTH.rainbowJoke);
    scene.add.existing(this.front);
    parent.once(Phaser.GameObjects.Events.DESTROY, () => this.front.destroy());
    const at = parent.getIndex(art);
    parent.addAt(this.star, at);
    parent.addAt(this.g, at + 2);
    parent.addAt(this.sparkle, at + 3);
  }

  /** Shows the overlay for a rainbow layer of `width` (a layer of another look hides it); `grown` gives it the bigger crown star. */
  set(on: boolean, width: number, grown = false): void {
    this.on = on;
    this.width = width;
    this.grown = grown;
    this.star.setTexture(grown ? RAINBOW_TEXTURES.starGrown : RAINBOW_TEXTURES.star);
    const box = layerBox(width);
    this.rows = on ? this.sponges(box) : [];
    this.glazeFloor = on ? this.sampleGlazeFloor(box) : new Float32Array(0);
    this.dirty = true;
    this.show();
    if (on) this.draw(this.g.scene.time.now, 0, false);
    else this.clear();
  }

  /** Lets the layer tell the joke (a layer of the tower in the run); off ends one at once. */
  setJokeAllowed(on: boolean): void {
    this.jokeAllowed = on;
    if (!on) this.endJoke();
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
    this.front.clear();
    const box = layerBox(this.width);
    this.g.clear();
    if (live) this.drawWave(timeMs + phaseMs, box);
    const cy = box.top - this.lift;
    const flash = live ? sparkleAt(timeMs, phaseMs) : 0;
    const sway = live
      ? Math.sin((TWO_PI * (timeMs + phaseMs)) / idle.swayMs) * idle.swayDeg * DEG_TO_RAD
      : 0;
    this.star
      .setPosition(0, cy)
      .setRotation(sway)
      .setScale(1 + flash * idle.sparkleScale);
    if (live && this.jokeAllowed) this.drawJoke(timeMs, cy);
    else this.jokeStart = -1;
    this.sparkle
      .setVisible(flash > 0)
      .setPosition(idle.sparkleOffset.x * this.radius, cy + idle.sparkleOffset.y * this.radius)
      .setScale(flash);
  }

  private show(): void {
    const visible = this.on && !this.hidden;
    this.star.setVisible(visible);
    this.g.setVisible(visible);
    this.front.setVisible(visible);
    if (!visible) {
      // Back to rest, so a later show never brings back a swollen, tilted star or a stray sparkle.
      this.star.setRotation(0).setScale(1);
      this.sparkle.setVisible(false);
      this.endJoke();
    }
  }

  private clear(): void {
    this.g.clear();
    this.front.clear();
    this.sparkle.setVisible(false);
  }

  /** Stops a joke at once (the layer goes back to the pool). */
  endJoke(): void {
    this.jokeStart = -1;
    this.front.clear();
  }

  /** The star of the crown in world pixels (where the neighbours look). */
  starWorld(): Pt {
    const m = this.parent.getWorldTransformMatrix(SCRATCH);
    return m.transformPoint(0, layerBox(this.width).top - this.lift);
  }

  /** How far the centre of the star sits above the layer top. */
  private get lift(): number {
    return this.grown ? GROWN_LOOKS.rainbow.star.lift : star.lift;
  }

  /** Outer radius of the star shown. */
  private get radius(): number {
    return this.grown ? star.radius * GROWN_LOOKS.rainbow.star.scale : star.radius;
  }

  /** The baked glaze (lower edge, scallops, drips, as the picture draws them) sampled across the body, once per width. */
  private sampleGlazeFloor(box: LayerBox): Float32Array {
    const recipe = artRecipe('rainbow');
    if (recipe.kind !== 'rainbow') return new Float32Array(0);
    const layout = glazeLayout(box, { depth: recipe.creamShare, ...rainbowGlaze() });
    const grow = ANIM.layer.outline / 2;
    this.floorLeft = box.innerLeft;
    const count = Math.ceil(box.innerW / idle.floorStepPx) + 1;
    const floor = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      floor[i] = glazeFloorAt(box.innerLeft + i * idle.floorStepPx, layout, DRIP_WIDTH, grow);
    }
    return floor;
  }

  /** Lowest y of the glaze at `x` (nothing above the sampled stretch). */
  private floorAt(x: number): number {
    const i = Math.round((x - this.floorLeft) / idle.floorStepPx);
    return this.glazeFloor[Math.min(this.glazeFloor.length - 1, Math.max(0, i))] ?? -Infinity;
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
    const m = this.parent.getWorldTransformMatrix(SCRATCH);
    this.front.setPosition(m.tx, m.ty).setRotation(m.rotation).setScale(m.scaleX, m.scaleY);
    const age = timeMs - this.jokeStart;
    const total = joke.growMs + joke.holdMs + joke.fadeMs;
    if (age > total) {
      this.jokeStart = -1;
      return;
    }
    const grown = Math.max(0.05, jokeGrow(Math.min(1, age / joke.growMs)));
    const from = { x: 0, y: cy + this.radius * joke.startY };
    const to = { x: this.jokeDir * joke.spanPx, y: cy + this.radius * joke.endY };
    const curve = arcCurve(from, to, 0, joke.risePx, grown, joke.steps);
    const fade = age > total - joke.fadeMs ? (total - age) / joke.fadeMs : 1;
    paintBand(this.front, curve, {
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
      const down = Math.min(span.bottom, row.bottom + waveAt(x));
      const up = Math.max(span.top, this.floorAt(x), row.top + waveAt(x) - bulge);
      return [
        { x, y: Math.min(up, down) },
        { x, y: down },
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
        fillQuad(this.g, a[0]!, b[0]!, b[1]!, a[1]!);
      }
    });
  }
}
