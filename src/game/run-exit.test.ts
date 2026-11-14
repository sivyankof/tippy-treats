import { describe, expect, it } from 'vitest';
import { EMPTY_SUMMARY } from '../state/game-state';
import { exitTarget } from './run-exit';
import { CLASSIC_RUN, DAILY_RUN, demoRun } from './run-request';
import { SCENES } from './scene-keys';

describe('leaving a run', () => {
  it('goes back to the card after a demo', () => {
    expect(exitTarget(demoRun('jelly', 2, 'team'), null)).toEqual({
      key: SCENES.creatureDetail,
      data: { id: 'jelly', back: 'team' },
    });
  });

  it('goes Home after a normal run', () => {
    expect(exitTarget(CLASSIC_RUN, null)).toEqual({ key: SCENES.home });
    expect(exitTarget(CLASSIC_RUN, EMPTY_SUMMARY)).toEqual({ key: SCENES.home });
  });

  it('goes to the Daily screen after a daily run', () => {
    expect(exitTarget(DAILY_RUN, EMPTY_SUMMARY)).toEqual({ key: SCENES.daily });
  });

  it('shows the creatures the level-ups handed out first', () => {
    const summary = {
      ...EMPTY_SUMMARY,
      levelUps: [
        { level: 2, reward: { creature: 'puff' as const }, duplicate: null },
        { level: 3, reward: { thirdTeamSlot: true }, duplicate: null },
      ],
    };
    expect(exitTarget(CLASSIC_RUN, summary)).toEqual({
      key: SCENES.newCreature,
      data: { creatures: ['puff'], then: { kind: 'screen', key: SCENES.home } },
    });
  });
});
