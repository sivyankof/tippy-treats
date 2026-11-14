import { Rng } from '../../core/rng';
import { BALANCE } from '../../data/balance';
import type { CreatureId } from '../../data/creatures';
import { GLAZE_DRIPS } from '../../data/glaze-drips';
import { LICK, type LickStyle } from '../../data/lick';
import { effectsMode } from '../effects-mode';
import { faceHalfSpan } from '../fx/glaze-growth';
import { dropOuter } from './glaze-drip-textures';
import { glazeWave, waveY } from './glaze-wave';
import { layerBox } from './layer-draw';
import type { LayerView } from './layer-view';
import {
  beatStartMs,
  dropPoint,
  lickAllowed,
  lickDurationMs,
  lickGlaze,
  lickStyleFor,
  LickScheduler,
  loopShape,
  type LickGlaze,
  type LickKind,
  type LickScene,
  type LickStage,
  type LoopShape,
} from './lick-plan';

/** Name of the stream the licks draw from, forked from the cosmetic seed of the run. */
const LICK_STREAM = 'lick';
/** Radius of the round part of the lick drop at scale 1 (its centre sits this far above its bottom). */
const DROP_RADIUS = dropOuter(GLAZE_DRIPS.lickLook).width / 2;

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
}

/** A lick under way. */
interface ActiveLick {
  index: number;
  view: LayerView;
  scene: LickScene;
  kind: LickKind;
  style: LickStyle;
  shape: LoopShape;
  /** Where the drop leaves the glaze edge, in face pixels, and its colour. */
  rootY: number;
  color: number;
  stage: LickStage | null;
  /** Neighbours that glance at the lucky one. */
  glancers: LayerView[];
}

/**
 * The lick, the main joke of the tower at rest (docs/06, "Слизывание глазури"): a layer on screen
 * gets a drop of glaze on its face and licks it off, in the big scene or the short one. At most
 * one lick for the whole tower per interval; the timing, the scene, the layer, how the drop comes
 * and the direction come from the cosmetic stream of the run. The face plays the scene, the drop
 * is drawn by the layer's drips; this keeps them together and cues the sounds and the heart.
 */
export class LickDirector {
  private readonly scheduler: LickScheduler;
  private readonly random: Rng;
  private run: ActiveLick | null = null;
  private readonly glaze: LickGlaze = { kind: 'none', x: 0, y: 0, squash: 1, scale: 1 };
  private readonly spot = { x: 0, y: 0 };
  /** The short scene's stroke takes the drop: a short slurp. */
  onSlurp: (() => void) | null = null;
  /** The big scene's tongue shoots out: a long slurp through its whole motion. */
  onSlurpLong: (() => void) | null = null;
  /** The tongue snaps back in: a smack. */
  onSmack: (() => void) | null = null;
  /** The happy end of the big scene: a contented "mmm" and a heart over the head (world point). */
  onHappy: ((x: number, y: number) => void) | null = null;

  constructor(cosmeticSeed: number) {
    this.random = new Rng(cosmeticSeed).fork(LICK_STREAM);
    this.scheduler = new LickScheduler(() => this.random.next());
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
    if (this.scheduler.ready) this.start(ctx, false);
  }

  /** Starts a lick at once if a layer can lick (a dev tool); returns whether it did. */
  lickNow(ctx: LickContext, scene?: LickScene, kind?: LickKind): boolean {
    if (this.run || effectsMode.reduced) return false;
    return this.start(ctx, true, scene, kind);
  }

  /** Drops the lick that is going on. */
  stop(): void {
    if (!this.run) return;
    this.run.view.faceView.cancelLick();
    this.run.view.glazeDrips.hideLick();
    this.run = null;
  }

  private start(ctx: LickContext, forced: boolean, scene?: LickScene, kind?: LickKind): boolean {
    const candidates: Array<[number, LayerView]> = [];
    for (const [index, view] of ctx.views) {
      if (this.allowed(index, view, ctx)) candidates.push([index, view]);
    }
    const picked = candidates[this.random.int(0, candidates.length - 1)];
    if (!picked) {
      if (!forced) this.scheduler.retry();
      return false;
    }
    const [index, view] = picked;
    const face = view.faceView;
    const creature = view.look.kind === 'creature' ? (view.look.creature ?? null) : null;
    const lickScene = scene ?? this.scheduler.nextScene();
    const random = this.random.next();
    // Creatures (and the short scene) lick only a drop that fell from above.
    const lickKind: LickKind =
      lickScene === 'short' || creature
        ? 'fall'
        : (kind ?? (random < LICK.runShare ? 'run' : 'fall'));
    const dir: 1 | -1 = this.random.next() < 0.5 ? -1 : 1;
    const style = lickStyleFor(creature);
    const shape = loopShape(view.drawnWidth, face.faceScale, dir, style);
    const own = view.glazeDrips.ownGlaze;
    const above = ctx.views.get(index + 1)?.glazeDrips.ownGlaze ?? -1;
    face.startLick(lickScene, lickKind, shape, style);
    this.run = {
      index,
      view,
      scene: lickScene,
      kind: lickKind,
      style,
      shape,
      rootY: this.rootY(view, lickScene, lickKind, shape, creature),
      color: lickKind === 'fall' && above >= 0 ? above : own,
      stage: null,
      glancers: [],
    };
    this.scheduler.started();
    this.follow(this.run, ctx);
    return true;
  }

  /** Where the drop leaves the glaze above it, in face pixels: the wavy edge, or a creature's top edge. */
  private rootY(
    view: LayerView,
    scene: LickScene,
    kind: LickKind,
    shape: LoopShape,
    creature: CreatureId | null,
  ): number {
    const face = view.faceView;
    const scale = face.faceScale || 1;
    if (creature) return (-BALANCE.layer.height / 2 - face.y) / scale;
    dropPoint(scene, kind, shape, this.spot);
    const width = view.drawnWidth;
    const wave = glazeWave(layerBox(width), view.cutSide, faceHalfSpan(width, null));
    return (waveY(wave, face.x + this.spot.x * scale) - LICK.glazeInsetPx - face.y) / scale;
  }

  /** Keeps the drop with the face and cues the sounds, the heart and the neighbours. */
  private follow(run: ActiveLick, ctx: LickContext): void {
    const face = run.view.faceView;
    const drips = run.view.glazeDrips;
    const aimingAtTop = run.index === ctx.topIndex && ctx.aiming;
    if (ctx.views.get(run.index) !== run.view || !face.licking || aimingAtTop) {
      // The player started aiming at the top layer, or the face got busy: the lick is off.
      this.stop();
      return;
    }
    const frame = face.lickFrameNow;
    if (frame.stage !== run.stage) {
      run.stage = frame.stage;
      this.cue(run, frame.stage, ctx);
    }
    const scale = face.faceScale || 1;
    this.lickDrips(run, ctx, scale);
    const g = lickGlaze(run.scene, run.kind, run.style, run.shape, frame, run.rootY, this.glaze);
    const x = face.x + g.x * scale;
    const y = face.y + g.y * scale;
    if (g.kind === 'drip') {
      drips.showLickDrip(x, face.y + run.rootY * scale, y, scale, run.color);
    } else if (g.kind === 'drop' && g.scale > 0) {
      const s = scale * g.scale * LICK.drop.dropScale;
      drips.showLickDrop(x, y + DROP_RADIUS * s * g.squash, s, g.squash, run.color);
    } else {
      drips.hideLick();
    }
  }

  /** The tongue licks the growing drips it passes over: the layer's own and those running onto it from above. */
  private lickDrips(run: ActiveLick, ctx: LickContext, scale: number): void {
    const face = run.view.faceView;
    const points = face.tonguePoints;
    if (!points) return;
    const count = LICK.tongue.segments + 1;
    const reach = LICK.tongue.width / 2 + LICK.drip.touchPx;
    run.view.glazeDrips.touch(points, count, face.x, face.y, scale, reach);
    const above = ctx.views.get(run.index + 1);
    if (!above) return;
    const ox = face.x + run.view.x - above.x;
    const oy = face.y + run.view.y - above.y;
    above.glazeDrips.touch(points, count, ox, oy, scale, reach);
  }

  /** Sounds, the heart and the neighbours, each at the start of its beat. */
  private cue(run: ActiveLick, stage: LickStage, ctx: LickContext): void {
    if (run.scene === 'short') {
      if (stage === 'sly') this.glanceNeighbours(run, ctx);
      if (stage === 'stroke') this.onSlurp?.();
      return;
    }
    if (stage === 'notice') this.glanceNeighbours(run, ctx);
    if (stage === 'shoot') this.onSlurpLong?.();
    if (stage === 'lips') this.onSmack?.();
    if (stage === 'happy') {
      const face = run.view.faceView;
      const y = run.view.y + face.y + LICK.happy.heartY * face.faceScale;
      this.onHappy?.(run.view.x + face.x, y);
      const envious = run.glancers[0];
      if (envious && this.random.next() < LICK.envyChance) {
        envious.faceView.lickLipsEnviously(this.random.next() < 0.5 ? -1 : 1);
      }
    }
  }

  /** The layer above and the one below may glance at the lucky one while it licks. */
  private glanceNeighbours(run: ActiveLick, ctx: LickContext): void {
    const face = run.view.faceView;
    const fx = run.view.x + face.x;
    const fy = run.view.y + face.y;
    const left =
      lickDurationMs(run.scene, run.style) -
      beatStartMs(run.scene, run.stage ?? 'arrive', run.style);
    for (const index of [run.index - 1, run.index + 1]) {
      const other = ctx.views.get(index);
      if (!other || !other.visible) continue;
      if (this.random.next() >= LICK.neighbourGlanceChance) continue;
      const otherFace = other.faceView;
      if (otherFace.licking) continue;
      const s = otherFace.faceScale || 1;
      otherFace.glanceAt((fx - other.x - otherFace.x) / s, (fy - other.y - otherFace.y) / s, left);
      run.glancers.push(other);
    }
  }

  private allowed(index: number, view: LayerView, ctx: LickContext): boolean {
    return lickAllowed({
      faceFree: view.visible && view.faceView.canLick,
      index,
      topIndex: ctx.topIndex,
      aiming: ctx.aiming,
      y: view.y,
      bandTop: ctx.bandTop,
      bandBottom: ctx.bandBottom,
    });
  }
}
