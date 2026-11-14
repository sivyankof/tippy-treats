import * as Phaser from 'phaser';
import type {
  HoverSpec,
  Point,
  PuffSpec,
  TravelSpec,
  TwinkleSpec,
} from '../../../data/backdrop-life';
import { PassTimer } from './pass-timer';
import {
  hoverPose,
  newPose,
  puffPose,
  travelPose,
  twinklePose,
  type Pose,
  type TravelPass,
} from './life-motion';

/** What a living element needs to know about the frame. */
export interface FrameCtx {
  timeMs: number;
  deltaMs: number;
  /** Logical screen size. */
  width: number;
  height: number;
}

/** A group of pictures that move on their own: part of a zone backdrop. */
export interface Life {
  /** The pictures to add to the scenery, back to front. */
  readonly objects: readonly Phaser.GameObjects.GameObject[];
  update(ctx: FrameCtx): void;
}

function createImage(scene: Phaser.Scene, texture: string): Phaser.GameObjects.Image {
  return new Phaser.GameObjects.Image(scene, 0, 0, texture);
}

function applyPose(image: Phaser.GameObjects.Image, pose: Pose): void {
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
      if (image) applyPose(image, hoverPose(spec, ctx.width, ctx.height, ctx.timeMs, this.pose));
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
    private readonly at: Point = { x: 0, y: 0 },
    private readonly offset: Point = { x: 0, y: 0 },
  ) {
    this.objects = Array.from({ length: spec.count }, () => {
      const image = createImage(scene, spec.texture);
      image.setTint(spec.tint);
      return image;
    });
  }

  /** Runs the column with its source at (`x`, `y`) in the pixels of whatever it is drawn in. */
  updateAt(timeMs: number, x: number, y: number): void {
    this.objects.forEach((image, i) => {
      applyPose(image, puffPose(this.spec, i, timeMs, x, y, this.pose));
    });
  }

  update(ctx: FrameCtx): void {
    this.updateAt(
      ctx.timeMs,
      this.at.x * ctx.width + this.offset.x,
      this.at.y * ctx.height + this.offset.y,
    );
  }
}

/** Something that crosses the screen now and then, alone or as a flock. */
export class Traveler implements Life {
  readonly objects: Phaser.GameObjects.Image[];
  private readonly timer: PassTimer;
  private readonly pass: TravelPass = { shiftX: 0, shiftY: 0, direction: 1 };
  private readonly pose = newPose();
  private shown = true;

  constructor(
    scene: Phaser.Scene,
    private readonly spec: TravelSpec,
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

  update(ctx: FrameCtx): void {
    this.timer.update(ctx.deltaMs);
    if (this.timer.started) this.newPass();
    if (this.timer.active !== this.shown) {
      this.shown = this.timer.active;
      for (const image of this.objects) image.setVisible(this.shown);
    }
    if (!this.shown) return;
    this.objects.forEach((image, i) => {
      applyPose(
        image,
        travelPose(
          this.spec,
          this.pass,
          i,
          this.timer.progress,
          ctx.width,
          ctx.height,
          ctx.timeMs,
          this.pose,
        ),
      );
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
  ) {
    this.objects = spec.points.map(() => createImage(scene, spec.texture));
  }

  update(ctx: FrameCtx): void {
    this.spec.points.forEach((point, i) => {
      const image = this.objects[i];
      if (!image) return;
      this.at.x = point.x * ctx.width;
      this.at.y = point.y * ctx.height + (point.dy ?? 0);
      applyPose(image, twinklePose(this.spec, i, ctx.timeMs, this.at, this.pose));
    });
  }
}
