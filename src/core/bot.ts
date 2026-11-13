import type { Rng } from './rng';
import type { SimEvent, TowerSim } from './tower-sim';

/**
 * Bot player: aims at the first pass over the tower top and taps with a
 * normally distributed timing error drawn once per spawned layer. A late tap
 * is capped at the first wall bounce after the target was passed, so a large
 * error never leaves a layer flying forever.
 */
export class TimingBot {
  private errorMs = 0;
  private lastDir: 1 | -1 | null = null;
  private passedTarget = false;

  constructor(
    private readonly timingSdMs: number,
    private readonly rng: Rng,
  ) {}

  /** Feed every event batch from the sim so the bot can roll a new error per layer. */
  observe(events: readonly SimEvent[]): void {
    for (const event of events) {
      if (event.type !== 'spawn') continue;
      this.errorMs = this.rng.normal() * this.timingSdMs;
      this.lastDir = null;
      this.passedTarget = false;
    }
  }

  /** True when the bot taps right now. */
  shouldDrop(sim: Pick<TowerSim, 'state' | 'topLayerX'>): boolean {
    const flying = sim.state.flying;
    if (sim.state.phase !== 'flying' || !flying) return false;
    const msToTarget = (((sim.topLayerX() - flying.x) * flying.dir) / flying.speed) * 1000;
    if (msToTarget <= 0) this.passedTarget = true;
    const bounced = this.lastDir !== null && this.lastDir !== flying.dir;
    this.lastDir = flying.dir;
    return msToTarget <= -this.errorMs || (this.passedTarget && bounced);
  }
}
