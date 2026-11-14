import type * as Phaser from 'phaser';
import { LICK, type LickStyle } from '../../data/lick';
import { frameLerp } from '../../util/math';
import type { FaceParts } from './face-parts';
import type { Reaction } from './face-state';
import {
  beatMs,
  beatStartMs,
  dropPoint,
  lickFace,
  lickFrame,
  lipsTongue,
  newLickFace,
  newLickFrame,
  newLipsTongue,
  reachedPhase,
  tongueBody,
  type LickFrame,
  type LickKind,
  type LickScene,
  type LickStage,
  type LoopShape,
} from './lick-plan';
import { TongueView } from './tongue-view';

/** What a lick needs from the face it plays on. */
export interface LickHost {
  readonly parts: FaceParts;
  /** The face container: the tongue is added to it, over the parts. */
  readonly container: Phaser.GameObjects.Container;
  reaction(): Reaction | null;
  react(reaction: Reaction, ms: number): void;
  clearReaction(): void;
  /** The pupils go all the way towards (dx, dy). */
  lookFull(dx: number, dy: number): void;
  /** Back to the plain expression and layout (the pose of the lick is laid over it). */
  restore(): void;
  /** Mouth and cheeks fit on the layer. */
  showRest(): boolean;
}

const MOUTH_Y = LICK.loop.centerY + LICK.loop.ry;
/** One tongue per scene, shared by every face: it is only ever out on one face at a time. */
const SHARED_TONGUES = new WeakMap<Phaser.Scene, TongueView>();

/**
 * The lick played on one face (docs/06, "Слизывание глазури"): the beats of the scene, the pose
 * of the face over its expression, the long tongue and its trail, and the face denting after the
 * tongue. Also the short glance at a neighbour's lick and the envious lick of the lips.
 */
export class FaceLick {
  private ms = -1;
  private scene: LickScene = 'big';
  private kind: LickKind = 'fall';
  private style: LickStyle = LICK.styles.plain;
  private shape: LoopShape = { rx: LICK.loop.rx, dir: 1, peak: LICK.peak.px };
  private stage: LickStage | null = null;
  private readonly frame: LickFrame = newLickFrame();
  private readonly pose = newLickFace();
  private readonly lips = newLipsTongue();
  private readonly envyPose = newLickFace();
  private readonly points: number[] = [];
  private readonly drop = { x: 0, y: 0 };
  private tongue: TongueView | null = null;
  private tongueOut = false;
  /** The face dents after the tongue: offset and stretch as they are now. */
  private dentX = 0;
  private dentY = 0;
  private stretchX = 0;
  private stretchY = 0;
  private glanceMs = 0;
  private envyMs = -1;
  private envySide: 1 | -1 = 1;

  constructor(private readonly host: LickHost) {}

  /** A lick is playing. */
  get active(): boolean {
    return this.ms >= 0;
  }

  /** The eyes are taken: a lick, a glance at a neighbour or an envious lick of the lips. */
  get busy(): boolean {
    return this.ms >= 0 || this.glanceMs > 0 || this.envyMs >= 0;
  }

  get frameNow(): Readonly<LickFrame> {
    return this.frame;
  }

  /** The points of the tongue (face pixels, `LICK.tongue.segments + 1` of them) while it is out. */
  get tonguePoints(): readonly number[] | null {
    return this.tongueOut ? this.points : null;
  }

  /** Starts a lick: `scene`, how the drop comes (`kind`), the loop of the tongue and the creature's style. */
  start(scene: LickScene, kind: LickKind, shape: LoopShape, style: LickStyle): void {
    this.ms = 0;
    this.scene = scene;
    this.kind = kind;
    this.shape = shape;
    this.style = style;
    this.stage = null;
    this.glanceMs = 0;
    this.envyMs = -1;
    lickFrame(scene, 0, style, this.frame);
    const until = scene === 'big' ? 'happy' : 'done';
    this.host.react('lick', beatStartMs(scene, until, style));
    this.tongueView().clear();
  }

  /** Glances at (`dx`, `dy`) for `ms` (a neighbour licks). */
  glance(dx: number, dy: number, ms: number): void {
    if (this.ms >= 0) return;
    this.host.lookFull(dx, dy);
    this.glanceMs = ms;
  }

  /** Licks the lips enviously, from the `side` corner. */
  envy(side: 1 | -1): void {
    if (this.ms >= 0 || !this.host.showRest()) return;
    this.envyMs = 0;
    this.envySide = side;
    this.host.react('lick', LICK.lips.envyMs);
  }

  /** Stops whatever plays at once. */
  cancel(): void {
    if (this.envyMs >= 0) this.endEnvy();
    if (this.ms >= 0) this.end();
    this.glanceMs = 0;
  }

  /** Advances the lick; call after the expression of the frame is resolved. */
  tick(dtMs: number): void {
    if (this.glanceMs > 0) this.glanceMs -= dtMs;
    if (this.envyMs >= 0) this.tickEnvy(dtMs);
    if (this.ms < 0) return;
    this.ms += dtMs;
    const { scene, style } = this;
    const frame = lickFrame(scene, this.ms, style, this.frame);
    if (frame.stage !== this.stage) this.enterStage(frame.stage);
    if (frame.stage === 'done') {
      this.end();
      return;
    }
    // A stronger face took over (ouch, an ability, horror): the lick is off.
    const shown = this.host.reaction();
    const own: Reaction = frame.stage === 'happy' ? (style.wink ? 'wink' : 'joy') : 'lick';
    if (shown !== own && shown !== 'blink') {
      this.end();
      return;
    }
    const parts = this.host.parts;
    const face = lickFace(scene, frame, style, this.shape.dir, this.pose);
    parts.poseLick(face);
    const lipsStroke = scene === 'big' && frame.stage === 'lips' && style.lips;
    parts.placeLipsTongue(lipsStroke ? lipsTongue(frame.p, this.shape.dir, this.lips) : null);
    if (face.look) {
      dropPoint(scene, this.kind, this.shape, this.drop);
      this.host.lookFull(this.drop.x, this.drop.y);
    }
    this.layTongue(frame, face.dent, dtMs);
    parts.setScale(face.scaleX * (1 + this.stretchX), face.scaleY * (1 + this.stretchY));
    parts.setPosition(this.dentX, this.dentY);
  }

  /** Forgets everything (a pooled face). */
  reset(): void {
    this.tongueOut = false;
    this.ms = -1;
    this.stage = null;
    this.glanceMs = 0;
    this.envyMs = -1;
    this.dentX = this.dentY = this.stretchX = this.stretchY = 0;
    if (this.tongue?.parentContainer === this.host.container) this.tongue.clear();
  }

  private enterStage(stage: LickStage): void {
    this.stage = stage;
    // Each beat starts from the plain expression; the pose is laid over it every frame.
    if (stage === 'happy') {
      if (this.host.reaction() === 'lick') this.host.clearReaction();
      const { style } = this;
      this.host.react(
        style.wink ? 'wink' : 'joy',
        beatMs('big', 'happy', style) + LICK.happy.lingerMs,
      );
    }
    this.host.restore();
  }

  /** The long tongue, its saliva and trail, and the face denting after its tip. */
  private layTongue(frame: Readonly<LickFrame>, dent: boolean, dtMs: number): void {
    const view = this.tongueView();
    const width = this.host.showRest()
      ? tongueBody(this.scene, frame, this.style, this.shape, this.points)
      : 0;
    this.tongueOut = width > 0;
    if (width > 0) {
      view.layTongue(this.points, width);
      const n = LICK.tongue.segments;
      const dx = this.points[n * 2]!;
      const dy = this.points[n * 2 + 1]! - MOUTH_Y;
      const length = Math.hypot(dx, dy) || 1;
      if (dent) {
        const { px, stretch } = LICK.face.dent;
        this.follow(
          dtMs,
          (dx / length) * px,
          (dy / length) * px,
          (Math.abs(dx) / length) * stretch,
          (Math.abs(dy) / length) * stretch,
        );
      }
      const hold = frame.stage === 'hold' ? frame.p : frame.stage === 'curl' ? 1 : 0;
      view.hangSaliva(this.points, hold);
    } else {
      view.hideTongue();
    }
    if (!dent) this.follow(dtMs, 0, 0, 0, 0);
    if (this.scene === 'big') {
      const reached = reachedPhase(frame, this.style);
      const to = this.style.sweep >= 1 ? LICK.loop.loopTo : this.style.sweep;
      view.updateTrail(reached, LICK.loop.shootTo, to, this.shape, frame.tMs);
    }
  }

  private follow(dtMs: number, x: number, y: number, sx: number, sy: number): void {
    const k = frameLerp(LICK.face.dent.lerp, dtMs);
    this.dentX += (x - this.dentX) * k;
    this.dentY += (y - this.dentY) * k;
    this.stretchX += (sx - this.stretchX) * k;
    this.stretchY += (sy - this.stretchY) * k;
  }

  private tickEnvy(dtMs: number): void {
    this.envyMs += dtMs;
    const p = this.envyMs / LICK.lips.envyMs;
    if (p >= 1 || this.host.reaction() !== 'lick') {
      this.endEnvy();
      return;
    }
    this.envyPose.mouth = 'wide';
    this.envyPose.open = LICK.face.wideScale;
    this.host.parts.poseLick(this.envyPose);
    this.host.parts.placeLipsTongue(lipsTongue(p, this.envySide, this.lips));
  }

  private endEnvy(): void {
    this.envyMs = -1;
    this.host.parts.placeLipsTongue(null);
    if (this.host.reaction() === 'lick') this.host.clearReaction();
    this.host.restore();
  }

  private end(): void {
    this.ms = -1;
    this.stage = null;
    this.tongueOut = false;
    this.dentX = this.dentY = this.stretchX = this.stretchY = 0;
    if (this.tongue?.parentContainer === this.host.container) this.tongue.clear();
    this.host.parts.placeLipsTongue(null);
    if (this.host.reaction() === 'lick') this.host.clearReaction();
    this.host.restore();
  }

  /** The tongue of the scene, moved into this face (one lick plays at a time). */
  private tongueView(): TongueView {
    const container = this.host.container;
    let view = SHARED_TONGUES.get(container.scene);
    // A view destroyed with the scene of an earlier run has no scene any more.
    if (!view || !view.scene) {
      view = new TongueView(container.scene);
      SHARED_TONGUES.set(container.scene, view);
    }
    // Adding it moves it out of the face that licked before, on top of this face's parts.
    if (view.parentContainer !== container) container.add(view);
    this.tongue = view;
    return view;
  }
}
