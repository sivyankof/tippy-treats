import * as Phaser from 'phaser';
import { ABILITY_ANIM } from '../../../data/ability-anim';
import { RAINBOW_BAND_COLORS } from '../../../data/rainbow-look';
import { clamp01, frameLerp } from '../../../util/math';
import { DEPTH } from '../../depth';
import { easeFn } from '../ease';
import { FX_TEXTURES } from '../fx-textures';
import { outlineColor } from '../plain-style';
import type { AbilityBursts } from './ability-bursts';
import { paintBand } from './rainbow-band';
import { arcCurve, arcSide, swell, type Point } from './rainbow-arc-geometry';
import { HALF_LAYER } from './kit';

const cfg = ABILITY_ANIM.rainbow;
const arc = cfg.arc;
const cloud = cfg.cloud;
const OUTLINE = outlineColor(arc.outlineFrom);
const grow = easeFn(arc.growEase);
const pop = easeFn(cloud.popEase);
/** Just behind the flying layer, so the arc seems to end in it. */
const ARC_DEPTH = DEPTH.flying - 0.1;

type Phase = 'idle' | 'live' | 'deflate';

/**
 * The rainbow arc of the Rainbow ability: a fat cartoon rainbow that shoots out of a cream cloud
 * with a face on the Rainbow layer, bows out to the side of the tower (not over its top), reaches a second cloud on the flying layer and follows it.
 * When the protected layer lands it bursts into stars, the lower cloud deflates, and the arc is
 * thrown again from the landed layer if the next layer is protected too.
 */
export class RainbowArc {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private phase: Phase = 'idle';
  private ageMs = 0;
  private lostMs = 0;
  private readonly from: Point = { x: 0, y: 0 };
  private readonly last: Point = { x: 0, y: 0 };
  private relaunch: Point | null = null;
  /** Which way the arc bows now, smoothed between -1 (left) and 1 (right). */
  private bow = 1;
  private bowTarget = 1;
  /** Called when the lower cloud starts to deflate (the puff sound). */
  onDeflate: (() => void) | null = null;
  /** Bottom edge of the screen in world pixels (the arc starts below it when its cloud is off screen). */
  private viewBottom = Infinity;

  constructor(
    scene: Phaser.Scene,
    private readonly bursts: AbilityBursts,
  ) {
    this.gfx = scene.add.graphics().setDepth(ARC_DEPTH);
  }

  /** Starts an arc out of a cloud at (`x`, `y`). */
  start(x: number, y: number): void {
    this.from.x = x;
    this.from.y = y;
    this.last.x = x;
    this.last.y = y - arc.idleRise;
    this.phase = 'live';
    this.ageMs = 0;
    this.lostMs = 0;
    this.relaunch = null;
    this.bow = this.bowTarget;
  }

  /** A protected layer landed at `top` (the middle of its top edge): the arc bursts. `again` throws a new one from there. */
  land(top: Point, again: boolean): void {
    if (this.phase !== 'live') return;
    const curve = this.curve(1);
    const { points, count } = arc.burst;
    for (let i = 0; i < points; i++) {
      const p = curve[Math.round(((curve.length - 1) * (i + 0.5)) / points)];
      if (!p) continue;
      const style = ABILITY_ANIM.active.rainbow.landStars.style;
      this.bursts.cone(p.x, p.y, 0, count, style, FX_TEXTURES.star, cfg.stripes);
    }
    this.phase = 'deflate';
    this.onDeflate?.();
    this.ageMs = 0;
    this.relaunch = again ? { x: top.x, y: top.y } : null;
  }

  /** The Rainbow effect ran out: no new arc is thrown; one in the air bursts. */
  stop(): void {
    this.relaunch = null;
    if (this.phase === 'live') this.land(this.last, false);
  }

  /** `target` is the middle of the top edge of the flying layer (`null` while none flies). */
  update(dtMs: number, target: Point | null, viewBottom = Infinity): void {
    this.gfx.clear();
    this.viewBottom = viewBottom;
    if (this.phase === 'idle') return;
    this.ageMs += dtMs;
    if (this.phase === 'deflate') {
      if (this.ageMs >= cloud.deflateMs) {
        const again = this.relaunch;
        this.phase = 'idle';
        if (again) this.start(again.x, again.y);
        return;
      }
      this.cloud(this.from.x, this.from.y, 1 - clamp01(this.ageMs / cloud.deflateMs), true);
      return;
    }
    if (target) {
      this.bowTarget = arcSide(this.bowTarget, target.x - this.from.x, arc.sideDeadPx);
      this.bow += (this.bowTarget - this.bow) * frameLerp(arc.bowLerp, dtMs);
      this.last.x = target.x;
      this.last.y = target.y;
      this.lostMs = 0;
    } else if ((this.lostMs += dtMs) > arc.lostMs) {
      this.land(this.last, false);
      return;
    }
    this.paint();
  }

  /** Where the arc starts: the cloud, or just below the screen edge while the cloud is off screen. */
  private start0(): Point {
    return this.from.y > this.viewBottom
      ? { x: this.from.x, y: this.viewBottom + arc.edgeOverPx }
      : this.from;
  }

  private curve(grown: number): Array<Point & { nx: number; ny: number }> {
    const start = this.start0();
    const dist = Math.hypot(this.last.x - start.x, this.last.y - start.y);
    const side = Math.max(arc.sidePx, dist * arc.sideShare) * this.bow;
    const rise = arc.risePx + dist * arc.riseShare;
    return arcCurve(start, this.last, side, rise, grown, arc.steps);
  }

  private paint(): void {
    const k = grow(clamp01(this.ageMs / arc.growMs));
    const curve = this.curve(Math.max(0.04, k));
    const swellAt = (this.ageMs % arc.waveMs) / arc.waveMs;
    paintBand(this.gfx, curve, {
      colors: RAINBOW_BAND_COLORS,
      bandPx: arc.bandPx,
      outline: OUTLINE,
      outlinePx: arc.outlinePx,
      glossShare: arc.glossShare,
      glossAlpha: arc.glossAlpha,
      alpha: arc.alpha,
      widthAt: (u) => swell(u, swellAt, arc.waveBulge, arc.waveSigma),
    });
    const popped = pop(clamp01(this.ageMs / cloud.popMs));
    if (this.from.y <= this.viewBottom) this.cloud(this.from.x, this.from.y, popped, true);
    if (k > 0.85) {
      this.cloud(this.last.x, this.last.y - HALF_LAYER * 0.2, popped * cloud.upperScale, false);
    }
  }

  /** A cream cloud of lumps with an outline; the lower one has a face and bobs. */
  private cloud(x: number, y: number, scale: number, face: boolean): void {
    const r = cloud.radius * scale;
    if (r <= 0) return;
    const bob = face ? Math.sin((this.ageMs / cloud.bobMs) * Math.PI * 2) * cloud.bobPx : 0;
    const cy = y + bob;
    const line = outlineColor(cloud.fill);
    const lumps = cloud.lumps.map(([dx, dy, lr]) => ({
      x: x + dx * r,
      y: cy + dy * r,
      r: lr * r,
    }));
    this.gfx.fillStyle(line, 1);
    for (const l of lumps) this.gfx.fillCircle(l.x, l.y, l.r + cloud.outlinePx * scale);
    this.gfx.fillStyle(cloud.fill, 1);
    for (const l of lumps) this.gfx.fillCircle(l.x, l.y, l.r);
    if (!face) return;
    this.gfx.fillStyle(line, 1);
    for (const s of [-1, 1]) {
      this.gfx.fillCircle(x + s * cloud.eye.x * r, cy + cloud.eye.y * r, cloud.eye.radius * r);
    }
    this.gfx.lineStyle(cloud.smile.thick * scale, line, 1).beginPath();
    this.gfx.arc(x, cy + cloud.smile.y * r, cloud.smile.radius * r, 0.2, Math.PI - 0.2);
    this.gfx.strokePath();
  }
}
