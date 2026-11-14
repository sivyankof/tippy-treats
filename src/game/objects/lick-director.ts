import { Rng } from '../../core/rng';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { LICK } from '../../data/lick';
import { effectsMode } from '../effects-mode';
import { easeFn } from '../fx/ease';
import type { LickableDrip } from './glaze-drip-layer';
import type { LayerView } from './layer-view';
import {
  clearsEyes,
  dropCenter,
  inReach,
  lickAllowed,
  LickScheduler,
  type FallenDrop,
} from './lick-plan';

const dropEase = easeFn(ANIM.bite.dripEase);

/** Name of the stream the licks draw from, forked from the cosmetic seed of the run. */
const LICK_STREAM = 'lick';

/** What the director needs to know about the tower this frame. */
export interface LickContext {
  views: ReadonlyMap<number, LayerView>;
  topIndex: number;
  /** The tower is calm (no wobble worries). */
  calm: boolean;
  /** A layer is in the air or about to spawn: the player is aiming, the top layer keeps still. */
  aiming: boolean;
  /** Visible band of the screen in world y. */
  bandTop: number;
  bandBottom: number;
  nowMs: number;
}

/** The drip being lapped: its owner, slot, what was licked off before and what this lick takes. */
interface DripTarget {
  owner: LayerView;
  slot: number;
  startLicked: number;
  cutPx: number;
}

/** What a layer is going to lick, with the target in its face coordinates. */
interface Pick {
  index: number;
  view: LayerView;
  dx: number;
  dy: number;
  drip: DripTarget | null;
  drop: FallenDrop | null;
}

/** A lick under way. */
interface ActiveLick {
  index: number;
  view: LayerView;
  drip: DripTarget | null;
  drop: FallenDrop | null;
  eaten: boolean;
  /** Clock time the tongue comes out, for the sound (-1: played). */
  soundAtMs: number;
}

/**
 * The rare lick: a plain layer on screen sticks out its tongue and laps a glaze drip (its own, or
 * one of the layer above that runs onto it) or a drop that has just fallen. At most one lick for
 * the whole tower per interval; the time between them comes from the cosmetic stream of the run.
 */
export class LickDirector {
  private readonly scheduler: LickScheduler;
  private readonly random: Rng;
  private run: ActiveLick | null = null;
  private fresh: FallenDrop | null = null;
  private readonly scratch: LickableDrip[] = [];
  private readonly spot = { x: 0, y: 0 };
  /** The tongue comes out: the sound plays. */
  onLick: (() => void) | null = null;
  /** The tongue laps up the drop near this world point (radius in pixels). */
  onEatDrop: ((x: number, y: number, radius: number) => void) | null = null;

  constructor(cosmeticSeed: number) {
    this.random = new Rng(cosmeticSeed).fork(LICK_STREAM);
    this.scheduler = new LickScheduler(() => this.random.next());
  }

  /** A glaze drop has just started to fall from (x, y). */
  noteDrop(x: number, y: number, nowMs: number): void {
    this.fresh = { x, y, bornMs: nowMs };
  }

  /** Advances the lick and, when it is time, starts a new one. */
  update(dtMs: number, ctx: LickContext): void {
    if (effectsMode.reduced || !ctx.calm) {
      this.stop();
      return;
    }
    if (this.run) {
      this.follow(this.run, ctx);
      return;
    }
    this.scheduler.tick(dtMs);
    if (this.scheduler.ready) this.startAny(ctx, false);
  }

  /** Starts a lick at once if anything can be licked (a dev tool); returns whether it did. */
  lickNow(ctx: LickContext): boolean {
    if (this.run || effectsMode.reduced) return false;
    return this.startAny(ctx, true);
  }

  /** Drops the lick that is going on and the drop waiting to be licked. */
  stop(): void {
    this.run?.view.faceView.cancelLick();
    this.run = null;
    this.fresh = null;
  }

  private startAny(ctx: LickContext, forced: boolean): boolean {
    const pick = this.pickDrop(ctx) ?? this.pickDrip(ctx);
    if (!pick) {
      if (!forced) this.scheduler.retry();
      return false;
    }
    const glance = pick.drop ? LICK.dropGlanceMs : LICK.glanceMs;
    pick.view.faceView.startLick(pick.dx, pick.dy, glance);
    this.run = {
      index: pick.index,
      view: pick.view,
      drip: pick.drip,
      drop: pick.drop,
      eaten: false,
      soundAtMs: ctx.nowMs + glance,
    };
    this.fresh = null;
    this.scheduler.started();
    return true;
  }

  /** Keeps the tongue on the target and laps the drip shorter. */
  private follow(run: ActiveLick, ctx: LickContext): void {
    const face = run.view.faceView;
    if (ctx.views.get(run.index) !== run.view || !face.licking) {
      face.cancelLick();
      this.run = null;
      return;
    }
    if (run.soundAtMs >= 0 && ctx.nowMs >= run.soundAtMs) {
      run.soundAtMs = -1;
      this.onLick?.();
    }
    // The player started aiming at the top layer: the tongue goes in at once.
    if (run.index === ctx.topIndex && ctx.aiming) {
      this.stop();
      return;
    }
    const frame = face.lickFrameNow;
    if (run.drop) {
      dropCenter(run.drop, ctx.nowMs - run.drop.bornMs, dropEase, this.spot);
      if (!run.eaten && (frame.stage === 'lap' || frame.stage === 'retract')) {
        run.eaten = true;
        this.onEatDrop?.(this.spot.x, this.spot.y, ANIM.bite.dripSize * 2);
      }
      if (!run.eaten) this.aimAt(run.view, this.spot.x, this.spot.y);
    } else if (run.drip) {
      const { owner, slot, startLicked, cutPx } = run.drip;
      const drips = owner.glazeDrips;
      this.aimAt(run.view, owner.x + drips.slotX(slot), owner.y + drips.tipY(slot));
      drips.setLicked(slot, startLicked + frame.lap * cutPx);
    }
  }

  /** Points the tongue at a world point. */
  private aimAt(view: LayerView, worldX: number, worldY: number): void {
    const scale = view.faceView.faceScale || 1;
    view.faceView.setLickTarget(
      (worldX - view.x) / scale,
      (worldY - view.y - ANIM.face.centerY) / scale,
    );
  }

  private allowed(index: number, view: LayerView, ctx: LickContext): boolean {
    return lickAllowed({
      plain: view.look.kind !== 'creature',
      faceFree: view.visible && view.faceView.canLick,
      index,
      topIndex: ctx.topIndex,
      aiming: ctx.aiming,
      y: view.y,
      bandTop: ctx.bandTop,
      bandBottom: ctx.bandBottom,
    });
  }

  /** A drop that has just fallen, within reach of a layer's mouth by the time the tongue gets there. */
  private pickDrop(ctx: LickContext): Pick | null {
    const drop = this.fresh;
    if (!drop) return null;
    const age = ctx.nowMs - drop.bornMs;
    if (age > LICK.dropFreshMs) {
      this.fresh = null;
      return null;
    }
    dropCenter(drop, age + LICK.dropGlanceMs + LICK.reachMs, dropEase, this.spot);
    let best: Pick | null = null;
    let bestDistance = Infinity;
    for (const [index, view] of ctx.views) {
      if (!this.allowed(index, view, ctx)) continue;
      const scale = view.faceView.faceScale || 1;
      const dx = (this.spot.x - view.x) / scale;
      const dy = (this.spot.y - view.y - ANIM.face.centerY) / scale;
      if (!inReach(dx, dy) || !clearsEyes(dx, dy)) continue;
      const distance = Math.hypot(dx, dy - ANIM.face.mouthOffsetY);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { index, view, dx, dy, drip: null, drop };
      }
    }
    return best;
  }

  /** A grown drip of a layer, or of the layer above that runs onto it, within reach of the mouth. */
  private pickDrip(ctx: LickContext): Pick | null {
    const found: Pick[] = [];
    const topEdge = -BALANCE.layer.height / 2 + LICK.aboveOverlapPx;
    for (const [index, view] of ctx.views) {
      if (!this.allowed(index, view, ctx)) continue;
      this.collectPicks(view, view, index, found, -Infinity);
      const above = ctx.views.get(index + 1);
      if (above) this.collectPicks(view, above, index, found, topEdge);
    }
    if (found.length === 0) return null;
    return found[this.random.int(0, found.length - 1)] ?? null;
  }

  /** Adds the drips of `owner` that `view` can reach; `minTipY` is how low a tip must hang in `view`. */
  private collectPicks(
    view: LayerView,
    owner: LayerView,
    index: number,
    out: Pick[],
    minTipY: number,
  ): void {
    if (!owner.glazeDrips.hasDrips) return;
    this.scratch.length = 0;
    owner.glazeDrips.collectLickable(LICK.minDripPx, this.scratch);
    const scale = view.faceView.faceScale || 1;
    for (const d of this.scratch) {
      const wx = owner.x + d.x;
      const wy = owner.y + d.tipY;
      if (wy - view.y < minTipY) continue;
      const dx = (wx - view.x) / scale;
      const dy = (wy - view.y - ANIM.face.centerY) / scale;
      if (!inReach(dx, dy) || !clearsEyes(dx, dy)) continue;
      out.push({
        index,
        view,
        dx,
        dy,
        drip: {
          owner,
          slot: d.slot,
          startLicked: owner.glazeDrips.lickedOf(d.slot),
          cutPx: Math.min(LICK.shortenPx, d.length),
        },
        drop: null,
      });
    }
  }
}
