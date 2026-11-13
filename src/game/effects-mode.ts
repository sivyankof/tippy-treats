import { ANIM } from '../data/anim';
import { LowFpsWatch } from './fx/low-fps-watch';

/** Why "fewer effects" is on: the player's switch, the system setting or a slow device. */
export type ReducedFxReason = 'user' | 'system' | 'low_fps';

/**
 * The "fewer effects" mode: half the particles and no squash wave down the tower.
 *
 * The player's switch always wins. Without it the mode follows the system
 * "reduce motion" setting and turns on by itself once the frame rate stays low
 * (it then stays on for the session). Kept in memory until settings are saved.
 */
export class EffectsMode {
  private userChoice: boolean | null = null;
  private systemReducedMotion = false;
  private lowFps = false;
  private readonly watch = new LowFpsWatch({
    lowFps: ANIM.fx.lowFps,
    windowMs: ANIM.fx.lowFpsWindowMs,
    hitchMs: ANIM.fx.lowFpsHitchMs,
  });

  get reduced(): boolean {
    return this.reason !== null;
  }

  /** What keeps the mode on; `null` when every effect plays. */
  get reason(): ReducedFxReason | null {
    if (this.userChoice !== null) return this.userChoice ? 'user' : null;
    if (this.systemReducedMotion) return 'system';
    return this.lowFps ? 'low_fps' : null;
  }

  /** The player's switch. */
  setReduced(on: boolean): void {
    this.userChoice = on;
  }

  setSystemReducedMotion(on: boolean): void {
    this.systemReducedMotion = on;
  }

  /** Feeds one frame of the run. A frame rate below the limit for the window turns the mode on. */
  noteFrame(deltaMs: number): void {
    if (this.lowFps || this.userChoice !== null) return;
    if (this.watch.update(deltaMs)) this.lowFps = true;
  }

  /** How many particles a burst of `count` gets. A burst never disappears completely. */
  particleCount(count: number): number {
    if (count <= 0 || !this.reduced) return Math.max(0, count);
    return Math.max(1, Math.round(count * ANIM.fx.reducedParticleShare));
  }
}

/** The mode of the running game. */
export const effectsMode = new EffectsMode();

/** Follows the system "reduce motion" setting, now and whenever it changes. */
export function bindSystemReducedMotion(mode: EffectsMode): void {
  if (typeof window.matchMedia !== 'function') return;
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  mode.setSystemReducedMotion(query.matches);
  query.addEventListener('change', (event) => mode.setSystemReducedMotion(event.matches));
}
