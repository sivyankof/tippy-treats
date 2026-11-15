import type { Rng } from '../../core/rng';
import type { TowerState } from '../../core/tower-sim';
import type { Range } from '../../data/backdrop-life';
import { BALANCE } from '../../data/balance';
import { TOWER_GUEST, type GuestLook } from '../../data/tower-guest';
import { pickRange } from '../../util/math';
import {
  aimedByShadowOnly,
  chooseSite,
  clearOfSpan,
  type FlightPoint,
  type Span,
} from './tower-guest-plan';
import { faceHalfOf, shadowSpanInto } from './tower-guest-site';
import type { GuestContext } from './tower-guest-types';
import type { LayerPose } from './tower-view';

const HALF_LAYER = BALANCE.layer.height / 2;

/**
 * The choices of a visit: whether it is bound for the path of the next layer, where on the top
 * layer the guest sits, where it flies in from and whether the shadow of the flying layer is near.
 * All the draws come from the cosmetic stream of the guest, in the order the guest asks.
 */
export class GuestVisitPlanner {
  /** The shadow of the flying layer as offsets from the centre of the anchor layer (reused). */
  private readonly shadowBox: Span = { left: 0, right: 0 };

  constructor(private readonly random: Rng) {}

  /** A value of `range` from the stream. */
  pick(range: Range): number {
    return pickRange(range, () => this.random.next());
  }

  /**
   * Whether this visit is bound for the path of the next layer. The draw is always taken (so the
   * stream does not depend on the rule); a layer aimed by its shadow alone gets no such visit.
   */
  rollOnPath(state: Readonly<TowerState>): boolean {
    const roll = this.random.next();
    return roll < TOWER_GUEST.site.pathChance && !aimedByShadowOnly(state.flying?.rule ?? null);
  }

  /** The shadow a visit that is not bound for the path keeps clear of; `null` for one that is. */
  avoidSpan(ctx: GuestContext, pose: LayerPose, onPath: boolean): Span | null {
    return onPath ? null : shadowSpanInto(this.shadowBox, ctx, pose);
  }

  /** Where on the top layer (`pose`) the guest sits, never on the `topperSide` (`null`: no topper); the next layer is the flying one, or as wide as the top. */
  pickSite(
    look: GuestLook,
    pose: LayerPose,
    state: Readonly<TowerState>,
    onPath: boolean,
    avoid: Span | null,
    topperSide: -1 | 1 | null,
  ): number | null {
    const face = faceHalfOf(pose);
    const next = state.flying?.width ?? pose.width;
    const half = look.halfWidthPx * look.scale;
    const random = (): number => this.random.next();
    // The topper owns its side of the face: the fly lands on the other one.
    return chooseSite(pose.width, face, half, next, onPath, random, avoid, topperSide);
  }

  /** Writes where an arrival starts: beyond a side of the screen, above the layer `pose`. */
  arrivalStart(cam: GuestContext['cam'], pose: LayerPose, out: FlightPoint): void {
    const { arrive, offscreenPx } = TOWER_GUEST;
    const fromLeft = this.random.next() < 0.5;
    out.x = fromLeft ? -offscreenPx : cam.width + offscreenPx;
    const above = this.pick(arrive.abovePx);
    out.y = Math.max(cam.scrollY + arrive.abovePx[0] / 2, pose.y - HALF_LAYER - above);
  }

  /** The shadow of the flying layer is within the guest's full-size body (at `posX`) plus the shadow gap of it. */
  shadowIsNear(ctx: GuestContext, look: GuestLook, pose: LayerPose, posX: number): boolean {
    const half = look.halfWidthPx * look.scale;
    return !clearOfSpan(posX - pose.x, half, shadowSpanInto(this.shadowBox, ctx, pose));
  }
}
