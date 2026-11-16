import { afterEach, describe, expect, it } from 'vitest';
import { clearRunHooks, runHooks, setRunHooks, type RunHooks } from './run-hooks';

function hooks(): RunHooks {
  return {
    lick: () => true,
    lickStage: () => null,
    guest: () => true,
    rainbowJoke: () => undefined,
    jokesPlayed: () => 0,
    arcGrown: () => true,
  };
}

describe('run hooks', () => {
  afterEach(() => {
    const left = runHooks();
    if (left) clearRunHooks(left);
  });

  it('are let go of when their run shuts down', () => {
    const mine = hooks();
    setRunHooks(mine);
    expect(runHooks()).toBe(mine);
    clearRunHooks(mine);
    expect(runHooks()).toBeNull();
  });

  it('keep the hooks of a newer run when an older run shuts down late', () => {
    const older = hooks();
    const newer = hooks();
    setRunHooks(older);
    setRunHooks(newer);
    clearRunHooks(older);
    expect(runHooks()).toBe(newer);
  });
});
