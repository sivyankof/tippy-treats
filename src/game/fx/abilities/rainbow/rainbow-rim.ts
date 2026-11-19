import * as Phaser from 'phaser';
import { ABILITY_ANIM } from '../../../../data/creatures/ability-anim';
import { ANIM } from '../../../../data/common/anim';
import { BALANCE } from '../../../../data/tower/balance';
import { DEPTH } from '../../../common/depth';
import { effectsMode } from '../../../app/effects-mode';
import type { LayerPose } from '../../../objects/tower/tower-view';
import { landedRimAlpha } from '../while-active/active-state';
import { bandAt, rimPolyline } from './rainbow-arc-geometry';

const cfg = ABILITY_ANIM.active.rainbow.rim;
const trailCfg = ABILITY_ANIM.active.rainbow.trail;
const colors = ABILITY_ANIM.rainbow.stripes;
const HALF = cfg.width / 2;

/** What the rim is drawn around: centre and width of a layer. */
type Body = Readonly<{ x: number; y: number; width: number }>;

interface Sample {
  x: number;
  y: number;
  width: number;
  ageMs: number;
}

/**
 * The rainbow outline that says "this layer will not be cut": a multicolour rim (all the bands at
 * once, slowly travelling around the outline) on the flying layer while the rainbow is on, with a
 * short trail of colour streaks behind it; the rim stays on a layer saved from the cut for a
 * moment after the landing. "Fewer effects" draws only the rim, still.
 */
export class RainbowRim {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private landedIndex = -1;
  private landedAgeMs = 0;
  private readonly samples: Sample[] = [];

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
    this.trail(dtMs, on ? flying : null);
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

  /** Streaks stay behind the layer for `ms`; a turn at the wall drops what is left behind the old direction. */
  private trail(dtMs: number, body: Body | null): void {
    const list = this.samples;
    for (const s of list) s.ageMs += dtMs;
    while (list.length > 0 && list[0]!.ageMs > trailCfg.ms) list.shift();
    if (!body || effectsMode.reduced) {
      list.length = 0;
      return;
    }
    const last = list[list.length - 1];
    const prev = list[list.length - 2];
    if (last && prev && Math.abs(body.x - last.x) >= trailCfg.minMovePx) {
      if (Math.sign(last.x - prev.x) !== Math.sign(body.x - last.x))
        list.splice(0, list.length - 1);
    }
    list.push({ x: body.x, y: body.y, width: body.width, ageMs: 0 });
    if (list.length < 2) return;
    const dir = Math.sign(body.x - list[0]!.x) || 1;
    const height = BALANCE.layer.height;
    const rowH = height / colors.length;
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i]!;
      const b = list[i + 1]!;
      const alpha = trailCfg.alpha * (1 - a.ageMs / trailCfg.ms);
      const ax = a.x - dir * (a.width / 2);
      const bx = b.x - dir * (b.width / 2);
      colors.forEach((color, row) => {
        const y = b.y - height / 2 + (row + 0.5) * rowH - trailCfg.streakPx / 2;
        this.gfx
          .fillStyle(color, alpha)
          .fillRect(Math.min(ax, bx), y, Math.abs(bx - ax) + 1, trailCfg.streakPx);
      });
    }
  }

  private rim(body: Body, timeMs: number, fade: number): void {
    const phase = effectsMode.reduced ? 0 : timeMs / cfg.travelMs;
    const height = BALANCE.layer.height;
    // The stroke sits on the outer edge of the layer: half of it inside, half outside.
    const pts = rimPolyline(
      body.x - body.width / 2 + HALF,
      body.y - height / 2 + HALF,
      Math.max(1, body.width - cfg.width),
      height - cfg.width,
      Math.max(1, ANIM.layer.cornerRadius - HALF),
      cfg.segmentPx,
    );
    // A run of segments of one colour is one stroked path, not a line per segment.
    const g = this.gfx;
    let run = -1;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      const band = bandAt((a.u + b.u) / 2, phase, cfg.cycles, colors.length);
      if (band !== run) {
        if (run >= 0) g.strokePath();
        run = band;
        g.lineStyle(cfg.width, colors[band]!, cfg.alpha * fade).beginPath();
        g.moveTo(a.x, a.y);
      }
      g.lineTo(b.x, b.y);
    }
    if (run >= 0) g.strokePath();
  }
}
