import { describe, expect, it, vi } from 'vitest';
import { logRunStart, runStartParams } from './run-telemetry';
import type { RunSetup } from './run-setup';
import { CLASSIC_RUN } from './run-request';

const logEvent = vi.hoisted(() => vi.fn());
vi.mock('../services', () => ({ services: { telemetry: { logEvent } } }));

function setupOf(over: Partial<RunSetup>): RunSetup {
  return {
    request: CLASSIC_RUN,
    mode: 'classic',
    seed: 1,
    startHeight: 0,
    checkpoint: null,
    paidByAd: false,
    team: [],
    tutorialRun: false,
    hints: true,
    writesSave: true,
    noContinue: false,
    bot: undefined,
    ...over,
  };
}

describe('runStartParams', () => {
  it('joins the team ids, skips empty slots and counts the run from one', () => {
    const setup = setupOf({
      team: [{ id: 'honey', level: 1 }, null, { id: 'ghost', level: 2 }],
      startHeight: 40,
      checkpoint: 40,
    });
    expect(runStartParams(setup, 4)).toEqual({
      mode: 'classic',
      team: 'honey,ghost',
      run_index: 5,
      start_height: 40,
    });
  });

  it('an empty team is an empty string', () => {
    expect(runStartParams(setupOf({ team: [null, null, null], mode: 'daily' }), 0)).toEqual({
      mode: 'daily',
      team: '',
      run_index: 1,
      start_height: 0,
    });
  });
});

describe('logRunStart', () => {
  it('logs a run that reaches the save', () => {
    logEvent.mockClear();
    logRunStart(setupOf({ writesSave: true }), 2);
    expect(logEvent).toHaveBeenCalledWith('run_start', expect.objectContaining({ run_index: 3 }));
  });

  it('logs nothing for a run that does not (a bot, a dev start, a demo)', () => {
    logEvent.mockClear();
    logRunStart(setupOf({ writesSave: false }), 2);
    expect(logEvent).not.toHaveBeenCalled();
  });
});
