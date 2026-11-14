import type * as Phaser from 'phaser';
import type { CreatureId } from '../../../data/creatures';
import { gameState } from '../../../state';
import type { RunSummary } from '../../../state/game-state';
import { CLASSIC_RUN, DAILY_RUN } from '../../run-request';
import { goNext, openScreen, SCENES, type NextStep } from '../../scene-keys';
import type { ResultsButtonHandlers, ResultsButtonLabels } from './results-buttons';

/** What the two buttons of the results do and say. */
export interface ResultsFlow {
  handlers: ResultsButtonHandlers;
  labels: ResultsButtonLabels;
}

interface FlowInput {
  scene: Phaser.Scene;
  summary: RunSummary;
  daily: boolean;
  /** Creatures to present before the way on (level rewards, Honey after the tutorial). */
  fresh: readonly CreatureId[];
  /** Slides the screen away, then runs the step. */
  leave: (then: () => void) => void;
}

const HOME: NextStep = { kind: 'screen', key: SCENES.home };
const DAILY_SCREEN: NextStep = { kind: 'screen', key: SCENES.daily };

/** Goes on to `next`, after the presentation of the new creatures when there are any. */
function proceed(scene: Phaser.Scene, fresh: readonly CreatureId[], next: NextStep): void {
  if (fresh.length > 0) {
    openScreen(scene, SCENES.newCreature, { creatures: [...fresh], then: next });
  } else {
    goNext(scene, next);
  }
}

/** The way on from the results of a classic run: the tutorial hands over to Home, else play again or Home. */
function classicFlow(input: FlowInput): ResultsFlow {
  const { scene, summary, fresh, leave } = input;
  return {
    labels: { primary: 'run.playAgain', home: 'results.home' },
    handlers: {
      primary: () =>
        summary.firstRun
          ? leave(() => {
              gameState.markHint('firstResults');
              openScreen(scene, SCENES.newCreature, {
                creatures: [...fresh],
                then: HOME,
                firstHome: true,
              });
            })
          : leave(() => proceed(scene, fresh, { kind: 'run', request: CLASSIC_RUN })),
      home: () => leave(() => proceed(scene, fresh, HOME)),
    },
  };
}

/**
 * The way on from the results of a daily run: with an attempt left, "Play again" spends it and
 * starts the run and the second button returns to the daily tower; without one the primary button
 * returns to the daily tower and the second goes Home.
 */
function dailyFlow(input: FlowInput): ResultsFlow {
  const { scene, fresh, leave } = input;
  const again = gameState.dailyInfo().attemptsLeft > 0;
  const replay = (): NextStep =>
    gameState.startDailyAttempt() ? { kind: 'run', request: DAILY_RUN } : DAILY_SCREEN;
  return again
    ? {
        labels: { primary: 'run.playAgain', home: 'resultsDaily.back' },
        handlers: {
          primary: () => leave(() => proceed(scene, fresh, replay())),
          home: () => leave(() => proceed(scene, fresh, DAILY_SCREEN)),
        },
      }
    : {
        labels: { primary: 'resultsDaily.back', home: 'results.home' },
        handlers: {
          primary: () => leave(() => proceed(scene, fresh, DAILY_SCREEN)),
          home: () => leave(() => proceed(scene, fresh, HOME)),
        },
      };
}

export function resultsFlow(input: FlowInput): ResultsFlow {
  return input.daily ? dailyFlow(input) : classicFlow(input);
}
