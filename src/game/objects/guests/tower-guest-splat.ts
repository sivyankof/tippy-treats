import type * as Phaser from 'phaser';
import type { Rng } from '../../../core/common/rng';
import { ANIM } from '../../../data/common/anim';
import { TOWER_GUEST, type GuestLook } from '../../../data/guests/tower-guest';
import { clamp01 } from '../../../util/math';
import { DEPTH } from '../../common/depth';
import { effectsMode } from '../../app/effects-mode';
import { FX_TEXTURES } from '../../fx/common/fx-textures';
import type { LandingFx } from '../../fx/tower/landing-fx';
import { starBurst } from '../../fx/common/sparkle-fx';
import type { LayerView } from '../tower/layer-view';
import { clearOfFace, orbitStar, type GuestPhase, type OrbitStar } from './tower-guest-plan';
import { faceHalfOf } from './tower-guest-site';
import type { GuestCues } from './tower-guest-types';
import type { LayerPose, TowerView } from '../tower/tower-view';

const { splat } = TOWER_GUEST;
const { impact, orbit, neighbours } = splat;

/**
 * The show around a guest that a layer landed on: the press and the camera kick, the stars and the
 * clap ring of the flattening, the glances and the giggle of the neighbours, and the stars that
 * circle over the head while it shakes. The phases themselves are driven by `TowerGuest`.
 */
export class GuestSplat {
  /** A layer landed on the guest: it slides from `from` to `to` (offsets from the layer centre). */
  readonly slide = { from: 0, to: 0 };
  /** The splat now going is the "fewer effects" one: flattening and the flight away only. */
  plain = false;
  /** Stars circling over the guest's head, and the time they have been circling (negative: none). */
  private readonly orbitStars: Phaser.GameObjects.Image[];
  private orbitMs = -1;
  private readonly orbitPoint: OrbitStar = { x: 0, y: 0, scale: 1, front: true };
  /** A neighbour that giggles at the pancake once `giggleInMs` runs out. */
  private giggler: LayerView | null = null;
  private giggleInMs = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly tower: TowerView,
    private readonly fx: LandingFx,
    private readonly cues: GuestCues,
    private readonly random: Rng,
  ) {
    this.orbitStars = Array.from({ length: orbit.count }, (_, i) =>
      scene.add
        .image(0, 0, FX_TEXTURES.star)
        .setTint(orbit.tints[i % orbit.tints.length] ?? orbit.tints[0])
        .setVisible(false),
    );
  }

  /**
   * A layer (`pose`, index `index`) landed on the guest at `posX`: it is pressed. The layer holds
   * its squash for a moment and dips at that spot, and the camera kicks as for a heavy layer (not
   * in "fewer effects"). The sound is cued either way.
   */
  start(look: GuestLook | null, posX: number, index: number, pose: LayerPose): void {
    const from = posX - pose.x;
    // The pancake stays clear of the new layer's face: the guest is nudged aside as it is pressed.
    const half = look ? Math.max(look.halfWidthPx, look.flat.halfWidthPx) * look.scale : 0;
    this.slide.from = from;
    this.slide.to = clearOfFace(from, faceHalfOf(pose), half, pose.width);
    this.plain = effectsMode.reduced;
    this.cues.splat();
    if (this.plain) return;
    this.tower.viewAt(index)?.playPress(this.slide.to, {
      scaleX: impact.squashX,
      scaleY: impact.squashY,
      holdMs: impact.hitstopMs,
      settleMs: impact.settleMs,
      squashEase: ANIM.land.ease,
      dipPx: impact.dipPx,
      dipEase: impact.dipEase,
    });
    this.cues.kick(impact.kickMul);
  }

  /**
   * The pancake pops in at (`x`, `y`) on the layer `anchorIndex`: stars fly out, a clap ring
   * spreads, the layer above looks down at it, surprised, and the neighbours below glance at it.
   * "Fewer effects" keeps none of it. `holdMs` is how long the pancake is held.
   */
  onFlat(look: GuestLook | null, x: number, y: number, anchorIndex: number, holdMs: number): void {
    if (this.plain) return;
    const { stars, surprise, ring } = splat;
    starBurst(this.fx.particles, x, y, stars.count, -90, stars.style, stars.tints);
    if (look) {
      const width = look.flat.halfWidthPx * 2 * look.scale * ring.widthMul;
      this.fx.ring.play(x, y, width, { tint: ring.tint });
    }
    const lookMs = holdMs + splat.peelMs + surprise.extraMs;
    const view = this.tower.viewAt(anchorIndex);
    if (view) {
      view.faceView.react(surprise.reaction, lookMs);
      view.glanceAtWorld(x, y, lookMs);
    }
    this.glanceNeighbours(x, y, anchorIndex, lookMs);
  }

  /** The layers under the seam may glance at the pancake, and one of them may giggle. */
  private glanceNeighbours(x: number, y: number, anchorIndex: number, ms: number): void {
    const glancers: LayerView[] = [];
    for (let k = 1; k <= neighbours.depth; k++) {
      const view = this.tower.viewAt(anchorIndex - k);
      if (!view || !view.visible || view.faceView.licking) continue;
      if (this.random.next() >= neighbours.glanceChance) continue;
      view.glanceAtWorld(x, y, ms);
      glancers.push(view);
    }
    if (glancers.length === 0 || this.random.next() >= neighbours.giggleChance) return;
    this.giggler = glancers[Math.floor(this.random.next() * glancers.length)] ?? null;
    this.giggleInMs = neighbours.giggleDelayMs;
  }

  /** The neighbour picked to giggle does it once its delay runs out: a happy face and a "хи-хи-хи". */
  tickGiggle(dtMs: number): void {
    const view = this.giggler;
    if (!view) return;
    this.giggleInMs -= dtMs;
    if (this.giggleInMs > 0) return;
    this.giggler = null;
    if (!view.visible || effectsMode.reduced) return;
    view.faceView.react(neighbours.giggle, neighbours.giggleMs);
    this.cues.giggle();
  }

  /** The stars start to circle (the guest begins to shake its head). */
  startOrbit(): void {
    this.orbitMs = 0;
  }

  /** Stars circle over the guest's head while it shakes and fade out as it flies away. */
  drawOrbit(dtMs: number, phase: GuestPhase, phaseMs: number, x: number, y: number): void {
    if (this.orbitMs < 0) return;
    const shaking = phase === 'shake';
    if (!shaking && phase !== 'flee') {
      this.orbitMs = -1;
      for (const star of this.orbitStars) star.setVisible(false);
      return;
    }
    this.orbitMs += dtMs;
    const alpha = shaking ? 1 : 1 - clamp01(phaseMs / orbit.fadeMs);
    this.orbitStars.forEach((star, i) => {
      const p = orbitStar(i, this.orbitMs, this.orbitPoint);
      star
        .setVisible(alpha > 0)
        .setAlpha(alpha)
        .setPosition(x + p.x, y + p.y)
        .setScale(p.scale)
        .setDepth(p.front ? DEPTH.guestStarsFront : DEPTH.guestStarsBack);
    });
    if (alpha <= 0) this.orbitMs = -1;
  }

  /** The guest is gone: no giggle, no stars. */
  reset(): void {
    this.giggler = null;
    this.giggleInMs = -1;
    this.orbitMs = -1;
    for (const star of this.orbitStars) star.setVisible(false);
  }
}
