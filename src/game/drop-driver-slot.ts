import { TimingBot } from '../core/tower/bot';
import { Rng } from '../core/common/rng';
import type { SimEvent, TowerSim } from '../core/tower/tower-sim';
import type { DropDriver } from './perf/perf-drivers';

/** Who taps for the player in the current run: the benchmark's driver, the dev bot or nobody. The dev hooks swap it for a moment. */
export class DropDriverSlot {
  private driver: DropDriver | null = null;

  /** The driver of a new run: the benchmark's replaces the bot. */
  reset(perfDriver: DropDriver | undefined, botSd: number | undefined, seed: number): void {
    this.driver =
      perfDriver ?? (botSd !== undefined ? new TimingBot(botSd, new Rng(seed).fork('bot')) : null);
  }

  get current(): DropDriver | null {
    return this.driver;
  }

  set(driver: DropDriver | null): void {
    this.driver = driver;
  }

  /** Lets the driver see this step's events and says whether it taps now. */
  shouldDrop(
    events: readonly SimEvent[],
    sim: Pick<TowerSim, 'state' | 'topLayerX' | 'currentModifiers'>,
    held: boolean,
  ): boolean {
    this.driver?.observe(events);
    return !held && (this.driver?.shouldDrop(sim) ?? false);
  }
}
