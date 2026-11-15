import { describe, expect, it } from 'vitest';
import { ANIM } from '../../data/anim';
import { introProgress, introRiseMs, RunIntro } from './run-intro';

const linear = (t: number): number => t;
const { holdMs, baseMs, perLayerMs, maxMs } = ANIM.runIntro;

describe('run intro', () => {
  it('rises longer for a taller tower, up to a cap', () => {
    expect(introRiseMs(20)).toBe(baseMs + 20 * perLayerMs);
    expect(introRiseMs(1000)).toBe(maxMs);
  });

  it('holds the tower view first, then rises, then stays on top', () => {
    const rise = introRiseMs(40);
    expect(introProgress(0, 40, linear)).toBe(0);
    expect(introProgress(holdMs, 40, linear)).toBe(0);
    expect(introProgress(holdMs + rise / 2, 40, linear)).toBeCloseTo(0.5);
    expect(introProgress(holdMs + rise, 40, linear)).toBe(1);
    expect(introProgress(holdMs + rise * 3, 40, linear)).toBe(1);
  });

  it('is active until the rise ends and moves the scroll from the tower view to the top', () => {
    const intro = new RunIntro(40, false, linear);
    expect(intro.active).toBe(true);
    expect(intro.scroll(-500, -5000)).toBe(-500);
    intro.tick(holdMs + introRiseMs(40) - 1);
    expect(intro.active).toBe(true);
    intro.tick(1);
    expect(intro.active).toBe(false);
    expect(intro.scroll(-500, -5000)).toBe(-5000);
  });

  it('does not exist without a built tower or with fewer effects', () => {
    expect(new RunIntro(0, false, linear).active).toBe(false);
    expect(new RunIntro(40, true, linear).active).toBe(false);
  });
});
