import { describe, expect, it } from 'vitest';
import type { PlacedLayer, SimEvent } from '../../core/tower-sim';
import { BALANCE } from '../../data/balance';
import { SessionHints } from '../session-hints';
import { TutorialDirector, type TutorialState } from './tutorial-director';

const plain = (): PlacedLayer => ({ x: 540, width: 700, kind: 'plain', quality: 'normal' });
const honey = (): PlacedLayer => ({
  x: 540,
  width: 700,
  kind: 'creature',
  creature: 'honey',
  level: 1,
  quality: 'normal',
});
const land = (quality: 'perfect' | 'normal'): SimEvent => ({
  type: 'land',
  quality,
  dx: 0,
  cutWidth: 0,
  cutSide: null,
  newWidth: 700,
});
const state = (
  layers: PlacedLayer[],
  wobble = 0,
  phase: TutorialState['phase'] = 'pause',
): TutorialState => ({
  phase,
  layers,
  wobble,
});

function director(tutorialRun = true): { hints: SessionHints; dir: TutorialDirector } {
  const hints = new SessionHints();
  return { hints, dir: new TutorialDirector(hints, tutorialRun) };
}

describe('TutorialDirector: tap hint', () => {
  it('shows only in the tutorial run and until the first drop', () => {
    expect(director(false).dir.tapHintVisible).toBe(false);
    const { dir } = director();
    expect(dir.tapHintVisible).toBe(true);
    dir.observe([], state([], 0, 'flying'));
    expect(dir.tapHintVisible).toBe(true);
    dir.observe([], state([], 0, 'falling'));
    expect(dir.tapHintVisible).toBe(false);
  });

  it('goes away after a landing or a miss even without a noted drop', () => {
    const a = director();
    a.dir.observe([land('normal')], state([plain()]));
    expect(a.dir.tapHintVisible).toBe(false);
    const b = director();
    b.dir.observe([{ type: 'miss', shielded: false }], state([]));
    expect(b.dir.tapHintVisible).toBe(false);
  });
});

describe('TutorialDirector: first perfect', () => {
  it('cues once per session', () => {
    const { dir } = director(false);
    dir.observe([land('normal')], state([plain()]));
    expect(dir.takeCues()).toEqual([]);
    dir.observe([land('perfect')], state([plain(), plain()]));
    expect(dir.takeCues()).toEqual([{ type: 'first_perfect' }]);
    dir.observe([land('perfect')], state([plain(), plain(), plain()]));
    expect(dir.takeCues()).toEqual([]);
  });
});

describe('TutorialDirector: Honey intro', () => {
  const layers = (): PlacedLayer[] => [...Array.from({ length: 5 }, plain), honey()];

  it('holds the sim for the pause and then lets go', () => {
    const { dir } = director();
    dir.observe([land('normal')], state(layers()));
    expect(dir.takeCues()).toEqual([{ type: 'creature_intro', layerIndex: 5 }]);
    expect(dir.holding).toBe(true);
    expect(dir.introLayerIndex).toBe(5);
    dir.tick(BALANCE.tutorial.creaturePauseMs - 1);
    expect(dir.holding).toBe(true);
    dir.tick(1);
    expect(dir.holding).toBe(false);
  });

  it('forgets the arrow target when the hold ends', () => {
    const { dir } = director();
    dir.observe([land('normal')], state(layers()));
    dir.setTarget(10, 20);
    expect(dir.target).toEqual({ x: 10, y: 20, valid: true });
    dir.tick(BALANCE.tutorial.creaturePauseMs);
    expect(dir.target.valid).toBe(false);
  });

  it('happens once, and not outside the tutorial run', () => {
    const { dir } = director();
    dir.observe([land('normal')], state(layers()));
    dir.tick(BALANCE.tutorial.creaturePauseMs);
    dir.takeCues();
    dir.observe([land('normal')], state(layers()));
    expect(dir.holding).toBe(false);
    expect(dir.takeCues()).toEqual([]);

    const other = director(false).dir;
    other.observe([land('normal')], state(layers()));
    expect(other.holding).toBe(false);
  });

  it('does not trigger for another creature or a plain layer', () => {
    const { dir } = director();
    dir.observe([land('normal')], state([plain()]));
    expect(dir.holding).toBe(false);
  });
});

describe('TutorialDirector: wobble hint', () => {
  it('cues the first time the wobble passes the threshold, in any run', () => {
    const { dir } = director(false);
    dir.observe([], state([], BALANCE.tutorial.wobbleHintAt));
    expect(dir.takeCues()).toEqual([]);
    dir.observe([], state([], BALANCE.tutorial.wobbleHintAt + 1));
    expect(dir.takeCues()).toEqual([{ type: 'wobble' }]);
    dir.observe([], state([], 80));
    expect(dir.takeCues()).toEqual([]);
  });

  it('stays quiet in a later run of the session', () => {
    const hints = new SessionHints();
    new TutorialDirector(hints, true).observe([], state([], 50));
    const next = new TutorialDirector(hints, false);
    next.observe([], state([], 60));
    expect(next.takeCues()).toEqual([]);
  });
});
