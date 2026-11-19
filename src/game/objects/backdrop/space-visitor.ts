import * as Phaser from 'phaser';
import { lapProgress } from '../../../core/zones/space-laps';
import {
  visitorOfLap,
  visitorPassRng,
  visitorSeedOf,
} from '../../../core/guests/space-visitor-pick';
import {
  SPACE_VISITOR,
  SPACE_VISITOR_IDS,
  type SpaceVisitorId,
} from '../../../data/guests/space-visitor';
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
 * The rare guest of Space: on about every second lap one pass (`visitorOfLap`), on a decorative
 * random stream apart from the run's. Full and lite effects fly it; minimal shows nothing. All the
 * pictures are made in advance (`bakeSpaceVisitors`), so a new guest only swaps the texture of the
 * one hidden image and nothing is created while the run goes on.
 */
export class SpaceVisitor implements Life {
  readonly anchor = inSky('visitor');
  readonly objects: Phaser.GameObjects.Image[];
  private readonly image: Phaser.GameObjects.Image;
  private readonly visitorSeed: number;
  private readonly forced: SpaceVisitorId | null;
  /** A benchmark run has no guest (it must stay comparable) unless one is forced. */
  private readonly benchmark: boolean;
  /** The pass on screen (or waiting for its delay) and the one of a newer lap that waits for it to end. */
  private plan: VisitorPlan | null = null;
  private pending: VisitorPlan | null = null;
  private lap = 0;
  private readonly pose = newVisitorPose();
  private clockMs = 0;
  private holding = false;
  private fitH = -1;
  private fitsScreen = false;
  private fitGuest: SpaceVisitorId | null = null;

  /** `held`: the background travellers that wait while the guest crosses, so none flies over it. */
  constructor(
    scene: Phaser.Scene,
    planetSeed: number,
    private readonly held: readonly GuestSource[] = [],
  ) {
    this.visitorSeed = visitorSeedOf(planetSeed);
    this.forced = readDebugParams().spaceGuest ?? null;
    this.benchmark = Boolean(readPerfParams()) && !this.forced;
    const first = this.forced ?? SPACE_VISITOR_IDS[0];
    this.image = new Phaser.GameObjects.Image(
      scene,
      0,
      0,
      SPACE_VISITOR.guests[first].texture,
    ).setVisible(false);
    this.objects = [this.image];
  }

  update(ctx: FrameCtx): void {
    if (!fxGuard.call('space-visitor', this, this.step, ctx)) {
      fxGuard.cleanup('space-visitor', this, this.hide);
    }
  }

  private hide(): void {
    this.image.setVisible(false);
    this.hold(false);
  }

  /** Whether the guest has a lane on a screen `screenH` tall; remembered per guest and screen height. */
  private fits(guest: SpaceVisitorId, screenH: number): boolean {
    if (this.fitH !== screenH || this.fitGuest !== guest) {
      this.fitH = screenH;
      this.fitGuest = guest;
      this.fitsScreen = visitorFit(guest, screenH) !== null;
    }
    return this.fitsScreen;
  }

  private hold(on: boolean): void {
    if (this.holding === on) return;
    this.holding = on;
    for (const other of this.held) other.suspend(on);
  }

  /** The pass the lap gives, or null; `?spaceGuest=` gives one for the first lap seen and none after. */
  private rollLap(lap: number): VisitorPlan | null {
    if (this.benchmark) return null;
    const rng = visitorPassRng(this.visitorSeed, lap);
    const random = (): number => rng.next();
    if (this.forced) return this.lap === 0 ? planVisitor(this.forced, random, true) : null;
    const guest = visitorOfLap(this.visitorSeed, lap);
    return guest ? planVisitor(guest, random) : null;
  }

  private passOver(plan: VisitorPlan): boolean {
    return this.clockMs - plan.delayMs >= plan.durationMs;
  }

  /** A new lap: its pass starts counting at once, unless the guest of the lap before is still crossing (it finishes first). */
  private newLap(lap: number): void {
    const next = this.rollLap(lap);
    this.lap = lap;
    const crossing = this.plan && this.clockMs >= this.plan.delayMs && !this.passOver(this.plan);
    if (crossing) this.pending = next;
    else this.start(next);
  }

  private start(plan: VisitorPlan | null): void {
    this.plan = plan;
    this.pending = null;
    this.clockMs = 0;
    if (plan) this.image.setTexture(SPACE_VISITOR.guests[plan.guest].texture);
  }

  private step(ctx: FrameCtx): void {
    const lap = lapProgress(ctx.towerLayers).lap;
    if (lap > 0 && lap !== this.lap) this.newLap(lap);
    const { plan } = this;
    if (!plan) {
      this.hide();
      return;
    }
    // A screen that cannot show this guest (too short, or no lane fits) holds nothing back either.
    if (!this.fits(plan.guest, ctx.height)) {
      this.hide();
      return;
    }
    this.clockMs += ctx.deltaMs;
    if (this.pending && this.passOver(plan)) {
      this.hide();
      this.start(this.pending);
      return;
    }
    const progress = (this.clockMs - plan.delayMs) / plan.durationMs;
    const flying = progress >= 0 && progress < 1 && !effectsMode.reduced;
    if (this.image.visible !== flying) this.image.setVisible(flying);
    // Held a moment before and after, so a traveller already in view does not meet the guest at the edge.
    this.hold(progress > -HOLD_LEAD && progress < 1 + HOLD_LEAD && !effectsMode.reduced);
    if (!flying) return;
    const pose = visitorPose(plan, progress, ctx.timeMs, ctx.width, ctx.height, this.pose);
    // A screen too short for the band shows no guest.
    if (pose.scale === 0) {
      this.image.setVisible(false);
      return;
    }
    this.image
      .setPosition(pose.x, pose.y)
      .setRotation(pose.rotation)
      .setAlpha(pose.alpha)
      .setScale(pose.scale)
      .setFlipX(pose.flipX);
  }
}
