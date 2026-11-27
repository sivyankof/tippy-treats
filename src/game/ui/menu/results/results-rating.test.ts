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
  let timers = 0;
  const scene = {
    time: {
      delayedCall: (ms: number, callback: () => void) => {
        delay = ms;
        pending = callback;
        timers += 1;
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
    /** How many timers the screen set. */
    get timers() {
      return timers;
    },
    leave: () => {
      active = false;
    },
  };
}

/** The "x2" ad of the screen, switched by hand. */
function fakeAd() {
  let on = false;
  let closed: (() => void) | null = null;
  return {
    port: {
      showing: () => on,
      onceClosed: (callback: () => void) => {
        closed = callback;
      },
    },
    open: () => {
      on = true;
    },
    close: () => {
      on = false;
      const callback = closed;
      closed = null;
      callback?.();
    },
    get waiting() {
      return closed !== null;
    },
  };
}

const quiet = () => fakeAd().port;

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
    askForRatingOnResults(
      screen.scene,
      { exit: EXIT, daily: false, busy: () => false, ad: quiet() },
      deps,
    );
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
    askForRatingOnResults(
      screen.scene,
      { exit: EXIT, daily: false, busy: () => false, ad: quiet() },
      deps,
    );
    screen.fire();
    expect(calls).toEqual([]);
  });

  it('tells the rules about an interstitial that is due', () => {
    const screen = fakeScene();
    const { deps } = fakeDeps({ interstitialDue: () => true });
    askForRatingOnResults(
      screen.scene,
      { exit: EXIT, daily: false, busy: () => false, ad: quiet() },
      deps,
    );
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
    askForRatingOnResults(
      screen.scene,
      { exit: EXIT, daily: false, busy: () => leaving, ad: quiet() },
      deps,
    );
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
    askForRatingOnResults(
      gone.scene,
      { exit: EXIT, daily: false, busy: () => false, ad: quiet() },
      first.deps,
    );
    gone.leave();
    gone.fire();
    expect(first.deps.canAsk).not.toHaveBeenCalled();

    const unsaved = fakeScene();
    const second = fakeDeps();
    askForRatingOnResults(
      unsaved.scene,
      { exit: { ...EXIT, recorded: false }, daily: false, busy: () => false, ad: quiet() },
      second.deps,
    );
    unsaved.fire();
    expect(second.deps.canAsk).not.toHaveBeenCalled();
  });

  /** The rules as they are on `busy`: no request next to an ad or a way out. */
  const realBusy = () => vi.fn((_version: string, facts: { busy: boolean }) => !facts.busy);

  it('asks once more after the x2 ad closes when the ad was on at the check', () => {
    const ad = fakeAd();
    const screen = fakeScene();
    const { deps, calls } = fakeDeps({ canAsk: realBusy() });
    askForRatingOnResults(
      screen.scene,
      { exit: EXIT, daily: false, busy: () => false, ad: ad.port },
      deps,
    );
    ad.open();
    screen.fire();
    expect(deps.canAsk).toHaveBeenLastCalledWith(
      APP_VERSION,
      expect.objectContaining({ busy: true, newRecord: true }),
    );
    expect(calls).toEqual([]);
    expect(screen.timers).toBe(1);
    ad.close();
    // After the ad, the screen waits as after its animations, then asks the rules again.
    expect(screen.timers).toBe(2);
    expect(screen.delay).toBe(REVIEW.afterAnimationsMs);
    expect(calls).toEqual([]);
    screen.fire();
    expect(deps.canAsk).toHaveBeenCalledTimes(2);
    expect(deps.canAsk).toHaveBeenLastCalledWith(
      APP_VERSION,
      expect.objectContaining({ busy: false, newRecord: true }),
    );
    expect(calls).toEqual(['note', 'request']);
  });

  it('asks again only once, even when the ad is on again at the second check', () => {
    const ad = fakeAd();
    const screen = fakeScene();
    const { deps, calls } = fakeDeps({ canAsk: realBusy() });
    askForRatingOnResults(
      screen.scene,
      { exit: EXIT, daily: false, busy: () => false, ad: ad.port },
      deps,
    );
    ad.open();
    screen.fire();
    ad.close();
    ad.open();
    screen.fire();
    expect(ad.waiting).toBe(false);
    ad.close();
    expect(screen.timers).toBe(2);
    expect(deps.canAsk).toHaveBeenCalledTimes(2);
    expect(calls).toEqual([]);
  });

  it('does not wait for the ad when the first check asked or was stopped by something else', () => {
    const shown = fakeAd();
    const first = fakeScene();
    const asked = fakeDeps();
    askForRatingOnResults(
      first.scene,
      { exit: EXIT, daily: false, busy: () => false, ad: shown.port },
      asked.deps,
    );
    first.fire();
    expect(asked.calls).toEqual(['note', 'request']);
    expect(shown.waiting).toBe(false);

    const leaving = fakeAd();
    const second = fakeScene();
    const left = fakeDeps({ canAsk: realBusy() });
    askForRatingOnResults(
      second.scene,
      { exit: EXIT, daily: false, busy: () => true, ad: leaving.port },
      left.deps,
    );
    second.fire();
    expect(leaving.waiting).toBe(false);
    expect(second.timers).toBe(1);
  });

  it('does not ask after the ad when the screen is gone by then', () => {
    const ad = fakeAd();
    const screen = fakeScene();
    const { deps, calls } = fakeDeps({ canAsk: realBusy() });
    askForRatingOnResults(
      screen.scene,
      { exit: EXIT, daily: false, busy: () => false, ad: ad.port },
      deps,
    );
    ad.open();
    screen.fire();
    ad.close();
    screen.leave();
    screen.fire();
    expect(deps.canAsk).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([]);
  });
});
