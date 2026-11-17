import * as Phaser from 'phaser';
import { SPACE_VISITOR, type SpaceVisitorId } from '../../../data/space-visitor';
import { readDebugParams, readPerfParams } from '../../../util/debug-params';
import { effectsMode } from '../../effects-mode';
import { fxGuard } from '../../fx-guard';
import type { GuestSource } from './guest-source';
import type { FrameCtx, Life } from './life';
import { inSky } from './layer-anchor';
import {
  newVisitorPose,
  planVisitor,
  visitorFit,
  visitorPose,
  type VisitorPlan,
} from './space-visitor-plan';

const HOLD_LEAD = SPACE_VISITOR.holdLead;

/**
 * The rare guest of Space: one pass per run at most, on a decorative random stream (never the
 * run's). Full and lite effects fly it; minimal shows nothing. The picture is made in advance
 * (`bakeSpaceVisitors`), so nothing is created while the run goes on.
 */
export class SpaceVisitor implements Life {
  readonly anchor = inSky('visitor');
  readonly objects: Phaser.GameObjects.Image[];
  private readonly plan: VisitorPlan | null;
  private readonly pose = newVisitorPose();
  private clockMs = 0;

  /** `held`: the background travellers that wait while the guest crosses, so none flies over it. */
  constructor(
    scene: Phaser.Scene,
    private readonly held: readonly GuestSource[] = [],
  ) {
    this.plan = rollPlan();
    this.objects = this.plan
      ? [
          new Phaser.GameObjects.Image(
            scene,
            0,
            0,
            SPACE_VISITOR.guests[this.plan.guest].texture,
          ).setVisible(false),
        ]
      : [];
  }

  update(ctx: FrameCtx): void {
    if (!this.plan) return;
    if (!fxGuard.call('space-visitor', this, this.step, ctx)) {
      fxGuard.cleanup('space-visitor', this, this.hide);
    }
  }

  private hide(): void {
    this.objects[0]?.setVisible(false);
    this.hold(false);
  }

  private holding = false;
  private fitH = -1;
  private fitsScreen = false;

  /** Whether the guest has a lane on a screen `screenH` tall; remembered per screen height. */
  private fits(guest: SpaceVisitorId, screenH: number): boolean {
    if (this.fitH !== screenH) {
      this.fitH = screenH;
      this.fitsScreen = visitorFit(guest, screenH) !== null;
    }
    return this.fitsScreen;
  }

  private hold(on: boolean): void {
    if (this.holding === on) return;
    this.holding = on;
    for (const other of this.held) other.suspend(on);
  }

  private step(ctx: FrameCtx): void {
    const { plan } = this;
    const image = this.objects[0];
    if (!plan || !image) return;
    // A screen that cannot show this guest (too short, or no lane fits) holds nothing back either.
    if (!this.fits(plan.guest, ctx.height)) {
      this.hide();
      return;
    }
    this.clockMs += ctx.deltaMs;
    const progress = (this.clockMs - plan.delayMs) / plan.durationMs;
    const flying = progress >= 0 && progress < 1 && !effectsMode.reduced;
    if (image.visible !== flying) image.setVisible(flying);
    // Held a moment before and after, so a traveller already in view does not meet the guest at the edge.
    this.hold(progress > -HOLD_LEAD && progress < 1 + HOLD_LEAD && !effectsMode.reduced);
    if (!flying) return;
    const pose = visitorPose(plan, progress, ctx.timeMs, ctx.width, ctx.height, this.pose);
    // A screen too short for the band shows no guest.
    if (pose.scale === 0) {
      image.setVisible(false);
      return;
    }
    image
      .setPosition(pose.x, pose.y)
      .setRotation(pose.rotation)
      .setAlpha(pose.alpha)
      .setScale(pose.scale)
      .setFlipX(pose.flipX);
  }
}

/** The pass of this run. A benchmark run has none (it must stay comparable) unless one is forced. */
function rollPlan(): VisitorPlan | null {
  const forced = readDebugParams().spaceGuest ?? null;
  if (readPerfParams() && !forced) return null;
  return planVisitor(Math.random, forced);
}
