import * as Phaser from 'phaser';
import type { TowerState } from '../../core/tower-sim';
import { BALANCE } from '../../data/balance';
import { PLAIN_TOPPERS } from '../../data/plain-toppers';
import { effectsMode } from '../effects-mode';
import { DEPTH } from '../depth';
import { faceHalfSpan } from './glaze-growth';
import { ensureTopperTexture } from './topper-texture';
import type { TopperWorld } from '../objects/layer-topper';
import type { TowerView } from '../objects/tower-view';
import {
  carriedOffset,
  plainToppers,
  popAt,
  popLaunch,
  restTilt,
  topperSize,
  topperOffset,
  type PopLaunch,
  type PopPose,
} from '../objects/topper-look';
import type { FlyingMemo } from './run-fx';
import { plainLooks } from '../objects/plain-look';

interface Flying {
  image: Phaser.GameObjects.Image;
  launch: PopLaunch;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  ageMs: number;
  active: boolean;
}

/**
 * The toppers that hop off a layer: when the next layer lands on a topper it does a spring hop and
 * flies off spinning past the edge of the screen, with a "boing". A topper whose place was bitten
 * off on landing pops off at the bite the same way. "Fewer effects" skips the hop: the topper just
 * disappears. Everything is a baked picture moved each frame; the pictures are pooled.
 */
export class TopperFx {
  private readonly flying: Flying[] = [];
  private readonly world: TopperWorld = {
    kind: 'cherry',
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  };
  private readonly pose: PopPose = { dx: 0, dy: 0, angleDeg: 0, scaleX: 1, scaleY: 1, alpha: 1 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onHop: () => void,
  ) {}

  /**
   * A layer lands: the topper of the layer under it hops off. Call it before the tower is synced
   * to the new state, while that view still shows its topper.
   */
  hopOffBelow(tower: TowerView, state: Readonly<TowerState>): void {
    const index = state.layers.length - 2;
    const view = tower.viewAt(index);
    const topper = plainToppers.at(index + 1);
    if (!view || !topper || !view.topperWorld(this.world)) return;
    const dir = this.world.x < view.x ? -1 : this.world.x > view.x ? 1 : topper.side;
    this.launch(this.world, index + 1, dir);
  }

  /**
   * The flying layer landed as the new top layer: its topper stays where it stood on the flying
   * layer, pushed clear of the face; if the bite took that place the topper pops off at the bite.
   */
  settleOnTop(tower: TowerView, state: Readonly<TowerState>, memo: FlyingMemo | null): void {
    const index = state.layers.length - 1;
    const view = tower.topView();
    const layer = state.layers[index];
    const topper = plainToppers.at(index + 1);
    if (!view || !layer || !topper || !memo || memo.kind !== 'plain') return;
    const from = topperOffset(topper.kind, topper.side, memo.width, faceHalfSpan(memo.width, null));
    if (from === null) return;
    const dx = carriedOffset(
      topper.kind,
      memo.x + from,
      layer.x,
      layer.width,
      faceHalfSpan(layer.width, null),
    );
    view.carryTopper(dx);
    if (dx !== null) return;
    const look = topperSize(topper.kind);
    const frame = this.scene.textures.getFrame(ensureTopperTexture(this.scene, topper.kind));
    const x = memo.x + from;
    this.world.kind = topper.kind;
    this.world.x = x;
    this.world.y = tower.layerCenterY(index) - BALANCE.layer.height / 2 + PLAIN_TOPPERS.sinkPx;
    this.world.rotation = restTilt(topper.kind, topper.side);
    this.world.scaleX = look.width / frame.width;
    this.world.scaleY = look.height / frame.height;
    this.launch(this.world, index + 1, x < layer.x ? -1 : 1);
  }

  private launch(from: TopperWorld, layerIndex: number, dir: -1 | 1): void {
    if (effectsMode.reduced) return;
    const look = topperSize(from.kind);
    const slot = this.take();
    slot.image
      .setTexture(ensureTopperTexture(this.scene, from.kind))
      .setOrigin(0.5, look.restY / look.height)
      .setDepth(DEPTH.pieces)
      .setAlpha(1)
      .setVisible(true);
    slot.launch = popLaunch(plainLooks.cosmeticSeed, layerIndex, dir);
    slot.x = from.x;
    slot.y = from.y;
    slot.rotation = from.rotation;
    slot.scaleX = from.scaleX;
    slot.scaleY = from.scaleY;
    slot.ageMs = 0;
    slot.active = true;
    this.onHop();
  }

  private take(): Flying {
    const free = this.flying.find((f) => !f.active);
    if (free) return free;
    if (this.flying.length < PLAIN_TOPPERS.maxFlying) {
      const image = this.scene.add.image(0, 0, '__DEFAULT').setVisible(false);
      const slot: Flying = {
        image,
        launch: { vx: 0, vy: 0, spinDeg: 0 },
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        ageMs: 0,
        active: false,
      };
      this.flying.push(slot);
      return slot;
    }
    return this.flying.reduce((a, b) => (a.ageMs >= b.ageMs ? a : b));
  }

  update(dtMs: number): void {
    for (const f of this.flying) {
      if (!f.active) continue;
      f.ageMs += dtMs;
      if (f.ageMs >= PLAIN_TOPPERS.hop.lifeMs) {
        f.active = false;
        f.image.setVisible(false);
        continue;
      }
      const p = popAt(f.launch, f.ageMs, this.pose);
      f.image
        .setPosition(f.x + p.dx, f.y + p.dy)
        .setRotation(f.rotation + (p.angleDeg * Math.PI) / 180)
        .setScale(f.scaleX * p.scaleX, f.scaleY * p.scaleY)
        .setAlpha(p.alpha);
    }
  }
}
