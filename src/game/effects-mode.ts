import type { ReducedFxSetting } from '../core/save/schema';
import { ANIM } from '../data/common/anim';
import { EFFECT_LEVELS, type EffectLevel } from '../data/app/effect-levels';
import { FrameWorkWatch } from './fx/app/frame-work-watch';

const FULL = EFFECT_LEVELS.indexOf('full');
const LITE = EFFECT_LEVELS.indexOf('lite');
const MINIMAL = EFFECT_LEVELS.indexOf('minimal');

/** Why the effects are below full: the player's switch, the system setting or the automatic mode on a slow device. */
export type ReducedFxReason = 'user' | 'system' | 'auto';

/**
 * The effects level: `full`, `lite` (half the particles, no wet tongue trail, a still far
 * backdrop, the short lick instead of the big one) or `minimal` (the old "fewer effects": half
 * the particles and no squash wave down the tower, among others).
 *
 * The level is the poorest of two things. The automatic mode steps down and up one level at a
 * time when the frame work time stays over budget (and back after a calm stretch); the player's
 * switch sets a ceiling for it: `on` never goes above `lite` (the mode starts there and may still
 * go on to `minimal`), `off` and `auto` set none. The system "reduce motion" setting holds
 * `minimal` unless the player switched `off`. The choice itself is saved in the settings.
 */
export class EffectsMode {
  private userChoice: boolean | null = null;
  private systemReducedMotion = false;
  /** A level held by the benchmark, which ignores everything else. */
  private pinned: number | null = null;
  private readonly watch = new FrameWorkWatch(ANIM.fx.auto, EFFECT_LEVELS.length - 1);

  /** The minimal level: what every "fewer effects" check of the game asks for. */
  get reduced(): boolean {
    return this.step === MINIMAL;
  }

  get level(): EffectLevel {
    return EFFECT_LEVELS[this.step] ?? 'full';
  }

  /** True while the effects are at `level` or poorer: `atMost('lite')` holds on lite and on minimal. */
  atMost(level: EffectLevel): boolean {
    return this.step >= EFFECT_LEVELS.indexOf(level);
  }

  /** What keeps the effects below full; `null` when every effect plays. */
  get reason(): ReducedFxReason | null {
    const step = this.step;
    if (step === FULL) return null;
    if (this.pinned !== null) return 'user';
    if (this.systemStep === step) return 'system';
    return this.userFloor === step ? 'user' : 'auto';
  }

  /**
   * The state the "fewer effects" switch shows: on when the player chose `on`, or left it on
   * `auto` and the effects are cut now. A player's `off` always shows off, whatever the automatic mode does.
   */
  get switchOn(): boolean {
    return this.userChoice === null ? this.step !== FULL : this.userChoice;
  }

  /** Holds `level` whatever the device does (the benchmark); `null` lets the mode decide again. */
  pinLevel(level: EffectLevel | null): void {
    this.pinned = level === null ? null : EFFECT_LEVELS.indexOf(level);
  }

  private get userFloor(): number {
    return this.userChoice === true ? LITE : FULL;
  }

  private get systemStep(): number {
    return this.systemReducedMotion && this.userChoice !== false ? MINIMAL : FULL;
  }

  private get step(): number {
    if (this.pinned !== null) return this.pinned;
    return Math.max(this.watch.level, this.systemStep);
  }

  /** The player's choice as `setChoice` takes it. */
  getChoice(): ReducedFxSetting {
    return this.userChoice === null ? 'auto' : this.userChoice ? 'on' : 'off';
  }

  /** The player's choice from the settings: `auto` hands the decision back to the system and the frame rate. */
  setChoice(setting: ReducedFxSetting): void {
    this.userChoice = setting === 'auto' ? null : setting === 'on';
    this.watch.setFloor(this.userFloor);
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

  /** How many particles a burst of `count` gets (half on lite and minimal). A burst never disappears completely. */
  particleCount(count: number): number {
    if (count <= 0 || !this.atMost('lite')) return Math.max(0, count);
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
