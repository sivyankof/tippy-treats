import { TimingBot } from '../../core/bot';
import { Rng } from '../../core/rng';
import type { SimEvent, TowerSim } from '../../core/tower-sim';
import { BALANCE } from '../../data/balance';
import type { PerfDriverSpec } from '../../data/perf';

/** Who drops the layers of a run: the dev bot (`TimingBot`) and the benchmark's drivers all fit. */
export interface DropDriver {
  observe(events: readonly SimEvent[]): void;
  shouldDrop(sim: Pick<TowerSim, 'state' | 'topLayerX' | 'currentModifiers'>): boolean;
}

/** Nobody taps: the flying layer keeps bouncing between the walls. */
export class IdleDriver implements DropDriver {
  observe(): void {}
  shouldDrop(): boolean {
    return false;
  }
}

/** A tap that cannot land on the tower: it waits to be armed, then drops once the layer is far enough to the side. */
export class MissDriver implements DropDriver {
  private armed = false;
  private tapped = false;

  /** From now on the driver taps at the first certain miss. */
  arm(): void {
    this.armed = true;
  }

  /** The certain miss has been tapped. */
  get fired(): boolean {
    return this.tapped;
  }

  observe(): void {}

  shouldDrop(sim: Pick<TowerSim, 'state' | 'topLayerX'>): boolean {
    const { flying, phase } = sim.state;
    if (!this.armed || this.tapped || phase !== 'flying' || !flying) return false;
    // `resolveDrop` calls it a miss from this distance on; a few pixels more for the sway.
    const far = flying.width - BALANCE.drop.missMargin + MISS_SLACK_PX;
    if (Math.abs(flying.x - sim.topLayerX()) < far) return false;
    this.tapped = true;
    return true;
  }
}

const MISS_SLACK_PX = 4;

/** The driver of a segment. */
export function createDriver(spec: PerfDriverSpec, seed: number): DropDriver {
  if (spec.kind === 'bot') return new TimingBot(spec.sdMs, new Rng(seed).fork('bot'));
  return spec.kind === 'miss' ? new MissDriver() : new IdleDriver();
}
