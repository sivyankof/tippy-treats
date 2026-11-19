import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkpointStartWidth } from '../../core/zones/checkpoints';
import { DEMO } from '../../data/run/demo';
import { createTestState } from '../../state/test-state';
import { checkpointRun, CLASSIC_RUN, DAILY_RUN, demoRun } from './run-request';
import { setupRun } from './run-setup';

const h = vi.hoisted(() => ({ state: null as unknown }));
vi.mock('../../state', () => ({
  get gameState() {
    return h.state;
  },
}));

/** `?start=` style query of the fake page; '' for a normal launch. */
function openPage(search: string): void {
  vi.stubGlobal('window', { location: { search } });
}

describe('setupRun', () => {
  beforeEach(() => {
    openPage('');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** A player who finished the tutorial run, so the next run is a normal one. */
  function playedState() {
    const state = createTestState();
    state.markHint('tutorial');
    h.state = state;
    return state;
  }

  it('a classic run with a checkpoint starts at its height and width', () => {
    playedState();
    const setup = setupRun(checkpointRun(40));
    expect(setup.checkpoint).toBe(40);
    expect(setup.startHeight).toBe(40);
    expect(setup.startWidth).toBe(checkpointStartWidth(40));
    expect(setup.mode).toBe('classic');
    expect(setup.writesSave).toBe(true);
    expect(setup.tutorialRun).toBe(false);
  });

  it('exposes the ad payment only for a run that really starts at the checkpoint', () => {
    playedState();
    expect(setupRun(checkpointRun(40, true)).paidByAd).toBe(true);
    expect(setupRun(checkpointRun(40)).paidByAd).toBe(false);
    expect(setupRun(CLASSIC_RUN).paidByAd).toBe(false);
    h.state = createTestState(); // the tutorial run: the checkpoint is dropped, so is the payment
    expect(setupRun(checkpointRun(40, true)).paidByAd).toBe(false);
  });

  it('a classic run without a checkpoint starts from zero', () => {
    playedState();
    for (const request of [CLASSIC_RUN, { kind: 'classic' as const }]) {
      const setup = setupRun(request);
      expect(setup.checkpoint).toBeNull();
      expect(setup.startHeight).toBe(0);
      expect(setup.startWidth).toBeUndefined();
    }
  });

  it('the tutorial run never starts from a checkpoint', () => {
    h.state = createTestState();
    const setup = setupRun(checkpointRun(60));
    expect(setup.tutorialRun).toBe(true);
    expect(setup.checkpoint).toBeNull();
    expect(setup.startHeight).toBe(0);
    expect(setup.startWidth).toBeUndefined();
  });

  it('the daily tower starts from zero, a checkpoint on the request included', () => {
    playedState();
    const sneaky = { kind: 'daily', checkpoint: 60 } as unknown as typeof DAILY_RUN;
    for (const request of [DAILY_RUN, sneaky]) {
      const setup = setupRun(request);
      expect(setup.mode).toBe('daily');
      expect(setup.checkpoint).toBeNull();
      expect(setup.startHeight).toBe(0);
      expect(setup.startWidth).toBeUndefined();
    }
  });

  it('a demo has no checkpoint and keeps its own start', () => {
    playedState();
    const setup = setupRun(demoRun('honey', 1, 'collection'));
    expect(setup.checkpoint).toBeNull();
    expect(setup.startHeight).toBe(DEMO.startHeight);
    expect(setup.writesSave).toBe(false);
  });

  it('a debug ?start= is no checkpoint and stays unrecorded', () => {
    playedState();
    openPage('?start=40');
    const setup = setupRun(CLASSIC_RUN);
    expect(setup.checkpoint).toBeNull();
    expect(setup.startHeight).toBe(40);
    expect(setup.startWidth).toBe(checkpointStartWidth(40));
    expect(setup.writesSave).toBe(false);
  });
});
