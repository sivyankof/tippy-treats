import { DEPTH } from '../../common/depth';
import type * as Phaser from 'phaser';
import type { SimEvent, TowerState } from '../../../core/tower/tower-sim';
import { ANIM } from '../../../data/common/anim';
import { BALANCE } from '../../../data/tower/balance';
import { pickInt } from '../../../util/math';
import { decorTints } from '../../objects/tower/decor-draw';
import { decorItems } from '../../objects/tower/decor-layout';
import { glazeCrestY } from '../../objects/glaze/glaze-wave';
import { cakeColorsFor, lookCodeFor } from '../../objects/tower/layer-art';
import { layerBox } from '../../objects/tower/layer-draw';
import { lookOfCode } from '../../objects/tower/plain-look';
import { effectsMode } from '../../app/effects-mode';
import { fxGuard } from '../../common/fx-guard';
import type { LayerView } from '../../objects/tower/layer-view';
import type { LayerPose, TowerView } from '../../objects/tower/tower-view';
import { driftMotion } from '../common/anim-curves';
import { CutFx } from '../cuts/cut-fx';
import { cutPlanFor } from '../cuts/cut-variant';
import { FallingPieces } from './falling-piece';
import { GlazeDrip } from '../glaze/glaze-drip';
import type { LandedLayer, LandingFx } from './landing-fx';
import type { FlyingMemo } from '../run/run-fx';

type LandEvent = Extract<SimEvent, { type: 'land' }>;

/**
 * Bits that come off the tower: the bitten-off overhang with its crumbs and glaze drops, the
 * crumbs of a sneeze and the layer that missed. Owns the pooled falling pieces.
 */
export class DebrisFx {
  readonly pieces: FallingPieces;
  private readonly drips: GlazeDrip;
  private readonly cuts: CutFx;
  /** Scratch pose for the cut effect, which asks where the cut layer is every frame. */
  private readonly cutPose: LayerPose = {
    x: 0,
    y: 0,
    width: 0,
    angle: 0,
    cut: null,
    look: { kind: 'plain' },
  };

  constructor(
    scene: Phaser.Scene,
    private readonly tower: TowerView,
    private readonly landing: LandingFx,
  ) {
    this.pieces = new FallingPieces(scene);
    this.drips = new GlazeDrip(scene);
    this.cuts = new CutFx(scene);
  }

  update(dtMs: number): void {
    this.pieces.update(dtMs);
    this.drips.update(dtMs);
    fxGuard.call('cut-fx', this.cuts, this.cuts.update, dtMs);
  }

  /** Crumbs fly out of both sides of the top layer. */
  sneeze(state: Readonly<TowerState>): void {
    const index = state.layers.length - 1;
    const pose = this.tower.layerPose(index);
    if (!pose) return;
    const layer = state.layers[index];
    const colors = cakeColorsFor(layer?.creature ?? null, index + 1, layer?.kind === 'golden');
    this.landing.sneezed(pose, colors.cake);
  }

  /**
   * The layer that missed falls past the tower. It would have been the next layer: twins do
   * not shift it. Returns the piece so the miss reaction can look at it.
   */
  dropMissed(memo: FlyingMemo, state: Readonly<TowerState>): LayerView {
    const side = memo.x >= this.tower.topViewX() ? 1 : -1;
    return this.pieces.spawn({
      layerIndex: state.layers.length + 1,
      x: memo.x,
      y: this.tower.layerCenterY(state.layers.length),
      width: memo.width,
      cut: null,
      ...driftMotion(ANIM.miss, side),
      face: 'horror',
      look: memo,
      // The topper of the missed layer falls with it.
      topper: true,
      // After "Continue?" the same layer flies again with this picture.
      mayReturn: true,
    });
  }

  /**
   * The bitten-off part falls away. On the full and lite levels it is a cut with character
   * (anticipation, spin, strands, panic; see `CutFx`); on the minimal one, and when that effect
   * fails, it is the plain fall of the table in docs/06, "Откусывание края".
   */
  biteOff(event: LandEvent, cutSide: 'left' | 'right', memo: FlyingMemo, index: number): void {
    const played =
      !effectsMode.reduced &&
      fxGuard.value('cut-fx', () => this.biteWithCharacter(event, cutSide, memo, index), false);
    if (!played) this.biteClassic(event, cutSide, memo, index);
  }

  private biteWithCharacter(
    event: LandEvent,
    cutSide: 'left' | 'right',
    memo: FlyingMemo,
    index: number,
  ): boolean {
    const pose = this.tower.layerPose(index);
    if (!pose) return false;
    const share = event.cutWidth / memo.width;
    const variant = this.cuts.variantFor(index + 1, share, event.cutWidth);
    const plan = cutPlanFor(effectsMode.level, variant);
    if (!plan) return false;
    // Where strands cannot be shown the cut plays plain: a drop runs down, no strand crumbs.
    const strands = plan.strands && this.cuts.showsStrands;
    const { side, y, pieceCut, pieceX, edgeX, colors } = this.biteSetup(
      cutSide,
      memo,
      event,
      index,
      pose,
    );
    // With strands the crumbs and the decoration bits fly under them, never over; a scared piece
    // keeps them under itself, so they never sit on its face.
    const depth = plan.panic ? DEPTH.panicCrumbs : strands ? DEPTH.cutCrumbs : undefined;
    const crumbs = (): void => {
      this.landing.bitten(edgeX, y, side, colors.cake, pickInt(plan.crumbs), depth);
      if (memo.kind === 'plain') {
        this.decorBits(index + 1, event.cutWidth, pieceCut, edgeX, y, side, depth);
      }
    };
    this.cuts.play({
      pieces: this.pieces,
      layerNumber: index + 1,
      side,
      edgeX,
      y,
      layerWidth: pose.width,
      pieceX,
      pieceWidth: event.cutWidth,
      look: memo,
      cake: colors.cake,
      glaze: colors.glaze,
      creature: memo.creature ?? null,
      plan,
      crumbs,
      layerCenter: (out) => {
        const now = this.tower.layerPoseInto(this.cutPose, index);
        if (!now) return false;
        out.x = now.x;
        out.y = now.y;
        return true;
      },
    });
    // With strands the glaze leaves in them and as the drop that stays; otherwise a drop runs down.
    if (!strands) this.runDrips(pose, y, edgeX, side, colors.glaze, memo, index);
    return true;
  }

  /**
   * What both kinds of bite need: the side the piece goes to, the layer's centre y, the side of the
   * piece that was cut (the sponge faces the tower, the opposite side), where the piece stands, the
   * cut edge of the layer (0 without a pose) and the colours.
   */
  private biteSetup(
    cutSide: 'left' | 'right',
    memo: FlyingMemo,
    event: LandEvent,
    index: number,
    pose: LandedLayer | null,
  ) {
    const side: 1 | -1 = cutSide === 'right' ? 1 : -1;
    return {
      side,
      y: this.tower.layerCenterY(index),
      pieceCut: side === 1 ? ('left' as const) : ('right' as const),
      pieceX: memo.x + side * (memo.width / 2 - event.cutWidth / 2),
      edgeX: pose ? pose.x + side * (pose.width / 2) : 0,
      colors: cakeColorsFor(memo.creature ?? null, index + 1, memo.kind === 'golden'),
    };
  }

  /** The cut of the table in docs/06, "Откусывание края": the piece drifts away, a glaze drop runs down the cut edge. */
  private biteClassic(
    event: LandEvent,
    cutSide: 'left' | 'right',
    memo: FlyingMemo,
    index: number,
  ): void {
    const pose = this.tower.layerPose(index);
    const { side, y, pieceCut, pieceX, edgeX, colors } = this.biteSetup(
      cutSide,
      memo,
      event,
      index,
      pose,
    );
    this.pieces.spawn({
      layerIndex: index + 1,
      x: pieceX,
      y,
      width: event.cutWidth,
      cut: pieceCut,
      ...driftMotion(ANIM.bite, side),
      face: null,
      look: memo,
    });

    if (!pose) return;
    this.landing.bitten(edgeX, y, side, colors.cake);
    if (memo.kind === 'plain') this.decorBits(index + 1, event.cutWidth, pieceCut, edgeX, y, side);
    this.runDrips(pose, y, edgeX, side, colors.glaze, memo, index);
  }

  /** Glaze drops run down the cut edge of the layer (0-based `index`), riding it. */
  private runDrips(
    pose: LandedLayer,
    y: number,
    edgeX: number,
    side: 1 | -1,
    glaze: number,
    memo: FlyingMemo,
    index: number,
  ): void {
    const { dripSize, drips } = ANIM.bite;
    const box = layerBox(pose.width);
    const startY =
      memo.kind === 'plain'
        ? y + glazeCrestY(box)
        : y - BALANCE.layer.height / 2 + BALANCE.layer.height * ANIM.layer.glazeDepth;
    const count = pickInt(drips);
    for (let k = 0; k < count; k++) {
      const inset = Math.min(ANIM.layer.outline + dripSize / 2 + k * dripSize * 2, pose.width / 2);
      const x = edgeX - side * inset;
      const top = startY - dripSize;
      // The drop rides the layer: it lands squashed, and a drop left where the layer stands at
      // rest would hang in the air above it.
      this.drips.spawn(x, top, glaze, {
        view: () => this.tower.viewAt(index),
        dx: x - pose.x,
        up: y + BALANCE.layer.height / 2 - top,
      });
    }
  }

  /** Bits of the decorations fly off when the bitten-off part carries some. */
  private decorBits(
    layerIndex: number,
    pieceWidth: number,
    pieceCut: 'left' | 'right',
    edgeX: number,
    y: number,
    side: 1 | -1,
    depth?: number,
  ): void {
    const { decor } = lookOfCode(lookCodeFor(layerIndex, false));
    if (!decor) return;
    const box = layerBox(pieceWidth);
    if (decorItems(decor, box, pieceCut, null).length === 0) return;
    const crest = glazeCrestY(box);
    this.landing.decorBitten(
      edgeX,
      y + (box.innerTop + crest) / 2,
      crest - box.innerTop,
      side,
      decorTints(decor),
      depth,
    );
  }
}
