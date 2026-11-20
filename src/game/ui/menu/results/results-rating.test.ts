import type * as Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { APP_VERSION } from '../../../../data/app/app-info';
import { REVIEW } from '../../../../data/app/review';
import type { RunExit } from '../../../economy/interstitial-flow';
import { askForRatingOnResults, type RatingDeps } from './results-rating';

// The real flow pulls in the scenes (Phaser needs a window); only its type is used here.
vi.mock('../../../economy/interstitial-flow', () => ({ interstitialDue: () => false }));

const EXIT: RunExit = {
  runMs: 60_000,
  recorded: true,
  newRecord: true,
  levelUp: false,
  newCreature: false,
};

/** A scene whose timer can be run by hand. */
function fakeScene() {
  let pending: (() => void) | null = null;
  let delay = -1;
  let active = true;
  const scene = {
    time: {
      delayedCall: (ms: number, callback: () => void) => {
        delay = ms;
        pending = callback;
      },
    },
    scene: { isActive: () => active },
  } as unknown as Phaser.Scene;
  return {
    scene,
    fire: () => pending?.(),
    get delay() {
      return delay;
    },
    leave: () => {
      active = false;
    },
  };
}

function fakeDeps(over: Partial<RatingDeps> = {}) {
  const calls: string[] = [];
  const deps: RatingDeps = {
    canAsk: vi.fn(() => true),
    noteAsked: () => calls.push('note'),
    request: () => calls.push('request'),
    interstitialDue: () => false,
    windowCount: () => 1,
    ...over,
  };
  return { deps, calls };
}

describe('askForRatingOnResults', () => {
  it('waits after the animations, then notes the request and asks the system, in that order', () => {
    const screen = fakeScene();
    const { deps, calls } = fakeDeps();
    askForRatingOnResults(screen.scene, { exit: EXIT, daily: false, busy: () => false }, deps);
    expect(screen.delay).toBe(REVIEW.afterAnimationsMs);
    expect(calls).toEqual([]);
    screen.fire();
    expect(calls).toEqual(['note', 'request']);
    expect(deps.canAsk).toHaveBeenCalledWith(APP_VERSION, {
      daily: false,
      newRecord: true,
      newCreature: false,
      interstitialDue: false,
      busy: false,
    });
  });

  it('does nothing when the rules say no', () => {
    const screen = fakeScene();
    const { deps, calls } = fakeDeps({ canAsk: () => false });
    askForRatingOnResults(screen.scene, { exit: EXIT, daily: false, busy: () => false }, deps);
    screen.fire();
    expect(calls).toEqual([]);
  });

  it('tells the rules about an interstitial that is due', () => {
    const screen = fakeScene();
    const { deps } = fakeDeps({ interstitialDue: () => true });
    askForRatingOnResults(screen.scene, { exit: EXIT, daily: false, busy: () => false }, deps);
    screen.fire();
    expect(deps.canAsk).toHaveBeenCalledWith(
      APP_VERSION,
      expect.objectContaining({ interstitialDue: true }),
    );
  });

  it('is busy while the player leaves, or a window opened after the screen finished', () => {
    let leaving = false;
    let windows = 1;
    const screen = fakeScene();
    const { deps } = fakeDeps({ windowCount: () => windows });
    askForRatingOnResults(screen.scene, { exit: EXIT, daily: false, busy: () => leaving }, deps);
    leaving = true;
    screen.fire();
    expect(deps.canAsk).toHaveBeenLastCalledWith(
      APP_VERSION,
      expect.objectContaining({ busy: true }),
    );
    leaving = false;
    windows = 2;
    screen.fire();
    expect(deps.canAsk).toHaveBeenLastCalledWith(
      APP_VERSION,
      expect.objectContaining({ busy: true }),
    );
  });

  it('does not ask after the screen is gone or for a run that was not saved', () => {
    const gone = fakeScene();
    const first = fakeDeps();
    askForRatingOnResults(gone.scene, { exit: EXIT, daily: false, busy: () => false }, first.deps);
    gone.leave();
    gone.fire();
    expect(first.deps.canAsk).not.toHaveBeenCalled();

    const unsaved = fakeScene();
    const second = fakeDeps();
    askForRatingOnResults(
      unsaved.scene,
      { exit: { ...EXIT, recorded: false }, daily: false, busy: () => false },
      second.deps,
    );
    unsaved.fire();
    expect(second.deps.canAsk).not.toHaveBeenCalled();
  });
});
