import { describe, expect, it } from 'vitest';
import { DEMO } from '../data/run/demo';
import { nextCreature } from '../core/creatures/team-queue';
import { CLASSIC_RUN, checkpointRun, demoFinished, demoTeam } from './run-request';

describe('creature demo', () => {
  it('brings the creature as the first flying layer', () => {
    const next = nextCreature(DEMO.startHeight, demoTeam('ghost', 2));
    expect(next).toEqual({ id: 'ghost', level: 2, inLayers: 0 });
  });

  it('ends after its drops', () => {
    expect(demoFinished(DEMO.startHeight + DEMO.drops - 1)).toBe(false);
    expect(demoFinished(DEMO.startHeight + DEMO.drops)).toBe(true);
  });
});

describe('checkpointRun', () => {
  it('is a classic request that carries the checkpoint', () => {
    expect(checkpointRun(60)).toEqual({ kind: 'classic', checkpoint: 60 });
    expect(CLASSIC_RUN).toEqual({ kind: 'classic' });
  });

  it('carries the ad payment only when an ad paid', () => {
    expect(checkpointRun(60, true)).toEqual({ kind: 'classic', checkpoint: 60, paidByAd: true });
    expect(checkpointRun(60, false)).toEqual({ kind: 'classic', checkpoint: 60 });
  });
});
