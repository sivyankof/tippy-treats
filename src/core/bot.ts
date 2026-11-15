import { DIFFICULTY } from '../data/balance';
import { flyingSpeed } from './flight';
import { MS_PER_SECOND } from '../util/math';
import type { Rng } from './rng';
import type { SimEvent, TowerSim } from './tower-sim';

/**
 * Bot player: aims at the first pass over the tower top and taps with a
 * normally distributed timing error drawn once per spawned layer. A late tap
 * is capped at the first wall bounce after the target was passed, so a large
 * error never leaves a layer flying forever. While the ghost guides are active the
 * error is scaled by `DIFFICULTY.guidesSdMult`, and while a cloud covers the layer by
 * `DIFFICULTY.cloudSdMult` (both bot-model assumptions). The estimate uses the instantaneous
 * speed (roof profile, rush); a layer that holds still (rush wind-up, fake-out stop) gives
 * no estimate and is never tapped, and a fake-out reversal resets the aim so it is not
 * mistaken for a wall bounce. A tap needs the target to have been approached first, so a
 * layer that flies away from it after the reversal is aimed only after its next bounce.
 */
export class TimingBot {
  /** Standard normal draw of the current layer; scaled by the standard deviation on every tap check. */
  private unitError = 0;
  private lastDir: 1 | -1 | null = null;
  private passedTarget = false;
  /** The layer has been heading towards the target since the aim was last reset. */
  private approached = false;

  constructor(
    private readonly timingSdMs: number,
    private readonly rng: Rng,
  ) {}

  /** Feed every event batch from the sim so the bot can roll a new error per layer. */
  observe(events: readonly SimEvent[]): void {
    for (const event of events) {
      if (event.type === 'spawn') this.unitError = this.rng.normal();
      if (event.type === 'spawn' || event.type === 'fakeout') this.resetAim();
    }
  }

  private resetAim(): void {
    this.lastDir = null;
    this.passedTarget = false;
    this.approached = false;
  }

  /** True when the bot taps right now. */
  shouldDrop(sim: Pick<TowerSim, 'state' | 'topLayerX' | 'currentModifiers'>): boolean {
    const flying = sim.state.flying;
    if (sim.state.phase !== 'flying' || !flying) return false;
    const speed = flyingSpeed(flying);
    if (speed <= 0) {
      // Holding still: no estimate, and the direction may flip before it moves again.
      this.resetAim();
      return false;
    }
    let sdMult = sim.currentModifiers().guides ? DIFFICULTY.guidesSdMult : 1;
    if (flying.coverMs > 0) sdMult *= DIFFICULTY.cloudSdMult;
    const errorMs = this.unitError * this.timingSdMs * sdMult;
    const msToTarget = (((sim.topLayerX() - flying.x) * flying.dir) / speed) * MS_PER_SECOND;
    // After a fake-out reversal the target may lie behind the layer: no tap until it has
    // actually been approached in the current direction (it then flies on to the wall and back).
    if (msToTarget >= 0) this.approached = true;
    else if (this.approached) this.passedTarget = true;
    const bounced = this.lastDir !== null && this.lastDir !== flying.dir;
    this.lastDir = flying.dir;
    return (this.approached && msToTarget <= -errorMs) || (this.passedTarget && bounced);
  }
}
