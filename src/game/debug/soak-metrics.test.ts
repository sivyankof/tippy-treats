import { describe, expect, it } from 'vitest';
import { countDisplayObjects } from './soak-metrics';

describe('countDisplayObjects', () => {
  it('counts a flat list', () => {
    expect(countDisplayObjects([{}, {}, {}])).toBe(3);
  });

  it('counts the children of containers at any depth, and the containers themselves', () => {
    const inner = { list: [{}, {}] };
    const outer = { list: [inner, {}] };
    expect(countDisplayObjects([outer, {}])).toBe(6);
  });

  it('counts nothing for an empty list', () => {
    expect(countDisplayObjects([])).toBe(0);
  });
});
