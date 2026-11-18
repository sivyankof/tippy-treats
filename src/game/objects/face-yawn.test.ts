import { describe, expect, it } from 'vitest';
import { TOWER_WEATHER } from '../../data/tower-weather';
import { YAWN_TOTAL_MS, yawnPose, type YawnPose } from './face-yawn';

const Y = TOWER_WEATHER.sleepy.yawn;
const blank = (): YawnPose => ({ open: 0, stretch: 0, lift: 0 });

describe('yawnPose', () => {
  it('lasts the three phases and is null outside them', () => {
    expect(YAWN_TOTAL_MS).toBe(Y.prepMs + Y.gapeMs + Y.closeMs);
    expect(yawnPose(-1, blank())).toBeNull();
    expect(yawnPose(YAWN_TOTAL_MS, blank())).toBeNull();
    expect(yawnPose(0, blank())).not.toBeNull();
  });

  it('draws the face up with the mouth shut during the anticipation', () => {
    const early = yawnPose(Y.prepMs * 0.5, blank())!;
    const end = yawnPose(Y.prepMs - 1, blank())!;
    expect(early.open).toBe(0);
    expect(end.stretch).toBeGreaterThan(early.stretch);
    expect(end.stretch).toBeLessThanOrEqual(Y.stretchPrep);
    expect(end.lift).toBeGreaterThan(0);
  });

  it('opens wide for the gape and holds it', () => {
    const mid = yawnPose(Y.prepMs + Y.gapeMs * 0.5, blank())!;
    expect(mid.open).toBeGreaterThan(0.9);
    expect(mid.stretch).toBeGreaterThan(Y.stretchPrep);
  });

  it('shuts with a smack and springs through a squash back to rest', () => {
    let squashed = false;
    let smacked = false;
    let shut = false;
    for (let t = Y.prepMs + Y.gapeMs; t < YAWN_TOTAL_MS; t += 8) {
      const p = yawnPose(t, blank())!;
      if (p.stretch < 0) squashed = true;
      if (p.open < 0.02) shut = true;
      else if (shut && p.open > 0.05) smacked = true;
    }
    expect(squashed).toBe(true);
    expect(shut).toBe(true);
    expect(smacked).toBe(true);
    const last = yawnPose(YAWN_TOTAL_MS - 1, blank())!;
    expect(Math.abs(last.stretch)).toBeLessThan(0.01);
    expect(last.lift).toBeLessThan(0.1);
  });
});
