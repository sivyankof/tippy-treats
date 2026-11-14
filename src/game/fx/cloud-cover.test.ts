import { describe, expect, it } from 'vitest';
import { RULE_ANIM } from '../../data/rule-anim';
import {
  cloudEtaMs,
  CloudMotion,
  stepApproach,
  type CloudInput,
  type CloudPhase,
  type CloudPose,
} from './cloud-cover';

const cfg = RULE_ANIM.cloud;

describe('cloudEtaMs', () => {
  it('turns the track left into time, with the nominal speed while the layer stands still', () => {
    expect(cloudEtaMs(300, 600, 600)).toBeCloseTo(500);
    expect(cloudEtaMs(300, 0, 600)).toBeCloseTo(500);
    expect(cloudEtaMs(-1, 600, 600)).toBe(Infinity);
  });
});

describe('stepApproach', () => {
  it('only grows and reaches 1 when the cloud arrives', () => {
    let p = 0;
    let eta = 600;
    while (eta > 0) {
      const next = stepApproach(p, 20, eta);
      expect(next).toBeGreaterThanOrEqual(p);
      p = next;
      eta -= 20;
    }
    expect(p).toBe(1);
  });

  it('never steps back when the estimate jumps', () => {
    const p = stepApproach(0.5, 20, 100);
    expect(stepApproach(p, 20, 2000)).toBeGreaterThanOrEqual(p);
  });
});

interface Frame {
  t: number;
  phase: CloudPhase;
  pose: CloudPose;
  y: number;
}

/**
 * A cloud pass as the run would feed it: the layer flies at 600 px/s, the cloud is due once the
 * layer has 900 px to go, the sim hides the layer for `coverMs`, then the layer flies on (or is
 * dropped). Frame times come from `dts`, cycled.
 */
function film(dts: readonly number[], coverMs = 300, dropAfterCover = false): Frame[] {
  const motion = new CloudMotion();
  const speed = 600;
  let ahead = 900;
  let coverLeft = 0;
  let covered = false;
  let dropped = false;
  const frames: Frame[] = [];
  let t = 0;
  for (let i = 0; t < 4000; i++) {
    const dt = dts[i % dts.length] ?? 16;
    t += dt;
    if (!covered) {
      ahead -= (speed * dt) / 1000;
      if (ahead <= 0) {
        covered = true;
        coverLeft = coverMs;
      }
    } else if (coverLeft > 0) {
      coverLeft -= dt;
      if (coverLeft <= 0 && dropAfterCover) dropped = true;
    }
    const input: CloudInput = {
      covering: covered && coverLeft > 0,
      flying: !dropped,
      etaMs: covered ? Infinity : (ahead / speed) * 1000,
      // The flying row moves up when a new layer comes: the bank must not follow it.
      y: t > 1500 ? 380 : 500,
      dir: 1,
    };
    const pose = motion.update(dt, input);
    frames.push({ t, phase: motion.phase, pose: { ...pose }, y: motion.y });
  }
  return frames;
}

/** Checks one filmed pass: monotonic, no jumps, a warning of at least 400 ms. */
function checkSmooth(frames: Frame[]): void {
  const seen = frames.filter((f) => f.phase !== 'idle');
  expect(seen.length).toBeGreaterThan(10);
  const firstCover = frames.find((f) => f.phase === 'cover');
  const firstShown = seen[0];
  expect(firstCover && firstShown).toBeTruthy();
  if (!firstCover || !firstShown) return;
  // "It is about to cover" shows at least 400 ms ahead.
  expect(firstCover.t - firstShown.t).toBeGreaterThanOrEqual(400);
  let peak = false;
  for (let i = 1; i < seen.length; i++) {
    const a = seen[i - 1];
    const b = seen[i];
    if (!a || !b) continue;
    // It drifts one way only (dir = 1), never faster than a gentle glide (px per ms).
    expect(b.pose.x).toBeGreaterThanOrEqual(a.pose.x - 1e-9);
    expect((b.pose.x - a.pose.x) / (b.t - a.t)).toBeLessThan(1.5);
    // Opacity rises to full, then only falls, and never by a jump (share per ms).
    expect(Math.abs(b.pose.alpha - a.pose.alpha) / (b.t - a.t)).toBeLessThan(0.012);
    if (b.pose.alpha < a.pose.alpha - 1e-9) peak = true;
    if (peak) expect(b.pose.alpha).toBeLessThanOrEqual(a.pose.alpha + 1e-9);
    // The bank stays at the height it came at.
    expect(b.y).toBe(firstShown.y);
  }
  expect(seen.at(-1)?.pose.alpha ?? 1).toBeLessThan(0.02);
}

describe('CloudMotion', () => {
  it('floats in, covers and leaves smoothly at 45 frames per second', () => {
    checkSmooth(film([22]));
  });

  it('stays smooth with uneven frames like a slow phone', () => {
    checkSmooth(film([16, 33, 22, 41, 18, 28]));
  });

  it('stays smooth when the layer is dropped right after the cover', () => {
    checkSmooth(film([22], 250, true));
  });

  it('is solid while the sim hides the layer once it has turned solid', () => {
    const frames = film([16]);
    const solid = frames.filter(
      (f) =>
        f.phase === 'cover' && f.t - (frames.find((g) => g.phase === 'cover')?.t ?? 0) >= cfg.inMs,
    );
    expect(solid.length).toBeGreaterThan(0);
    for (const f of solid) expect(f.pose.alpha).toBeCloseTo(1, 6);
  });

  it('fades away a cloud that never came because the layer was dropped', () => {
    const motion = new CloudMotion();
    const base: CloudInput = { covering: false, flying: true, etaMs: 300, y: 400, dir: -1 };
    for (let i = 0; i < 5; i++) motion.update(20, base);
    expect(motion.phase).toBe('approach');
    const alpha = motion.pose.alpha;
    expect(alpha).toBeGreaterThan(0);
    motion.update(20, { ...base, flying: false, etaMs: Infinity });
    expect(motion.phase).toBe('leave');
    let last = motion.pose.alpha;
    expect(last).toBeLessThanOrEqual(alpha);
    for (let t = 0; t < cfg.abortMs + 40; t += 20) {
      motion.update(20, { ...base, flying: false, etaMs: Infinity });
      expect(motion.pose.alpha).toBeLessThanOrEqual(last + 1e-9);
      last = motion.pose.alpha;
    }
    expect(motion.phase).toBe('idle');
  });

  it('grows in place when a cloud comes without a warning', () => {
    const motion = new CloudMotion();
    const pose = motion.update(16, {
      covering: true,
      flying: true,
      etaMs: Infinity,
      y: 400,
      dir: 1,
    });
    expect(motion.phase).toBe('cover');
    expect(Math.abs(pose.x)).toBeLessThan(5);
    expect(pose.alpha).toBeLessThan(0.5);
  });
});
