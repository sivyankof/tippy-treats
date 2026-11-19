import type { TowerState } from '../../core/tower/tower-sim';
import { TOWER_GUEST } from '../../data/guests/tower-guest';
import { flinchPose, layerOverGuest, shouldFlinch } from './tower-guest-plan';

const { shy } = TOWER_GUEST;

/** The hop the sitting guest makes when a flying layer comes over it. */
export class GuestShy {
  /** Time into the flinch going now; negative when there is none. */
  private ms = -1;
  private away: -1 | 1 = 1;
  private cooldownMs = 0;
  /** A flying layer was near the guest in the last frame. */
  private wasOver = false;
  /** How far the guest is lifted and leaned by the flinch now. */
  readonly pose = { lift: 0, lean: 0 };

  /** A new visit: no flinch, no cooldown. */
  reset(): void {
    this.wasOver = false;
    this.ms = -1;
    this.cooldownMs = 0;
  }

  /** The flinch stops (the guest takes off or is pressed). */
  cancel(): void {
    this.ms = -1;
  }

  /** Looks at the flying layer: starts a flinch when it has just come over the guest at `posX`. */
  notice(dtMs: number, flying: TowerState['flying'], posX: number): void {
    const over = flying !== null && layerOverGuest(posX, flying.x, flying.width);
    this.cooldownMs -= dtMs;
    if (flying && shouldFlinch(over, this.wasOver, this.cooldownMs)) {
      this.ms = 0;
      this.cooldownMs = shy.cooldownMs;
      this.away = flying.x < posX ? 1 : -1;
    }
    this.wasOver = over;
  }

  /** Runs the flinch on. */
  advance(dtMs: number): void {
    if (this.ms < 0) return;
    this.ms += dtMs;
    if (this.ms >= shy.hopMs) this.ms = -1;
  }

  /** Fills `pose` for this frame. */
  update(): void {
    if (this.ms >= 0) flinchPose(this.ms, this.away, this.pose);
    else this.pose.lift = this.pose.lean = 0;
  }
}
