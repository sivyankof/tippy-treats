import type * as Phaser from 'phaser';
import type { SimEvent, TowerState } from '../../core/tower-sim';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { pickInt } from '../../util/math';
import { decorTints } from '../objects/decor-draw';
import { decorItems } from '../objects/decor-layout';
import { glazeCrestY } from '../objects/glaze-wave';
import { cakeColorsFor, lookCodeFor } from '../objects/layer-art';
import { layerBox } from '../objects/layer-draw';
import { lookOfCode } from '../objects/plain-look';
import { effectsMode } from '../effects-mode';
import { fxGuard } from '../fx-guard';
import type { LayerView } from '../objects/layer-view';
import type { TowerView } from '../objects/tower-view';
import { driftMotion } from './anim-curves';
import { CutFx } from './cut-fx';
import { cutPlanFor } from './cut-variant';
import { FallingPieces } from './falling-piece';
import { GlazeDrip } from './glaze-drip';
import type { LandedLayer, LandingFx } from './landing-fx';
import type { FlyingMemo } from './run-fx';

type LandEvent = Extract<SimEvent, { type: 'land' }>;

/**
 * Bits that come off the tower: the bitten-off overhang with its crumbs and glaze drops, the
 * crumbs of a sneeze and the layer that missed. Owns the pooled falling pieces.
 */
export class DebrisFx {
  readonly pieces: FallingPieces;
  private readonly drips: GlazeDrip;
  private readonly cuts: CutFx;

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
    const side = cutSide === 'right' ? 1 : -1;
    const y = this.tower.layerCenterY(index);
    const pieceCut = side === 1 ? 'left' : 'right';
    const edgeX = pose.x + side * (pose.width / 2);
    const colors = cakeColorsFor(memo.creature ?? null, index + 1, memo.kind === 'golden');
    const crumbs = (): void => {
      this.landing.bitten(edgeX, y, side, colors.cake, pickInt(plan.crumbs));
      if (variant.piece && memo.kind === 'plain') {
        this.decorBits(index + 1, event.cutWidth, pieceCut, edgeX, y, side);
      }
    };
    if (variant.piece) {
      this.cuts.play({
        pieces: this.pieces,
        layerNumber: index + 1,
        side,
        edgeX,
        y,
        layerWidth: pose.width,
        pieceX: memo.x + side * (memo.width / 2 - event.cutWidth / 2),
        pieceWidth: event.cutWidth,
        look: memo,
        cake: colors.cake,
        glaze: colors.glaze,
        plan,
        crumbs,
      });
    } else {
      crumbs();
    }
    // With strands the glaze leaves in them and as the drop that stays; otherwise a drop runs down.
    if (!plan.strands) this.runDrips(pose, y, edgeX, side, colors.glaze, memo);
    return true;
  }

  /** The cut of the table in docs/06, "Откусывание края": the piece drifts away, a glaze drop runs down the cut edge. */
  private biteClassic(
    event: LandEvent,
    cutSide: 'left' | 'right',
    memo: FlyingMemo,
    index: number,
  ): void {
    const side = cutSide === 'right' ? 1 : -1;
    const y = this.tower.layerCenterY(index);
    // The sponge faces the tower, which is the opposite side of the cut.
    const pieceCut = side === 1 ? 'left' : 'right';
    this.pieces.spawn({
      layerIndex: index + 1,
      x: memo.x + side * (memo.width / 2 - event.cutWidth / 2),
      y,
      width: event.cutWidth,
      cut: pieceCut,
      ...driftMotion(ANIM.bite, side),
      face: null,
      look: memo,
    });

    const pose = this.tower.layerPose(index);
    if (!pose) return;
    const edgeX = pose.x + side * (pose.width / 2);
    const colors = cakeColorsFor(memo.creature ?? null, index + 1, memo.kind === 'golden');
    this.landing.bitten(edgeX, y, side, colors.cake);
    if (memo.kind === 'plain') this.decorBits(index + 1, event.cutWidth, pieceCut, edgeX, y, side);
    this.runDrips(pose, y, edgeX, side, colors.glaze, memo);
  }

  /** Glaze drops run down the cut edge of the layer. */
  private runDrips(
    pose: LandedLayer,
    y: number,
    edgeX: number,
    side: 1 | -1,
    glaze: number,
    memo: FlyingMemo,
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
      this.drips.spawn(edgeX - side * inset, startY - dripSize, glaze);
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
    );
  }
}
