import type * as Phaser from 'phaser';
import { consentAsk } from '../consent/consent-ask';
import { notifAsk } from './notif-ask';
import { cloudAsk } from '../../../cloud/cloud-ask';

/**
 * A question the game asks on entering Home: the cloud save decision first (docs/07-ui-screens.md,
 * section 2.4), then the one-time questions after some finished runs (stage M8): the consent flow
 * after the first run (UMP, the tracking explainer and ATT), the notification permission after
 * the third (docs/09-services-analytics.md, sections 4 and 8). At most one is asked per entry,
 * and an entry that showed one has no window of the day (`day-window.ts`), so windows never stack.
 */
export interface HomeAsk {
  /** For logs and tests. */
  readonly name: string;
  /** True when it is time to ask (read on each Home entry). */
  due(): boolean;
  /**
   * Asks; `done` is called once when the whole question is over, whatever the answer. `shown` is
   * true when the question put a window in front of the player (then no other question follows).
   */
  run(scene: Phaser.Scene, done: (shown: boolean) => void): void;
}

/** The questions in the order they are asked. */
export const HOME_ASKS: readonly HomeAsk[] = [cloudAsk, consentAsk, notifAsk];

/**
 * Runs the due questions in order until one shows a window, then `then(true)`; a question that showed
 * nothing (the silent consent refresh) does not use up the slot. With nothing shown, `then(false)`.
 */
export function runHomeAsks(
  scene: Phaser.Scene,
  then: (shown: boolean) => void,
  asks: readonly HomeAsk[] = HOME_ASKS,
): void {
  const ask = asks.find((candidate) => candidate.due());
  if (ask === undefined) {
    then(false);
    return;
  }
  const rest = asks.slice(asks.indexOf(ask) + 1);
  let finished = false;
  ask.run(scene, (shown) => {
    if (finished) return;
    finished = true;
    if (shown) then(true);
    else runHomeAsks(scene, then, rest);
  });
}
