import { describe, expect, it } from 'vitest';
import { zoneIndexOf } from '../../core/zones';
import { PERF_SEGMENTS, PERF_TRANSITION, type PerfSegmentDef } from '../../data/debug/perf';

describe('transition segments', () => {
  const transitions: PerfSegmentDef[] = PERF_SEGMENTS.filter((segment) =>
    segment.id.startsWith('transition-'),
  );

  it('cross every zone boundary of the tower once', () => {
    const boundaries = transitions.map((segment) => Number(segment.id.split('-')[1]));
    expect(boundaries).toEqual([20, 40, 60, 80, 100]);
    for (const boundary of boundaries) {
      expect(zoneIndexOf(boundary + 1)).toBe(zoneIndexOf(boundary) + 1);
    }
  });

  it('start in the zone below the boundary, far enough down for what the change prepares', () => {
    for (const segment of transitions) {
      const boundary = Number(segment.id.split('-')[1]);
      expect(segment.start).toBe(boundary - PERF_TRANSITION.layersBefore);
      expect(zoneIndexOf(segment.start + 1)).toBe(zoneIndexOf(boundary));
      expect(segment.endAfterFade).toBe(true);
    }
  });
});
