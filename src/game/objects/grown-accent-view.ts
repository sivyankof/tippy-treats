import * as Phaser from 'phaser';
import { BALANCE } from '../../data/balance';
import type { CreatureId } from '../../data/creatures';
import {
  GROWN_ACCENTS,
  GROWN_ACCENT_LEVELS,
  GROWN_ACCENT_TEXTURES,
  type GrownAccent,
} from '../../data/mastery-look';
import { TWO_PI } from '../../util/math';
import { effectsMode } from '../effects-mode';
import { sparklerTip } from './creature-art/grown-anchors';

const HALF_HEIGHT = BALANCE.layer.height / 2;

/**
 * The one small moving sprite of a grown creature (a bee circling the crown of the Honey, the
 * breath of the Frosty, the spark of the sparkler): a picture of the shared sheet that only
 * moves, turns and scales, never a drawing. Full effects: it moves fully (the bee flaps); lite:
 * the same loop at half speed without the flap or the spin; minimal: the picture stands still
 * at its resting place (the breath is not shown). Creatures without an accent show nothing.
 */
export class GrownAccentView {
  readonly image: Phaser.GameObjects.Image;
  private spec: GrownAccent | null = null;
  private width = 0;
  private visibleNow = false;

  constructor(scene: Phaser.Scene) {
    this.image = new Phaser.GameObjects.Image(scene, 0, 0, '__DEFAULT');
    this.image.setVisible(false);
  }

  /** Shows the accent of `creature` for a layer of `width`, or hides it (`null`, or a creature without one). */
  set(creature: CreatureId | null, width: number): void {
    const spec = creature ? (GROWN_ACCENTS[creature] ?? null) : null;
    this.spec = spec;
    this.width = width;
    if (!spec) {
      this.hide();
      return;
    }
    this.image.setTexture(GROWN_ACCENT_TEXTURES[spec.kind].key);
    this.draw(0, 0);
  }

  hide(): void {
    this.spec = null;
    this.visibleNow = false;
    this.image.setVisible(false);
  }

  /** Moves the accent for the moment `timeMs` (`phaseMs` keeps the layers of a tower out of step). */
  tick(timeMs: number, phaseMs: number): void {
    if (this.spec) this.draw(timeMs, phaseMs);
  }

  private draw(timeMs: number, phaseMs: number): void {
    const spec = this.spec;
    if (!spec) return;
    const level = GROWN_ACCENT_LEVELS[effectsMode.level];
    const t = level.still ? 0 : (timeMs + phaseMs) / level.periodMul;
    if (spec.kind === 'bee') this.drawBee(spec, t, level.detail);
    else if (spec.kind === 'breath') this.drawBreath(spec, t, level.still);
    else this.drawSpark(spec, t, level.detail, level.still);
  }

  private show(x: number, y: number, scaleX: number, scaleY: number, alpha = 1, angle = 0): void {
    this.image.setPosition(x, y).setScale(scaleX, scaleY).setAlpha(alpha).setAngle(angle);
    if (!this.visibleNow) {
      this.visibleNow = true;
      this.image.setVisible(true);
    }
  }

  private drawBee(spec: Extract<GrownAccent, { kind: 'bee' }>, t: number, flutter: boolean): void {
    const { orbit, flap } = spec;
    const a = (TWO_PI * t) / orbit.periodMs;
    const rx = Math.min(orbit.rx, this.width * orbit.widthShare);
    const x = Math.cos(a) * rx;
    const y = -HALF_HEIGHT - orbit.up + Math.sin(a) * orbit.ry;
    const flip = Math.sin(a + Math.PI / 2) >= 0 ? 1 : -1;
    const beat = flutter ? 1 + Math.sin((TWO_PI * t) / flap.periodMs) * flap.amount : 1;
    this.show(x, y, flip, beat);
  }

  private drawBreath(
    spec: Extract<GrownAccent, { kind: 'breath' }>,
    t: number,
    still: boolean,
  ): void {
    if (still) {
      this.image.setVisible(false);
      this.visibleNow = false;
      return;
    }
    const p = (t % spec.periodMs) / spec.periodMs;
    const x = spec.from.x + (spec.to.x - spec.from.x) * p;
    const y = spec.from.y + (spec.to.y - spec.from.y) * p;
    const scale = spec.scale[0] + (spec.scale[1] - spec.scale[0]) * p;
    this.show(x, y, scale, scale, spec.alpha * (1 - p));
  }

  private drawSpark(
    spec: Extract<GrownAccent, { kind: 'spark' }>,
    t: number,
    detail: boolean,
    still: boolean,
  ): void {
    const tip = sparklerTip(this.width);
    const wave = (Math.sin((TWO_PI * t) / spec.periodMs) + 1) / 2;
    const scale = still ? 1 : spec.scale[0] + (spec.scale[1] - spec.scale[0]) * wave;
    const angle = detail ? (t / 1000) * spec.spinDegPerSec : 0;
    this.show(tip.x, tip.y, scale, scale, 1, angle);
  }
}
