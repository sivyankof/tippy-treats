import { describe, expect, it } from 'vitest';
import { DEMO } from '../data/demo';
import { nextCreature } from '../core/team-queue';
import { demoFinished, demoTeam } from './run-request';

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
