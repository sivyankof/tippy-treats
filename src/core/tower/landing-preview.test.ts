import { describe, expect, it } from 'vitest';
import { newLandingPreview, type LandingPreview } from './sim-types';
import { config, pick, runUntil, untilFlying, untilSettled } from './sim-test-utils';
import { TowerSim, type SimEvent } from './tower-sim';

const blank = newLandingPreview;

/** Drops the layer once it has travelled `offset` past the target; returns the preview taken right after the tap. */
function dropWithPreview(
  sim: TowerSim,
  offset: number,
): { preview: LandingPreview | null; events: SimEvent[] } {
  untilFlying(sim);
  const passed = (): boolean => {
    const flying = sim.state.flying;
    return !!flying && (flying.x - sim.topLayerX()) * flying.dir >= offset;
  };
  runUntil(sim, () => !passed());
  runUntil(sim, passed);
  sim.drop();
  const out = blank();
  const preview = sim.landingPreview(out) ? out : null;
  return { preview, events: untilSettled(sim) };
}

describe('TowerSim.landingPreview', () => {
  it('is false outside the fall', () => {
    const sim = new TowerSim(config());
    expect(sim.landingPreview(blank())).toBe(false);
    untilFlying(sim);
    expect(sim.landingPreview(blank())).toBe(false);
  });

  it('predicts the width, the bitten edge and the piece of each landing, wobble included', () => {
    const sim = new TowerSim(config());
    const offsets = [0, 25, -40, 90, 3, -120, 60, 0, 0, 0, 30, -70, 15, 0];
    let checked = 0;
    for (const offset of offsets) {
      const { preview, events } = dropWithPreview(sim, offset);
      const land = pick(events, 'land')[0];
      if (!land) {
        expect(preview).toBeNull();
        break;
      }
      const layer = sim.state.layers.at(-1);
      expect(preview).not.toBeNull();
      expect(preview?.index).toBe(sim.state.layers.length);
      expect(preview?.cut).toBe(land.cutSide);
      expect(preview?.pieceWidth).toBeCloseTo(land.cutSide ? land.cutWidth : 0, 9);
      if (pick(events, 'wobble_sneeze').length === 0) {
        expect(preview?.width).toBeCloseTo(layer?.width ?? -1, 9);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(8);
  });

  it('does not change the run', () => {
    const a = new TowerSim(config());
    const b = new TowerSim(config());
    untilFlying(a);
    untilFlying(b);
    a.drop();
    b.drop();
    a.landingPreview(blank());
    a.landingPreview(blank());
    runUntil(a, () => a.state.phase !== 'falling');
    runUntil(b, () => b.state.phase !== 'falling');
    expect(a.state).toEqual(b.state);
  });

  it('works the landing out once per drop and hands out the same answer every frame', () => {
    const sim = new TowerSim(config());
    untilFlying(sim);
    sim.drop();
    const first = blank();
    expect(sim.landingPreview(first)).toBe(true);
    let calls = 0;
    const view = sim as unknown as { computeLanding: (...args: unknown[]) => boolean };
    const compute = view.computeLanding.bind(sim);
    view.computeLanding = (...args) => {
      calls++;
      return compute(...args);
    };
    for (let i = 0; i < 5; i++) {
      sim.update(16);
      const again = blank();
      if (sim.state.phase !== 'falling') break;
      expect(sim.landingPreview(again)).toBe(true);
      expect(again).toEqual(first);
    }
    expect(calls).toBe(0);
  });

  it('asks again for the next drop', () => {
    const sim = new TowerSim(config());
    const first = dropWithPreview(sim, 0).preview;
    const second = dropWithPreview(sim, 0).preview;
    expect(first).not.toBeNull();
    expect(second?.index).toBe((first?.index ?? 0) + 1);
  });
});
