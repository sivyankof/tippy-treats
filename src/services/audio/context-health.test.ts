import { describe, expect, it } from 'vitest';
import { ContextHealth, type HealthVerdict } from './context-health';

const cfg = {
  aliveMs: 200,
  minRate: 0.5,
  ladder: [
    { atMs: 300, step: 'resume' },
    { atMs: 1000, step: 'resume' },
    { atMs: 2000, step: 'resume' },
    { atMs: 2300, step: 'bounce' },
    { atMs: 2700, step: 'remake' },
  ],
} as const;

/** Looks every 100 ms from `fromMs` to `toMs`; `clockAt` gives the context clock at each time. */
function looks(
  health: ContextHealth,
  fromMs: number,
  toMs: number,
  clockAt: (ms: number) => number,
  held = false,
): { at: number; verdict: HealthVerdict }[] {
  const out: { at: number; verdict: HealthVerdict }[] = [];
  for (let t = fromMs; t <= toMs; t += 100) {
    out.push({ at: t, verdict: health.look({ nowMs: t, clockSec: clockAt(t), held }) });
  }
  return out;
}

const steps = (seen: { at: number; verdict: HealthVerdict }[]): string[] =>
  seen.flatMap(({ at, verdict }) => (verdict.kind === 'step' ? [`${at} ${verdict.step}`] : []));

describe('ContextHealth', () => {
  it('a clock that stands climbs the ladder: resume three times, stop and start, make again', () => {
    const health = new ContextHealth(cfg);
    health.suspectNow();
    const seen = looks(health, 0, 3000, () => 58.8);
    expect(steps(seen)).toEqual([
      '300 resume',
      '1000 resume',
      '2000 resume',
      '2300 bounce',
      '2700 remake',
    ]);
    expect(health.running).toBe(false);
  });

  it('a clock seen going for 200 ms ends the check, even if the state said running all along', () => {
    const health = new ContextHealth(cfg);
    health.suspectNow();
    // Stands for 1.2 s, then goes at full speed.
    const seen = looks(health, 0, 2000, (t) => (t < 1200 ? 10 : 10 + (t - 1200) / 1000));
    expect(steps(seen)).toEqual(['300 resume', '1000 resume']);
    expect(seen.find((s) => s.verdict.kind === 'alive')?.at).toBe(1400);
    expect(health.isSuspect).toBe(false);
    expect(health.running).toBe(true);
  });

  it('a slow clock (under half speed) does not count as going', () => {
    const health = new ContextHealth(cfg);
    health.suspectNow();
    const seen = looks(health, 0, 3000, (t) => t / 4000);
    expect(steps(seen).at(-1)).toBe('2700 remake');
  });

  it('while the sound is held the check waits, and starts over after', () => {
    const health = new ContextHealth(cfg);
    health.suspectNow();
    expect(steps(looks(health, 0, 400, () => 5))).toEqual(['300 resume']);
    expect(steps(looks(health, 500, 5000, () => 5, true))).toEqual([]);
    expect(steps(looks(health, 5100, 5500, () => 5))).toEqual(['5400 resume']);
  });

  it('after the last step the check gives up; a new suspicion starts it again', () => {
    const health = new ContextHealth(cfg);
    health.suspectNow();
    const seen = looks(health, 0, 3000, () => 1);
    expect(seen.find((x) => x.verdict.kind === 'given-up')?.at).toBe(2800);
    expect(health.isSuspect).toBe(false);
    health.suspectNow();
    expect(steps(looks(health, 3100, 3400, () => 1))).toEqual(['3400 resume']);
  });
});
