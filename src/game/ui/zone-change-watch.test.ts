import { describe, expect, it } from 'vitest';
import { checkpointStartWidth } from '../../core/zones/checkpoints';
import { config, mutable, untilFlying, untilSettled } from '../../core/tower/sim-test-utils';
import { TowerSim } from '../../core/tower/tower-sim';
import { zoneIndexOf } from '../../core/zones/zones';
import { BALANCE } from '../../data/tower/balance';
import { CHECKPOINT_HEIGHTS } from '../../data/zones/checkpoints';
import { ZoneChangeWatch } from './zone-change-watch';

/** The zones a run from a checkpoint reports to the watch, frame by frame, while it places perfect layers. */
function zonesAnnounced(start: (typeof CHECKPOINT_HEIGHTS)[number], placed: number) {
  const sim = new TowerSim(
    config({ seed: 5, startHeight: start, startWidth: checkpointStartWidth(start) }),
  );
  const watch = new ZoneChangeWatch();
  const announced: Array<{ layer: number; zone: number }> = [];
  const feed = (): void => {
    const zone = watch.observe(sim.state.zoneIndex);
    if (zone !== null) announced.push({ layer: sim.state.layers.length + 1, zone });
  };
  feed();
  for (let i = 0; i < placed; i++) {
    untilFlying(sim);
    feed();
    const flying = mutable(sim).flying;
    if (flying) flying.x = sim.topLayerX();
    sim.drop();
    untilSettled(sim);
    feed();
  }
  return announced;
}

describe('ZoneChangeWatch', () => {
  it('does not announce the zone a run starts in', () => {
    const watch = new ZoneChangeWatch();
    expect(watch.observe(null)).toBeNull();
    expect(watch.observe(0)).toBeNull();
    expect(watch.observe(0)).toBeNull();
  });

  it('does not announce a debug start deep in the tower', () => {
    const watch = new ZoneChangeWatch();
    expect(watch.observe(3)).toBeNull();
    expect(watch.observe(3)).toBeNull();
  });

  it('announces a higher zone once', () => {
    const watch = new ZoneChangeWatch();
    watch.observe(0);
    expect(watch.observe(1)).toBe(1);
    expect(watch.observe(1)).toBeNull();
    expect(watch.observe(2)).toBe(2);
  });

  it('stays quiet when a restart drops the zone back', () => {
    const watch = new ZoneChangeWatch();
    watch.observe(2);
    expect(watch.observe(0)).toBeNull();
    expect(watch.observe(0)).toBeNull();
    expect(watch.observe(1)).toBe(1);
  });

  it('keeps its baseline while no run is available', () => {
    const watch = new ZoneChangeWatch();
    watch.observe(1);
    expect(watch.observe(null)).toBeNull();
    expect(watch.observe(1)).toBeNull();
  });

  it.each(CHECKPOINT_HEIGHTS)(
    'shows no plate at a start from %i, only at the next zone',
    (start) => {
      const nextZoneLayer = (zoneIndexOf(start + 1) + 1) * BALANCE.zones.length + 1;
      const placed = nextZoneLayer - start;
      const announced = zonesAnnounced(start, placed);
      const lastZone = zoneIndexOf(Number.MAX_SAFE_INTEGER);
      if (zoneIndexOf(start + 1) >= lastZone) {
        expect(announced).toEqual([]);
      } else {
        // The plate comes with the first layer of the next zone, never at the start.
        expect(announced).toEqual([{ layer: nextZoneLayer, zone: zoneIndexOf(start + 1) + 1 }]);
      }
    },
  );
});
