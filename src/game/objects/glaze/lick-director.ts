import { Rng } from '../../../core/common/rng';
import { BALANCE } from '../../../data/tower/balance';
import type { CreatureId } from '../../../data/creatures/creatures';
import { GLAZE_DRIPS } from '../../../data/glaze/glaze-drips';
import { LICK, type LickStyle } from '../../../data/glaze/lick';
import { fxGuard } from '../../common/fx-guard';
import { effectsMode } from '../../app/effects-mode';
import { faceHalfSpan } from '../../fx/glaze/glaze-growth';
import { dropOuter } from './glaze-drip-textures';
import { glazeWave, waveY } from './glaze-wave';
import { layerBox } from '../tower/layer-draw';
import { layerMarks, type LayerMarkStore } from '../tower/layer-mark-store';
import type { LayerView } from '../tower/layer-view';
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
import { JuiceQueue, stainTarget, type JuiceCheck, type JuiceStain } from './juice-lick-plan';
import { tongueOuterWidth } from './tongue-shape';

/** Name of the stream the licks draw from, forked from the cosmetic seed of the run. */
const LICK_STREAM = 'lick';
/** The stream of the juice licks (who glances), so they never shift the natural licks. */
const JUICE_STREAM = 'lick-juice';
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
  /** Scene time (ms), the clock the marks of the layers run on. */
  nowMs: number;
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
  /** The juice stain this lick takes (a stain lick), and whether the tongue has taken it. */
  juice: JuiceStain | null;
  taken: boolean;
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
  private readonly juiceRandom: Rng;
  private readonly juice = new JuiceQueue();
  /** Time the director has run, ms: the clock of the juice queue. */
  private clockMs = 0;
  private run: ActiveLick | null = null;
  private readonly glaze: LickGlaze = { kind: 'none', x: 0, y: 0, squash: 1, scale: 1 };
  private readonly spot = { x: 0, y: 0 };
  /** The short scene's stroke takes the drop: a short slurp. */
  onSlurp: (() => void) | null = null;
  /** The short scene's stroke takes a juice stain: a shorter, quieter slurp. */
  onSlurpJuice: (() => void) | null = null;
  /** The big scene's tongue shoots out: a long slurp through its whole motion. */
  onSlurpLong: (() => void) | null = null;
  /** The tongue snaps back in: a smack. */
  onSmack: (() => void) | null = null;
  /** The happy end of the big scene: a contented "mmm" and a heart over the head (world point). */
  onHappy: ((x: number, y: number) => void) | null = null;

  constructor(
    cosmeticSeed: number,
    private readonly marks: LayerMarkStore = layerMarks,
  ) {
    this.random = new Rng(cosmeticSeed).fork(LICK_STREAM);
    this.juiceRandom = new Rng(cosmeticSeed).fork(JUICE_STREAM);
    this.scheduler = new LickScheduler(() => this.random.next());
  }

  /** Advances the lick and, when it is time, starts a new one. A failure drops the lick, not the run. */
  update(dtMs: number, ctx: LickContext): void {
    this.clockMs += dtMs;
    if (!fxGuard.call('lick', this, this.advance, dtMs, ctx))
      fxGuard.cleanup('lick', this, this.drop);
  }

  private advance(dtMs: number, ctx: LickContext): void {
    this.marks.sweep(ctx.nowMs);
    if (effectsMode.reduced) {
      this.stop();
      for (const stain of this.juice.clear()) this.marks.removePress(stain.index + 1);
      return;
    }
    if (!ctx.calm) {
      this.stop();
      return;
    }
    // A stain waiting to be licked comes before the idle timer, but never breaks into a scene that is on.
    if (this.pollJuice(ctx)) return;
    if (this.run) {
      this.follow(this.run, ctx);
      return;
    }
    this.scheduler.tick(dtMs);
    if (this.scheduler.ready) this.start(ctx, false);
  }

  /** A juice stain was left on layer `index` (0-based): about a second later it is licked off, or melts. */
  queueJuice(index: number): void {
    this.juice.add(index, this.clockMs);
  }

  /** The beat the lick that is on has reached; `null` when none is on. */
  get stage(): LickStage | null {
    return this.run?.stage ?? null;
  }

  /** Starts a lick at once if a layer can lick (a dev tool); returns whether it did. */
  lickNow(ctx: LickContext, scene?: LickScene, kind?: LickKind): boolean {
    if (this.run || effectsMode.reduced) return false;
    return fxGuard.value(
      'lick',
      () => this.start(ctx, true, scene, kind),
      false,
      () => this.drop(),
    );
  }

  /** Drops the lick that is going on. */
  stop(): void {
    const run = this.run;
    if (!run) return;
    run.view.faceView.cancelLick();
    run.view.glazeDrips.hideLick();
    this.run = null;
    this.endJuice(run);
  }

  /** A stain lick is over: the next waits its pause and the idle timer keeps off; one broken off before the stroke asks again. */
  private endJuice(run: ActiveLick): void {
    if (!run.juice) return;
    if (!run.taken) {
      this.juice.retry(run.juice, this.clockMs);
      return;
    }
    this.juice.done(this.clockMs);
    this.scheduler.hold(LICK.juice.idleAfterMs);
  }

  /** After a failure: the lick is forgotten first, so a second failure while stopping it cannot repeat. */
  private drop(): void {
    const run = this.run;
    this.run = null;
    if (!run) return;
    // A stain lick that failed leaves no stain behind.
    if (run.juice) {
      this.marks.removePress(run.index + 1);
      this.juice.done(this.clockMs);
    }
    fxGuard.run('lick-stop', () => {
      run.view.faceView.cancelLick();
      run.view.glazeDrips.hideLick();
    });
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
    // A forced scene leaves the scheduler alone, so a poke does not change the natural licks after it.
    // A natural one asks it at every level, so the stream of random numbers does not depend on the level.
    const lickScene = scene ?? this.naturalScene();
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
    if (!face.startLick(lickScene, lickKind, shape, style)) {
      // No tongue to lay: the lick is a decoration, skipped like a tower with no face free.
      if (!forced) this.scheduler.retry();
      return false;
    }
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
      juice: null,
      taken: false,
    };
    this.scheduler.started();
    this.follow(this.run, ctx);
    return true;
  }

  /**
   * The juice queue's turn: melts what has to melt and starts the lick of a stain that is ready.
   * True when a lick started (it has played its first frame).
   */
  private pollJuice(ctx: LickContext): boolean {
    const action = this.juice.poll(
      this.clockMs,
      this.run !== null,
      !effectsMode.atMost('lite'),
      (index) => this.juiceCheck(index, ctx),
    );
    if (action.kind === 'melt') {
      this.marks.vanishPress(action.stain.index + 1, ctx.nowMs, LICK.juice.vanishMs);
      return false;
    }
    if (action.kind === 'lick') return this.startJuice(action.stain, ctx);
    return false;
  }

  /** What the layer of a stain can do now: gone (no layer on screen or no stain), able to lick, or has to wait. */
  private juiceCheck(index: number, ctx: LickContext): JuiceCheck {
    const view = ctx.views.get(index);
    if (!view || !this.marks.hasPress(index + 1)) return 'gone';
    if (view.y < ctx.bandTop || view.y > ctx.bandBottom) return 'gone';
    return this.allowed(index, view, ctx) ? 'ok' : 'wait';
  }

  /** The short scene aimed at the stain of layer `stain.index`; false when it could not start. */
  private startJuice(stain: JuiceStain, ctx: LickContext): boolean {
    const view = ctx.views.get(stain.index);
    const mark = this.marks.at(stain.index + 1)?.press?.[0];
    if (!view || !mark) return false;
    const face = view.faceView;
    const target = stainTarget(mark, face.x, face.y, face.faceScale, { x: 0, y: 0 });
    const dir: 1 | -1 = target.x < 0 ? -1 : 1;
    const style = lickStyleFor(null);
    const shape: LoopShape = { ...loopShape(view.drawnWidth, face.faceScale, dir, style), target };
    if (!face.startLick('short', 'stain', shape, style)) {
      this.juice.retry(stain, this.clockMs);
      return false;
    }
    this.run = {
      index: stain.index,
      view,
      scene: 'short',
      kind: 'stain',
      style,
      shape,
      rootY: 0,
      color: 0,
      stage: null,
      glancers: [],
      juice: stain,
      taken: false,
    };
    this.follow(this.run, ctx);
    return true;
  }

  /** The scene the scheduler picks; on lite a big one is swapped for a short one. */
  private naturalScene(): LickScene {
    const scheduled = this.scheduler.nextScene();
    return effectsMode.atMost('lite') ? 'short' : scheduled;
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
    if (
      run.juice &&
      !run.taken &&
      (frame.stage === 'back' || (frame.stage === 'stroke' && frame.p >= LICK.shortPath.takeAt))
    ) {
      // The tip takes the stain: it shrinks away with it.
      run.taken = true;
      this.marks.vanishPress(run.index + 1, ctx.nowMs, LICK.juice.vanishMs);
    }
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
    const reach = tongueOuterWidth(run.scene) / 2 + LICK.drip.touchPx;
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
      if (stage === 'stroke') (run.juice ? this.onSlurpJuice : this.onSlurp)?.();
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
      if (this.rngOf(run).next() >= LICK.neighbourGlanceChance) continue;
      const otherFace = other.faceView;
      if (otherFace.licking) continue;
      other.glanceAtWorld(fx, fy, left);
      run.glancers.push(other);
    }
  }

  /** The stream a lick draws from: stain licks have their own. */
  private rngOf(run: ActiveLick): Rng {
    return run.juice ? this.juiceRandom : this.random;
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
