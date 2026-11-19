import { describe, expect, it } from 'vitest';
import { checkpointRows, type CheckpointHeight } from '../../../core/zones/checkpoints';
import {
  adGreyAfter,
  resultsStartPlan,
  startedLine,
  type ResultsStartInput,
} from './results-start-model';

function input(over: Partial<ResultsStartInput> & { berries?: number; adReady?: boolean }) {
  const { berries, adReady, ...rest } = over;
  const opened = over.opened ?? [20, 40];
  const rows = checkpointRows({
    opened,
    berries: berries ?? 50,
    adReady: adReady ?? true,
    adsLeft: 5,
  });
  const base: ResultsStartInput = {
    daily: false,
    firstRun: false,
    recorded: true,
    checkpoint: null,
    opened,
    rows,
  };
  return { ...base, ...rest };
}

describe('resultsStartPlan', () => {
  it('offers the window after a zero start when a checkpoint is open', () => {
    expect(resultsStartPlan(input({}))).toEqual({ kind: 'choose' });
  });

  it('offers nothing with no checkpoint open', () => {
    expect(resultsStartPlan(input({ opened: [] }))).toEqual({ kind: 'none' });
  });

  it('offers nothing after the tutorial, a daily run or a run that was not saved', () => {
    expect(resultsStartPlan(input({ firstRun: true }))).toEqual({ kind: 'none' });
    expect(resultsStartPlan(input({ daily: true }))).toEqual({ kind: 'none' });
    expect(resultsStartPlan(input({ recorded: false }))).toEqual({ kind: 'none' });
  });

  it('offers the same start again after a checkpoint run, with price and ad', () => {
    const plan = resultsStartPlan(input({ checkpoint: 40 }));
    expect(plan).toMatchObject({ kind: 'again', height: 40, ad: 'ready' });
    expect(plan.kind === 'again' && plan.main.price).toBe(10);
    expect(plan.kind === 'again' && plan.main.missing).toBe(0);
  });

  it('shows what is missing and an unavailable ad', () => {
    const plan = resultsStartPlan(input({ checkpoint: 40, berries: 4, adReady: false }));
    expect(plan).toMatchObject({ kind: 'again', ad: 'unavailable' });
    expect(plan.kind === 'again' && plan.main.missing).toBe(6);
  });

  it('asks for the caption when the ad starts are used up', () => {
    const base = input({ checkpoint: 40 });
    const rows = checkpointRows({ opened: [20, 40], berries: 50, adReady: true, adsLeft: 0 });
    expect(resultsStartPlan({ ...base, rows })).toMatchObject({
      kind: 'again',
      ad: 'hidden',
      adSpent: true,
    });
  });

  it('has no ad button for a high checkpoint', () => {
    const opened: CheckpointHeight[] = [20, 40, 60, 80];
    expect(resultsStartPlan(input({ checkpoint: 80, opened }))).toMatchObject({
      kind: 'again',
      ad: 'hidden',
    });
  });
});

describe('adGreyAfter', () => {
  it('greys the button when no ad is ready or the ad start is not allowed', () => {
    expect(adGreyAfter('unavailable', false)).toBe(true);
    expect(adGreyAfter('refused', false)).toBe(true);
  });

  it('a tap that met another payment leaves the look as it was', () => {
    expect(adGreyAfter('busy', false)).toBe(false);
    expect(adGreyAfter('busy', true)).toBe(true);
  });

  it('lights a grey button up once a tap got through to the ad', () => {
    expect(adGreyAfter('dismissed', true)).toBe(false);
    expect(adGreyAfter('short', true)).toBe(false);
    expect(adGreyAfter('paid', true)).toBe(false);
  });
});

describe('startedLine', () => {
  it('counts the placed layers above the start', () => {
    expect(startedLine(40, 52)).toEqual({ start: 40, placed: 12 });
    expect(startedLine(40, 40)).toEqual({ start: 40, placed: 0 });
    expect(startedLine(40, 12)).toEqual({ start: 40, placed: 0 });
  });
});
