import * as Phaser from 'phaser';
import type { TowerState } from '../../../core/tower/tower-sim';
import { Rng } from '../../../core/common/rng';
import { BALANCE } from '../../../data/tower/balance';
import { PLAIN_TOPPERS } from '../../../data/toppers/plain-toppers';
import { TOPPER_SQUASH } from '../../../data/toppers/topper-squash';
import { effectsMode } from '../../effects-mode';
import { DEPTH } from '../../depth';
import { faceHalfSpan } from '../glaze/glaze-growth';
import { ensureTopperTexture } from './topper-texture';
import type { Particles } from '../common/particles';
import { TopperSquashFx } from './topper-squash-fx';
import {
  classifySquash,
  crouchScale,
  crouchStep,
  edgeLaunch,
  simX,
  squashLevelPlan,
} from './topper-squash-plan';
import type { TopperWorld } from '../../objects/layer-topper';
import type { TowerView } from '../../objects/tower-view';
import {
  carriedOffset,
  plainToppers,
  popAt,
  popLaunch,
  restTilt,
  sideOfOffset,
  topperSize,
  topperOffset,
  type FlightSpec,
  type PopLaunch,
  type PopPose,
} from '../../objects/topper-look';
import type { FlyingMemo } from '../run/run-fx';
import { plainLooks } from '../../objects/plain-look';

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
  spec: FlightSpec;
}

/**
 * What happens to a topper when the next layer lands (docs/06, section 4): a layer that covers
 * its whole body squeezes it (`TopperSquashFx`), one that sits on its body only shoots it sideways
 * off the screen, and one that missed it makes it do a spring hop and fly off spinning, with a
 * "boing". A topper whose place was bitten off on landing pops off at the bite the same way. The
 * topper under the flying layer crouches. "Fewer effects" skips all of it: the topper just
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
  private readonly squash: TopperSquashFx;
  /** How deep the topper of the top layer crouches now (0..1). */
  private crouch = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    tower: TowerView,
    particles: Particles,
    private readonly onHop: () => void,
  ) {
    this.squash = new TopperSquashFx(scene, tower, particles);
  }

  /**
   * A layer lands: the topper of the layer under it hops off. Call it before the tower is synced
   * to the new state, while that view still shows its topper.
   */
  hopOffBelow(tower: TowerView, state: Readonly<TowerState>): void {
    const index = state.layers.length - 2;
    this.crouch = 0;
    this.squash.cream(state);
    const view = tower.viewAt(index);
    const topper = plainToppers.at(index + 1);
    if (!view || !topper || !view.topperWorld(this.world)) return;
    const dir = this.world.x < view.x ? -1 : this.world.x > view.x ? 1 : topper.side;
    const lower = state.layers[index];
    const layer = state.layers[index + 1];
    const outcome =
      lower && layer && squashLevelPlan(effectsMode.level).play
        ? classifySquash(
            simX(lower, this.world.x, view.x),
            topperSize(topper.kind).halfBody,
            layer.x,
            layer.width,
          )
        : 'miss';
    if (outcome === 'hit') this.squash.hit(topper.kind, this.world, state);
    else if (outcome === 'edge') {
      const rng = new Rng(plainLooks.cosmeticSeed).fork(
        `${TOPPER_SQUASH.stream}:${index + 2}:edge`,
      );
      this.launch(this.world, index + 1, dir, TOPPER_SQUASH.edge, edgeLaunch(dir, rng));
    } else this.launch(this.world, index + 1, dir);
  }

  /**
   * The flying layer landed as the new top layer: its topper stays where it stood on the flying
   * layer, pushed clear of the face; if the bite took that place the topper pops off at the bite.
   */
  settleOnTop(tower: TowerView, state: Readonly<TowerState>, memo: FlyingMemo | null): void {
    const index = state.layers.length - 1;
    // The new layer's view exists now: it dips where the topper was squeezed.
    this.squash.afterSync();
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
    this.world.rotation = restTilt(topper.kind, sideOfOffset(from));
    this.world.scaleX = look.width / frame.width;
    this.world.scaleY = look.height / frame.height;
    this.launch(this.world, index + 1, x < layer.x ? -1 : 1);
  }

  private launch(
    from: TopperWorld,
    layerIndex: number,
    dir: -1 | 1,
    spec: FlightSpec = PLAIN_TOPPERS.hop,
    launch: PopLaunch = popLaunch(plainLooks.cosmeticSeed, layerIndex, dir),
  ): void {
    if (effectsMode.reduced) return;
    const look = topperSize(from.kind);
    const slot = this.take();
    slot.image
      .setTexture(ensureTopperTexture(this.scene, from.kind))
      .setOrigin(look.originX, look.restY / look.height)
      .setDepth(DEPTH.pieces)
      .setAlpha(1)
      .setVisible(true);
    slot.launch = launch;
    slot.spec = spec;
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
        spec: PLAIN_TOPPERS.hop,
      };
      this.flying.push(slot);
      return slot;
    }
    return this.flying.reduce((a, b) => (a.ageMs >= b.ageMs ? a : b));
  }

  update(dtMs: number, tower: TowerView, state: Readonly<TowerState>): void {
    this.squash.update(dtMs);
    this.updateCrouch(dtMs, tower, state);
    for (const f of this.flying) {
      if (!f.active) continue;
      f.ageMs += dtMs;
      if (f.ageMs >= f.spec.lifeMs) {
        f.active = false;
        f.image.setVisible(false);
        continue;
      }
      const p = popAt(f.launch, f.ageMs, this.pose, f.spec);
      f.image
        .setPosition(f.x + p.dx, f.y + p.dy)
        .setRotation(f.rotation + (p.angleDeg * Math.PI) / 180)
        .setScale(f.scaleX * p.scaleX, f.scaleY * p.scaleY)
        .setAlpha(p.alpha);
    }
  }

  /**
   * The topper of the top layer crouches softly while the flying layer is over it (it would
   * land on it), and stands up again when the layer moves on.
   */
  private updateCrouch(dtMs: number, tower: TowerView, state: Readonly<TowerState>): void {
    const view = tower.topView();
    const flying = state.flying;
    const top = state.layers[state.layers.length - 1];
    // The topper is in world space (it sways with the tower), the flying layer in sim space.
    const over =
      flying !== null &&
      top !== undefined &&
      squashLevelPlan(effectsMode.level).crouch &&
      view !== null &&
      view.topperWorld(this.world) !== null &&
      classifySquash(
        simX(top, this.world.x, view.x),
        topperSize(this.world.kind).halfBody,
        flying.x,
        flying.width,
      ) !== 'miss';
    const next = crouchStep(this.crouch, over ? 1 : 0, dtMs);
    if (next === this.crouch && next === 0) return;
    this.crouch = next;
    const scale = crouchScale(next);
    view?.crouchTopper(scale.x, scale.y);
  }
}
