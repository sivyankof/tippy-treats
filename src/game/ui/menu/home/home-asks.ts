import type * as Phaser from 'phaser';
import { notifAsk } from './notif-ask';

/**
 * A one-time question the game asks on entering Home after some finished runs (stage M8): the
 * consent flow after the first run (UMP, the tracking explainer and ATT), the notification
 * permission after the third (docs/09-services-analytics.md, sections 4 and 8). At most one is
 * asked per entry, before the windows of the day (streak, oven, "No ads" offer), so windows never
 * stack.
 */
export interface HomeAsk {
  /** For logs and tests. */
  readonly name: string;
  /** True when it is time to ask (read on each Home entry). */
  due(): boolean;
  /** Asks; `done` is called once when the whole question is over, whatever the answer. */
  run(scene: Phaser.Scene, done: () => void): void;
}

/** The questions in the order they are asked. */
export const HOME_ASKS: readonly HomeAsk[] = [notifAsk];

/** Runs the first due question, then `then`; with nothing due, `then` runs at once. */
export function runHomeAsks(
  scene: Phaser.Scene,
  then: () => void,
  asks: readonly HomeAsk[] = HOME_ASKS,
): void {
  const ask = asks.find((candidate) => candidate.due());
  if (ask === undefined) {
    then();
    return;
  }
  let finished = false;
  ask.run(scene, () => {
    if (finished) return;
    finished = true;
    then();
  });
}
