import { describe, expect, it } from 'vitest';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { TOWER_WEATHER } from '../../data/tower-weather';
import { YAWN_TOTAL_MS, fitYawnMouth, yawnPose, type YawnMouth, type YawnPose } from './face-yawn';

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

describe('fitYawnMouth', () => {
  const bottomOf = (
    m: YawnMouth,
    open: number,
    p: YawnPose,
    faceY: number,
    faceScale: number,
  ): number => {
    // Bottom of the mouth picture in layer px: the face stretches and lifts, then scales.
    const local = m.y + (1 - Y.mouthOriginY) * Y.mouthPicturePx * m.scale * open;
    return faceY + faceScale * (-p.lift + (1 + p.stretch) * local);
  };
  const limit = BALANCE.layer.height / 2 - ANIM.layer.outline;

  it('keeps the whole mouth above the bottom outline for every moment of the yawn and every face size', () => {
    for (const faceScale of [1, 0.8, 0.6, 0.45]) {
      for (let t = 0; t < YAWN_TOTAL_MS; t += 10) {
        const p = yawnPose(t, blank())!;
        const m = fitYawnMouth(p.open, p.stretch, p.lift, ANIM.face.centerY, faceScale, {
          y: 0,
          scale: 1,
        });
        expect(m.scale).toBeGreaterThanOrEqual(0);
        expect(m.scale).toBeLessThanOrEqual(Y.mouthScale);
        expect(
          bottomOf(m, Math.max(p.open, 0.01), p, ANIM.face.centerY, faceScale),
        ).toBeLessThanOrEqual(limit - Y.bottomMarginPx + 0.001);
      }
    }
  });

  it('gives a roomy face the full mouth size when it fits', () => {
    const m = fitYawnMouth(0.05, 0, 0, ANIM.face.centerY, 1, { y: 0, scale: 1 });
    expect(m.scale).toBe(Y.mouthScale);
  });

  it('shrinks the mouth at the stretched peak of the yawn', () => {
    const peak = yawnPose(Y.prepMs + Y.gapeMs * 0.8, blank())!;
    const m = fitYawnMouth(peak.open, peak.stretch, peak.lift, ANIM.face.centerY, 1, {
      y: 0,
      scale: 1,
    });
    expect(m.scale).toBeLessThan(Y.mouthScale);
    expect(m.scale).toBeGreaterThan(0.3);
  });
});
