import { describe, expect, it } from 'vitest';
import { ZoneChangeWatch } from './zone-change-watch';

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
});
