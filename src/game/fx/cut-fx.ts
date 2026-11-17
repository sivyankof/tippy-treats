import type * as Phaser from 'phaser';
import { Rng } from '../../core/rng';
import type { LayerPlan } from '../../core/sim-types';
import { BALANCE } from '../../data/balance';
import { LOGICAL_SIZE } from '../../data/screen';
import { lerp, smoothstep } from '../../util/math';
import { CUT_LOOK, CUT_PICTURE, CUT_TEXTURES } from '../../data/cut-look';
import { layerMarks } from '../objects/layer-marks';
import type { LayerView } from '../objects/layer-view';
import { plainLooks } from '../objects/plain-look';
import { effectCues } from './effect-cues';
import { cutOverride } from './cut-override';
import { CutPanic } from './cut-panic';
import { CutStrands, type StrandHooks } from './cut-strands';
import { bakeCutTextures, hangPictureSize } from './cut-textures';
import { cutSpinDegPerSec } from './cut-timeline';
import { chooseCutVariant, forcedCutVariant, type CutPlan, type CutVariant } from './cut-variant';
import type { FallingPieces } from './falling-piece';

/** How many cuts can play at once (cuts come about a second apart and play for about a second). */
const SLOTS = 2;

/** What a cut needs to play. */
export interface CutPlay {
  pieces: FallingPieces;
  /** 1-based number of the layer that was cut. */
  layerNumber: number;
  /** Where the piece went: 1 right, -1 left. */
  side: 1 | -1;
  /** X of the cut edge of the layer, centre y of the layer. */
  edgeX: number;
  y: number;
  /** Width of the layer after the cut, for the drop that stays on it. */
  layerWidth: number;
  pieceX: number;
  pieceWidth: number;
  look: LayerPlan;
  cake: number;
  glaze: number;
  plan: CutPlan;
  /** The crumbs of the cut: called when the piece lets go. */
  crumbs: () => void;
}

interface Slot {
  active: boolean;
  ageMs: number;
  lifeMs: number;
  view: LayerView | null;
  crumbsDone: boolean;
  crumbs: (() => void) | null;
  panic: boolean;
  trace: boolean;
  pieceWidth: number;
  faceShift: number;
  side: 1 | -1;
  layerNumber: number;
  layerWidth: number;
  glaze: number;
  strands: CutStrands;
  panicSet: CutPanic;
  hooks: StrandHooks;
}

/**
 * The cut of an overhang with character (docs/06, "Срезы с характером"): the piece holds still and
 * sags, lets go along the clean cut and falls spinning outwards; some cuts pull glaze strands that
 * snap and leave a drop on the layer, some pieces panic. Also chooses the variant of every cut.
 */
export class CutFx {
  private readonly slots: Slot[] = [];
  private lastBigLayer: number | null = null;
  private next = 0;

  constructor(private readonly scene: Phaser.Scene) {
    bakeCutTextures(scene);
    for (let i = 0; i < SLOTS; i++) this.slots.push(this.makeSlot(scene));
  }

  /** The variant of the cut of layer `layerNumber` (1-based): the forced one, or the run's cosmetic stream decides. */
  variantFor(layerNumber: number, share: number, pieceWidth: number): CutVariant {
    const forced = cutOverride.take();
    const variant = forced
      ? forcedCutVariant(forced)
      : chooseCutVariant({
          seed: plainLooks.cosmeticSeed,
          layerNumber,
          share,
          pieceWidth,
          lastBigLayer: this.lastBigLayer,
        });
    if (variant.big) this.lastBigLayer = layerNumber;
    return variant;
  }

  /** Starts a cut: spawns the piece with its pose and the strands and the arms it needs. */
  play(cut: CutPlay): void {
    const slot = this.slots[this.next]!;
    this.next = (this.next + 1) % SLOTS;
    this.finish(slot);
    const { anticipationMs, fallMs } = CUT_LOOK;
    const lifeMs = anticipationMs + fallMs;
    const ramp = rampOf(cut.plan);
    const view = cut.pieces.spawn({
      layerIndex: cut.layerNumber,
      x: cut.pieceX,
      y: cut.y,
      width: cut.pieceWidth,
      cut: cut.side === 1 ? 'left' : 'right',
      vx: cut.side * ramp.driftSpeed,
      vy: 0,
      spin: cut.side * cutSpinDegPerSec(cut.pieceWidth),
      gravity: CUT_LOOK.gravity,
      lifeMs,
      face: cut.plan.panic ? 'panic' : null,
      look: cut.look,
      cutPose: {
        holdMs: anticipationMs,
        sagPx: CUT_LOOK.sagPx,
        tiltDeg: CUT_LOOK.tiltDeg,
        squash: CUT_LOOK.sagSquash,
        fadeFrom: CUT_LOOK.fadeFrom,
        spinDelayMs: ramp.spinDelayMs,
        spinRampMs: ramp.spinMs,
        gravityStart: ramp.gravityStart,
        gravityMs: ramp.gravityMs,
      },
    });
    slot.active = true;
    slot.ageMs = 0;
    slot.lifeMs = lifeMs;
    slot.view = view;
    slot.crumbsDone = false;
    slot.crumbs = cut.crumbs;
    slot.panic = cut.plan.panic;
    slot.pieceWidth = cut.pieceWidth;
    slot.faceShift = 0;
    slot.trace = cut.plan.trace;
    slot.side = cut.side;
    slot.layerNumber = cut.layerNumber;
    slot.layerWidth = cut.layerWidth;
    slot.glaze = cut.glaze;
    const random = new Rng(plainLooks.cosmeticSeed)
      .fork(CUT_LOOK.stream)
      .fork(`fx${cut.layerNumber}`);
    if (cut.plan.strands) {
      const start = {
        side: cut.side,
        edgeX: cut.edgeX,
        y: cut.y,
        pieceWidth: cut.pieceWidth,
        glaze: cut.glaze,
      };
      slot.strands.begin(start, random);
    }
    if (cut.plan.panic) slot.panicSet.begin(cut.pieceWidth, BALANCE.layer.height, cut.cake, random);
  }

  update(dtMs: number): void {
    for (const slot of this.slots) {
      if (slot.active) this.updateSlot(slot, dtMs);
    }
  }

  private updateSlot(slot: Slot, dtMs: number): void {
    slot.ageMs += dtMs;
    const view = slot.view;
    if (!view || slot.ageMs >= slot.lifeMs || !view.visible) {
      this.finish(slot);
      return;
    }
    const since = slot.ageMs - CUT_LOOK.anticipationMs;
    if (since >= 0 && !slot.crumbsDone) {
      slot.crumbsDone = true;
      slot.crumbs?.();
      view.dropShadow();
      if (slot.panic) effectCues.emit({ kind: 'cutPanic' });
    }
    slot.strands.update(since, dtMs, view, slot.hooks);
    if (slot.panic) {
      slot.panicSet.update(slot.ageMs, view, view.alpha);
      this.keepFaceInView(slot, view);
    }
  }

  /** A big scared piece slides its face along the piece so the face stays on the screen. */
  private keepFaceInView(slot: Slot, view: LayerView): void {
    const { faceKeepPx } = CUT_LOOK.panic;
    const cos = Math.cos(view.rotation);
    const maxShift = Math.max(0, slot.pieceWidth / 2 - faceKeepPx);
    let wanted = 0;
    // Only while the piece is turned flat enough for a sideways move to move the face along the screen.
    const flat = smoothstep((Math.abs(cos) - 0.2) / 0.3);
    if (flat > 0) {
      const farRight = LOGICAL_SIZE.width - faceKeepPx;
      const x = view.x;
      const target = Math.min(farRight, Math.max(faceKeepPx, x));
      wanted = Math.min(maxShift, Math.max(-maxShift, (target - x) / cos)) * flat;
    }
    slot.faceShift = lerp(slot.faceShift, wanted, CUT_LOOK.panic.faceEase);
    view.setFaceShift(slot.faceShift);
  }

  private finish(slot: Slot): void {
    slot.active = false;
    slot.view = null;
    slot.crumbs = null;
    slot.strands.stop();
    slot.panicSet.stop();
  }

  private makeSlot(scene: Phaser.Scene): Slot {
    const slot: Slot = {
      active: false,
      ageMs: 0,
      lifeMs: 0,
      view: null,
      crumbsDone: false,
      crumbs: null,
      panic: false,
      trace: false,
      pieceWidth: 0,
      faceShift: 0,
      side: 1,
      layerNumber: 0,
      layerWidth: 0,
      glaze: 0xffffff,
      strands: new CutStrands(scene),
      panicSet: new CutPanic(scene),
      hooks: { snapped: () => undefined },
    };
    slot.hooks = {
      snapped: (_x, _y, first, main) => {
        if (first) effectCues.emit({ kind: 'cutStrandSnap' });
        if (main && slot.trace) this.leaveTrace(slot);
      },
    };
    return slot;
  }

  /** The drop that stays hanging on the cut edge of the layer for the rest of the run. */
  private leaveTrace(slot: Slot): void {
    const { trace } = CUT_LOOK.strands;
    const size = hangPictureSize();
    layerMarks.addCut(slot.layerNumber, {
      texture: CUT_TEXTURES.hang,
      dx: slot.side * (slot.layerWidth / 2 - trace.insetPx),
      dy: trace.y,
      originX: 0.5,
      originY: size.originY,
      width: (trace.widthPx * size.width) / CUT_PICTURE.hang.width,
      height: (trace.heightPx * size.height) / CUT_PICTURE.hang.height,
      tint: slot.glaze,
      bornMs: this.scene.time.now,
      growMs: trace.growMs,
      swing: trace.swing,
    });
  }
}

/** The build-up of the let-go for a cut with these traits: the slowest of the applicable ones. */
function rampOf(plan: CutPlan): Ramp {
  const { ramp } = CUT_LOOK;
  const kinds: Ramp[] = [ramp.plain];
  if (plan.strands) kinds.push(ramp.strands);
  if (plan.panic) kinds.push(ramp.panic);
  return {
    spinDelayMs: Math.max(...kinds.map((k) => k.spinDelayMs)),
    spinMs: Math.max(...kinds.map((k) => k.spinMs)),
    gravityStart: Math.min(...kinds.map((k) => k.gravityStart)),
    gravityMs: Math.max(...kinds.map((k) => k.gravityMs)),
    driftSpeed: Math.max(...kinds.map((k) => k.driftSpeed)),
  };
}

interface Ramp {
  spinDelayMs: number;
  spinMs: number;
  gravityStart: number;
  gravityMs: number;
  driftSpeed: number;
}
