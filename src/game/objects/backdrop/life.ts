import * as Phaser from 'phaser';
import type {
  HoverSpec,
  Point,
  PuffSpec,
  TravelSpec,
  TwinkleSpec,
} from '../../../data/backdrop-life';
import type { GuestSource, SourcePoint } from './guest-source';
import { newLayerFrame, rideLayer, type Anchor, type LayerFrame } from './layer-anchor';
import { PassTimer } from './pass-timer';
import {
  hoverPose,
  newPose,
  puffPose,
  travelPose,
  twinklePose,
  type Pose,
  type YBand,
  type TravelPass,
} from './life-motion';

/** What a living element needs to know about the frame. */
export interface FrameCtx extends LayerFrame {
  timeMs: number;
  deltaMs: number;
  /** Logical screen size. */
  width: number;
  height: number;
  /** The stripe around the flying layer's line that Space travellers keep out of (the stripe of a tall tower, set by the run backdrop in every zone but read only by travellers that ask for it, i.e. Space's); null only for the menu scenery. */
  clearBand: YBand | null;
  /** Tower height in layers, from the camera scroll (drives the mountain peaks). */
  towerLayers: number;
  /** The row on the screen (px) the incoming layer flies in right now: from the highest reach of its bob to the lowest. */
  flightRow: { top: number; bottom: number; towerTop: number };
}

/** A group of pictures that move on their own: part of a zone backdrop. */
export interface Life {
  /** Where the life stands: on a parallax layer (it scrolls and sways with it), in the sky, or fixed on the screen. Every life says. */
  readonly anchor: Anchor;
  /** The pictures to add to the scenery, back to front. */
  readonly objects: readonly Phaser.GameObjects.GameObject[];
  update(ctx: FrameCtx): void;
}

/** A frame context for a scenery that does not scroll (the menus): every layer stands on its start view. */
export function newFrameCtx(
  width: number,
  height: number,
  clearBand: FrameCtx['clearBand'],
  timeMs: number,
): FrameCtx {
  return {
    timeMs,
    deltaMs: 0,
    width,
    height,
    clearBand,
    towerLayers: 0,
    flightRow: { top: 0, bottom: 0, towerTop: 0 },
    ...newLayerFrame(),
  };
}

export function createImage(scene: Phaser.Scene, texture: string): Phaser.GameObjects.Image {
  return new Phaser.GameObjects.Image(scene, 0, 0, texture);
}

/** Half the height of a picture at `scale` (px): what `rideLayer` takes to know how far the picture reaches from its centre. */
export function halfExtent(image: { height: number }, scale: number): number {
  return (image.height * scale) / 2;
}

export function applyPose(image: Phaser.GameObjects.Image, pose: Pose): void {
  image.setPosition(pose.x, pose.y);
  image.setRotation(pose.rotation);
  image.setScale(pose.scaleX, pose.scaleY);
  image.setAlpha(pose.alpha);
  if (pose.tint !== null) image.setTint(pose.tint);
}

/** Fixtures and moving things that stay where they are: swing, bob, spin, pulse, blink, orbit. */
export class Hover implements Life {
  readonly objects: Phaser.GameObjects.Image[];
  private readonly pose = newPose();

  constructor(
    scene: Phaser.Scene,
    private readonly specs: readonly HoverSpec[],
    readonly anchor: Anchor,
  ) {
    this.objects = specs.map((spec) => {
      const image = createImage(scene, spec.texture);
      if (spec.origin) image.setOrigin(spec.origin[0], spec.origin[1]);
      if (spec.tint !== undefined) image.setTint(spec.tint);
      return image;
    });
  }

  update(ctx: FrameCtx): void {
    this.specs.forEach((spec, i) => {
      const image = this.objects[i];
      if (!image) return;
      const pose = hoverPose(spec, ctx.width, ctx.height, ctx.timeMs, this.pose);
      const shown = rideLayer(pose, this.anchor, ctx, ctx.height, halfExtent(image, pose.scaleY));
      applyPose(image, pose);
      if (this.anchor.kind === 'layer') image.setVisible(shown);
    });
  }
}

/** A column of soft puffs rising from one spot (steam, smoke). */
export class PuffColumn implements Life {
  readonly objects: Phaser.GameObjects.Image[];
  private readonly pose = newPose();

  constructor(
    scene: Phaser.Scene,
    private readonly spec: PuffSpec,
    readonly anchor: Anchor,
    private readonly at: Point = { x: 0, y: 0 },
    private readonly offset: Point = { x: 0, y: 0 },
  ) {
    this.objects = Array.from({ length: spec.count }, () => {
      const image = createImage(scene, spec.texture);
      image.setTint(spec.tint);
      return image;
    });
  }

  /** Runs the column with its source at (`x`, `y`) in the pixels of whatever it is drawn in; `ctx` (a column on a layer) moves it with the layer. */
  updateAt(timeMs: number, x: number, y: number, ctx?: FrameCtx): void {
    this.objects.forEach((image, i) => {
      const pose = puffPose(this.spec, i, timeMs, x, y, this.pose);
      const shown = ctx
        ? rideLayer(pose, this.anchor, ctx, ctx.height, halfExtent(image, this.spec.endScale))
        : true;
      applyPose(image, pose);
      if (ctx && this.anchor.kind === 'layer') image.setVisible(shown);
    });
  }

  update(ctx: FrameCtx): void {
    this.updateAt(
      ctx.timeMs,
      this.at.x * ctx.width + this.offset.x,
      this.at.y * ctx.height + this.offset.y,
      ctx,
    );
  }
}

/** Something that crosses the screen now and then, alone or as a flock. */
export class Traveler implements Life, GuestSource {
  readonly objects: Phaser.GameObjects.Image[];
  private timer: PassTimer;
  private readonly pass: TravelPass = { shiftX: 0, shiftY: 0, direction: 1 };
  private readonly pose = newPose();
  private shown = true;
  private held = false;

  constructor(
    scene: Phaser.Scene,
    private readonly spec: TravelSpec,
    readonly anchor: Anchor,
    private readonly random: () => number = Math.random,
  ) {
    this.timer = new PassTimer(spec, random);
    this.objects = Array.from({ length: spec.count }, () => createImage(scene, spec.texture));
    this.newPass();
  }

  /** Rolls the path of a pass: shifted a little, and half of the passes run the other way. */
  private newPass(): void {
    const { jitter, bothWays } = this.spec;
    this.pass.shiftX = (this.random() - 0.5) * jitter.x;
    this.pass.shiftY = (this.random() - 0.5) * jitter.y;
    this.pass.direction = bothWays && this.random() < 0.5 ? -1 : 1;
  }

  peek(out: SourcePoint): boolean {
    const image = this.objects[0];
    if (this.held || !this.shown || !image) return false;
    out.x = image.x;
    out.y = image.y;
    out.scale = this.spec.scale;
    return true;
  }

  suspend(on: boolean): void {
    if (this.held === on) return;
    this.held = on;
    // Back from the tower the creature waits for a fresh pass instead of popping in mid-screen.
    if (!on) this.timer = new PassTimer(this.spec, this.random);
    if (on && this.shown) {
      this.shown = false;
      for (const image of this.objects) image.setVisible(false);
    }
  }

  update(ctx: FrameCtx): void {
    if (this.held) return;
    this.timer.update(ctx.deltaMs);
    if (this.timer.started) this.newPass();
    if (this.timer.active !== this.shown) {
      this.shown = this.timer.active;
      for (const image of this.objects) image.setVisible(this.shown);
    }
    if (!this.shown) return;
    this.objects.forEach((image, i) => {
      const pose = travelPose(
        this.spec,
        this.pass,
        i,
        this.timer.progress,
        ctx.width,
        ctx.height,
        ctx.timeMs,
        this.pose,
        ctx.clearBand,
      );
      // A walker on the street scrolls down with the street layer (its walk along the street is its own).
      const onScreen = rideLayer(
        pose,
        this.anchor,
        ctx,
        ctx.height,
        halfExtent(image, pose.scaleY),
      );
      applyPose(image, pose);
      if (this.anchor.kind === 'layer') image.setVisible(onScreen);
    });
  }
}

/** Points that glow and fade out of step: twinkling stars, blinking bulbs. */
export class Twinkles implements Life {
  readonly objects: Phaser.GameObjects.Image[];
  private readonly pose = newPose();
  private readonly at: Point = { x: 0, y: 0 };

  constructor(
    scene: Phaser.Scene,
    private readonly spec: TwinkleSpec,
    readonly anchor: Anchor,
  ) {
    this.objects = spec.points.map(() => createImage(scene, spec.texture));
  }

  update(ctx: FrameCtx): void {
    this.spec.points.forEach((point, i) => {
      const image = this.objects[i];
      if (!image) return;
      this.at.x = point.x * ctx.width;
      this.at.y = point.y * ctx.height + (point.dy ?? 0);
      const pose = twinklePose(this.spec, i, ctx.timeMs, this.at, this.pose);
      const shown = rideLayer(pose, this.anchor, ctx, ctx.height, halfExtent(image, pose.scaleY));
      applyPose(image, pose);
      if (this.anchor.kind === 'layer') image.setVisible(shown);
    });
  }
}
