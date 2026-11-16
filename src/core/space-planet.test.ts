import { describe, expect, it } from 'vitest';
import { SPACE_PLANET_IDS } from '../data/space-planets';
import { SPACE_ZONE_INDEX } from '../data/zones';
import { LapChangeWatch, lapOfKey, planetOfLap, sceneryKey } from './space-planet';
import { spaceLap } from './space-laps';

describe('planetOfLap', () => {
  it('shows the nine planets in order', () => {
    SPACE_PLANET_IDS.forEach((id, i) => expect(planetOfLap(i + 1)).toBe(id));
    expect(planetOfLap(1)).toBe('marshmallow_moon');
    expect(planetOfLap(9)).toBe('truffle_hole');
  });

  it('starts over after the ninth lap', () => {
    expect(planetOfLap(10)).toBe(planetOfLap(1));
    expect(planetOfLap(18)).toBe(planetOfLap(9));
    expect(planetOfLap(19)).toBe(planetOfLap(1));
  });

  it('takes lap 0 or less for the first lap', () => {
    expect(planetOfLap(0)).toBe(planetOfLap(1));
    expect(planetOfLap(-3)).toBe(planetOfLap(1));
  });

  it('follows spaceLap of a layer index', () => {
    expect(planetOfLap(spaceLap(101))).toBe('marshmallow_moon');
    expect(planetOfLap(spaceLap(121))).toBe('cookie');
    expect(planetOfLap(spaceLap(100 + 20 * 9 + 1))).toBe('marshmallow_moon');
  });
});

describe('sceneryKey', () => {
  it('is the zone index before Space and for the first lap', () => {
    expect(sceneryKey(0, 0)).toBe(0);
    expect(sceneryKey(SPACE_ZONE_INDEX - 1, 0)).toBe(SPACE_ZONE_INDEX - 1);
    expect(sceneryKey(SPACE_ZONE_INDEX, 1)).toBe(SPACE_ZONE_INDEX);
  });

  it('grows with every lap of Space and maps back to the lap', () => {
    expect(sceneryKey(SPACE_ZONE_INDEX, 3)).toBe(SPACE_ZONE_INDEX + 2);
    expect(lapOfKey(sceneryKey(SPACE_ZONE_INDEX, 3))).toBe(3);
    expect(lapOfKey(0)).toBe(0);
  });
});

describe('LapChangeWatch', () => {
  it('announces nothing at the start, whatever the lap', () => {
    const watch = new LapChangeWatch(2);
    expect(watch.observe(null)).toBeNull();
    expect(watch.observe(5)).toBeNull();
    expect(watch.observe(5)).toBeNull();
  });

  it('announces a higher lap from lap 2 on, once', () => {
    const watch = new LapChangeWatch(2);
    watch.observe(0);
    expect(watch.observe(1)).toBeNull();
    expect(watch.observe(2)).toBe(2);
    expect(watch.observe(2)).toBeNull();
    expect(watch.observe(3)).toBe(3);
  });

  it('resets silently when the lap goes down (restart)', () => {
    const watch = new LapChangeWatch(2);
    watch.observe(4);
    expect(watch.observe(0)).toBeNull();
    expect(watch.observe(1)).toBeNull();
    expect(watch.observe(2)).toBe(2);
  });
});
