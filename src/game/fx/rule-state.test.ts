import { describe, expect, it } from 'vitest';
import { roofFactor } from '../../core/flight';
import { BALANCE } from '../../data/balance';
import { ZONE_RULES } from '../../data/zones';
import { idleVisual, isCovered, ruleVisual, windStrength, type RuleFields } from './rule-state';

const layer = (over: Partial<RuleFields> = {}): RuleFields => ({
  speed: 600,
  x: 540,
  rule: 'none',
  rush: false,
  windupMs: 0,
  stopMs: 0,
  coverMs: 0,
  ...over,
});

describe('ruleVisual', () => {
  it('shows nothing without a layer or once it is dropped', () => {
    expect(ruleVisual(null, 'flying', idleVisual())).toEqual(idleVisual());
    expect(ruleVisual(layer({ rush: true, coverMs: 300 }), 'falling', idleVisual())).toEqual(
      idleVisual(),
    );
  });

  it('shows nothing extra for a plain layer', () => {
    expect(ruleVisual(layer(), 'flying', idleVisual())).toEqual(idleVisual());
  });

  it('outlines a rush layer from its spawn and calls the hold a wind-up', () => {
    const rush = layer({ rule: 'showcase', rush: true, windupMs: ZONE_RULES.rush.windupMs });
    const spawn = ruleVisual(rush, 'flying', idleVisual());
    expect(spawn.outline).toBe(true);
    expect(spawn.winding).toBe(true);
    expect(spawn.windupProgress).toBe(0);
    expect(spawn.streaks).toBe(0);

    const half = ruleVisual(
      { ...rush, windupMs: ZONE_RULES.rush.windupMs / 2 },
      'flying',
      idleVisual(),
    );
    expect(half.windupProgress).toBeCloseTo(0.5);
  });

  it('keeps the outline but shows the red streaks once the rush dashes', () => {
    const dash = ruleVisual(layer({ rule: 'showcase', rush: true }), 'flying', idleVisual());
    expect(dash.outline).toBe(true);
    expect(dash.winding).toBe(false);
    expect(dash.streaks).toBe(1);
    expect(dash.streakKind).toBe('rush');
  });

  it('follows flyingSpeed for the roof wind: strongest in the middle, none at the walls', () => {
    const { minCenterX, maxCenterX } = BALANCE.layer;
    const middle = ruleVisual(
      layer({ rule: 'roof', x: (minCenterX + maxCenterX) / 2 }),
      'flying',
      idleVisual(),
    );
    const wall = ruleVisual(layer({ rule: 'roof', x: minCenterX }), 'flying', idleVisual());
    const between = ruleVisual(
      layer({ rule: 'roof', x: minCenterX + 120 }),
      'flying',
      idleVisual(),
    );
    expect(middle.streaks).toBeCloseTo(1);
    expect(wall.streaks).toBeCloseTo(0);
    expect(between.streaks).toBeGreaterThan(0);
    expect(between.streaks).toBeLessThan(1);
    expect(middle.streakKind).toBe('wind');
  });

  it('has no roof wind while the layer holds still', () => {
    expect(ruleVisual(layer({ rule: 'roof', stopMs: 100 }), 'flying', idleVisual()).streaks).toBe(
      0,
    );
  });

  it('marks the layer covered exactly while coverMs is above zero', () => {
    expect(ruleVisual(layer({ rule: 'clouds', coverMs: 1 }), 'flying', idleVisual()).covered).toBe(
      true,
    );
    expect(ruleVisual(layer({ rule: 'clouds', coverMs: 0 }), 'flying', idleVisual()).covered).toBe(
      false,
    );
  });

  it('reuses the object it is given', () => {
    const out = idleVisual();
    expect(ruleVisual(layer({ coverMs: 5 }), 'flying', out)).toBe(out);
  });
});

describe('isCovered', () => {
  it('hides the layer while a cloud hangs and it still flies, not once it is dropped', () => {
    expect(isCovered({ coverMs: 200 }, 'flying')).toBe(true);
    expect(isCovered({ coverMs: 0 }, 'flying')).toBe(false);
    expect(isCovered({ coverMs: 200 }, 'falling')).toBe(false);
    expect(isCovered(null, 'flying')).toBe(false);
  });
});

describe('windStrength', () => {
  it('maps the roof speed range onto 0..1', () => {
    const { edgeMult, centreMult } = ZONE_RULES.roof;
    expect(windStrength(edgeMult)).toBeCloseTo(0);
    expect(windStrength(centreMult)).toBeCloseTo(1);
    expect(windStrength(1)).toBeCloseTo((1 - edgeMult) / (centreMult - edgeMult));
    expect(windStrength(0)).toBe(0);
    expect(windStrength(5)).toBe(1);
  });

  it('agrees with the roof profile of the core', () => {
    const { minCenterX, maxCenterX } = BALANCE.layer;
    expect(windStrength(roofFactor((minCenterX + maxCenterX) / 2))).toBeCloseTo(1);
  });
});
