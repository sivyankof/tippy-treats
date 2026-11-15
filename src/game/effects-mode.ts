import type { ReducedFxSetting } from '../core/save/schema';
import { ANIM } from '../data/anim';
import { FrameWorkWatch } from './fx/frame-work-watch';

/** Why "fewer effects" is on: the player's switch, the system setting or the automatic mode on a slow device. */
export type ReducedFxReason = 'user' | 'system' | 'auto';

/**
 * The "fewer effects" mode: half the particles and no squash wave down the tower.
 *
 * The player's switch always wins. Without it the mode follows the system "reduce motion"
 * setting and turns on by itself when the frame work time stays over budget (and turns off
 * again after a calm stretch). The choice itself is saved in the settings.
 */
export class EffectsMode {
  private userChoice: boolean | null = null;
  private systemReducedMotion = false;
  private readonly watch = new FrameWorkWatch(ANIM.fx.auto);

  get reduced(): boolean {
    return this.reason !== null;
  }

  /** What keeps the mode on; `null` when every effect plays. */
  get reason(): ReducedFxReason | null {
    if (this.userChoice !== null) return this.userChoice ? 'user' : null;
    if (this.systemReducedMotion) return 'system';
    return this.watch.reduced ? 'auto' : null;
  }

  /** The player's choice from the settings: `auto` hands the decision back to the system and the frame rate. */
  setChoice(setting: ReducedFxSetting): void {
    this.userChoice = setting === 'auto' ? null : setting === 'on';
  }

  setSystemReducedMotion(on: boolean): void {
    this.systemReducedMotion = on;
  }

  /** Feeds one frame: the time its update and render took and the time it ended at. */
  noteFrame(workMs: number, nowMs: number): void {
    this.watch.note(workMs, nowMs);
  }

  /** A scene was created: its first seconds (baking, settling) are not judged. */
  noteSceneLoaded(nowMs: number): void {
    this.watch.restart(nowMs, ANIM.fx.auto.warmUpMs);
  }

  /** The app came back from the background: the frames right after it are not judged. */
  noteResumed(nowMs: number): void {
    this.watch.restart(nowMs, ANIM.fx.auto.resumeIgnoreMs);
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
