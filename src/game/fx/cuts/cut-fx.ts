import * as Phaser from 'phaser';
import { Rng } from '../../../core/common/rng';
import type { LayerPlan } from '../../../core/tower/sim-types';
import { BALANCE } from '../../../data/tower/balance';
import { LOGICAL_SIZE } from '../../../data/app/screen';
import { lerp, smoothstep } from '../../../util/math';
import { mixColor } from '../../../util/color';
import type { CreatureId } from '../../../data/creatures/creatures';
import { CUT_LOOK } from '../../../data/cuts/cut-look';
import { collectBakeSteps } from '../../ui/common/bake-texture';
import { dripTexturesFor, glazeEdgeTone } from '../../objects/glaze/glaze-drip-layer';
import { layerMarks } from '../../objects/tower/layer-marks';
import type { LayerView } from '../../objects/tower/layer-view';
import { plainLooks } from '../../objects/tower/plain-look';
import { effectCues } from '../audio/effect-cues';
import { cutOverride } from './cut-override';
import { CutPanic } from './cut-panic';
import { CutStrands, type StrandHooks } from './cut-strands';
import { bakeCutTextures } from './cut-textures';
import { cutSpinDegPerSec } from './cut-timeline';
import { traceSpot } from './cut-trace-place';
import { chooseCutVariant, forcedCutVariant, type CutPlan, type CutVariant } from './cut-variant';
import type { FallingPieces } from '../tower/falling-piece';

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
  /** The creature of the layer (its drips and glaze edge have their own tone and size), null for a plain one. */
  creature: CreatureId | null;
  plan: CutPlan;
  /** The crumbs of the cut: called when the piece lets go. */
  crumbs: () => void;
  /** Writes where the centre of the cut layer is now (it sways); false when the layer is gone. */
  layerCenter: (out: { x: number; y: number }) => boolean;
}

interface Slot {
  active: boolean;
  ageMs: number;
  lifeMs: number;
  view: LayerView | null;
  /** The pool the view comes from and which piece it showed when the cut began. */
  pieces: FallingPieces | null;
  token: number;
  crumbsDone: boolean;
  crumbs: (() => void) | null;
  panic: boolean;
  /** Strands are pulling on this cut (it has the stretch sound). */
  pull: boolean;
  trace: boolean;
  /** The cut layer is a plain one (a wavy glaze edge), not a creature. */
  plain: boolean;
  pieceWidth: number;
  faceShift: number;
  side: 1 | -1;
  layerNumber: number;
  layerWidth: number;
  /** The picture of the end of this layer's drips: the drop that stays on the cut (null when it is not baked). */
  hang: string | null;
  hangSize: number;
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
  /** Strands are bending strips: the Canvas renderer has none, so there the cut plays without them. */
  private readonly strips: boolean;

  constructor(private readonly scene: Phaser.Scene) {
    bakeCutTextures(scene);
    this.strips = scene.game.renderer.type !== Phaser.CANVAS;
    for (let i = 0; i < SLOTS; i++) this.slots.push(this.makeSlot(scene));
  }

  /** True when the strands can be shown (not on the Canvas renderer): otherwise the caller plays the plain cut. */
  get showsStrands(): boolean {
    return this.strips;
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
    slot.pieces = cut.pieces;
    slot.token = cut.pieces.generationOf(view);
    slot.crumbsDone = false;
    slot.crumbs = cut.crumbs;
    slot.panic = cut.plan.panic;
    slot.pull = false;
    slot.pieceWidth = cut.pieceWidth;
    slot.faceShift = 0;
    slot.trace = cut.plan.trace;
    slot.plain = cut.look.kind === 'plain' && cut.creature === null;
    slot.side = cut.side;
    slot.layerNumber = cut.layerNumber;
    slot.layerWidth = cut.layerWidth;
    if (cut.plan.trace) this.findHang(slot, cut);
    else slot.hang = null;
    const random = new Rng(plainLooks.cosmeticSeed)
      .fork(CUT_LOOK.stream)
      .fork(`fx${cut.layerNumber}`);
    // Without strips nothing snaps to leave the drop: it stays on the cut at once.
    if (cut.plan.trace && !this.strips) this.leaveTrace(slot);
    if (cut.plan.strands && this.strips) {
      const start = {
        side: cut.side,
        edgeX: cut.edgeX,
        y: cut.y,
        pieceWidth: cut.pieceWidth,
        layerWidth: cut.layerWidth,
        driftSpeed: ramp.driftSpeed,
        glaze: cut.glaze,
        outline: strandOutline(cut.creature, cut.glaze),
        layerCenter: cut.layerCenter,
      };
      slot.strands.begin(start, random);
      slot.pull = true;
    }
    if (cut.plan.panic)
      slot.panicSet.begin(cut.pieceWidth, BALANCE.layer.height, cut.cake, cut.side, random);
  }

  update(dtMs: number): void {
    for (const slot of this.slots) {
      if (slot.active) this.updateSlot(slot, dtMs);
    }
  }

  private updateSlot(slot: Slot, dtMs: number): void {
    slot.ageMs += dtMs;
    const view = slot.view;
    // The pool recycles the oldest piece when it is full: then the view is no longer this cut's.
    const taken = view !== null && slot.pieces?.generationOf(view) !== slot.token;
    if (!view || taken || slot.ageMs >= slot.lifeMs || !view.visible) {
      this.finish(slot);
      return;
    }
    const since = slot.ageMs - CUT_LOOK.anticipationMs;
    if (since >= 0 && !slot.crumbsDone) {
      slot.crumbsDone = true;
      slot.crumbs?.();
      view.dropShadow();
      if (slot.pull) effectCues.emit({ kind: 'cutStretch' });
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
    const { faceKeepPx, flatFrom, flatRange } = CUT_LOOK.panic;
    const cos = Math.cos(view.rotation);
    const maxShift = Math.max(0, slot.pieceWidth / 2 - faceKeepPx);
    let wanted = 0;
    // Only while the piece is turned flat enough for a sideways move to move the face along the screen.
    const flat = smoothstep((Math.abs(cos) - flatFrom) / flatRange);
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
    slot.pieces = null;
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
      pieces: null,
      token: 0,
      crumbsDone: false,
      crumbs: null,
      panic: false,
      pull: false,
      trace: false,
      plain: true,
      pieceWidth: 0,
      faceShift: 0,
      side: 1,
      layerNumber: 0,
      layerWidth: 0,
      hang: null,
      hangSize: 0,
      strands: new CutStrands(scene),
      panicSet: new CutPanic(scene),
      hooks: { snapped: () => undefined, dropped: () => undefined },
    };
    slot.hooks = {
      snapped: (_x, _y, _first, main) => {
        // Every strand has its own small snap (the sound gate merges the ones at the same moment).
        effectCues.emit({ kind: 'cutStrandSnap' });
        if (main && slot.trace) this.leaveTrace(slot);
      },
      dropped: () => effectCues.emit({ kind: 'cutDrip' }),
    };
    return slot;
  }

  /**
   * The drop that will stay on the cut: the round end of this layer's own drips, the same picture
   * and size. Only the round end is needed, and only a picture baked already (the layer's drips
   * were shown): nothing is baked mid-run (the recorded bake steps are dropped, not run).
   */
  private findHang(slot: Slot, cut: CutPlay): void {
    let key = '';
    collectBakeSteps(() => {
      key = dripTexturesFor(this.scene, cut.creature, cut.glaze).bulb;
    });
    const baked = this.scene.textures.exists(key);
    slot.hang = baked ? key : null;
    slot.hangSize = baked ? this.scene.textures.getFrame(key).width : 0;
  }

  /** The drop that stays hanging on the cut edge of the layer for the rest of the run. */
  private leaveTrace(slot: Slot): void {
    if (!slot.hang) return;
    const { trace } = CUT_LOOK.strands;
    const spot = traceSpot(slot.layerWidth, slot.side, slot.hangSize, slot.plain);
    layerMarks.addCut(slot.layerNumber, [
      {
        texture: slot.hang,
        dx: spot.dx,
        dy: spot.dy,
        originX: 0.5,
        originY: 0,
        width: slot.hangSize,
        height: slot.hangSize,
        bornMs: this.scene.time.now,
        growMs: trace.growMs,
        swing: trace.swing,
      },
    ]);
  }
}

/** The outline of the strands: the dark tone of the glaze edge, warmed (amber on a yellow glaze, not olive). */
export function strandOutline(creature: CreatureId | null, glaze: number): number {
  const { color, share } = CUT_LOOK.strands.warm;
  return mixColor(glazeEdgeTone(creature, glaze), color, share);
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
