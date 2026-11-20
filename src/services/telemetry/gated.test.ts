import { describe, expect, it, vi } from 'vitest';
import { GatedAnalytics } from './gated';
import type { AnalyticsService } from './types';

function setup(pendingMax = 3) {
  const inner: AnalyticsService = { logEvent: vi.fn(), setUserProperty: vi.fn() };
  const setCollection = vi.fn(() => Promise.resolve());
  return { inner, setCollection, gate: new GatedAnalytics(inner, setCollection, pendingMax) };
}

describe('GatedAnalytics', () => {
  it('holds events until the decision, then sends them when it is on', () => {
    const { inner, setCollection, gate } = setup();
    gate.setUserProperty('payer', '0');
    gate.logEvent('run_start', { mode: 'classic' });
    expect(inner.logEvent).not.toHaveBeenCalled();
    gate.decide('on');
    expect(setCollection).toHaveBeenCalledWith(true);
    expect(inner.setUserProperty).toHaveBeenCalledWith('payer', '0');
    expect(inner.logEvent).toHaveBeenCalledWith('run_start', { mode: 'classic' });
    gate.logEvent('run_end');
    expect(inner.logEvent).toHaveBeenLastCalledWith('run_end', undefined);
  });

  it('drops what waited and sends nothing when it is off', () => {
    const { inner, setCollection, gate } = setup();
    gate.logEvent('run_start');
    gate.decide('off');
    gate.logEvent('run_end');
    gate.setUserProperty('payer', '1');
    expect(setCollection).toHaveBeenCalledWith(false);
    expect(inner.logEvent).not.toHaveBeenCalled();
    expect(inner.setUserProperty).not.toHaveBeenCalled();
  });

  it('keeps only the newest events while waiting', () => {
    const { inner, gate } = setup(2);
    for (const name of ['a', 'b', 'c']) gate.logEvent(name);
    gate.decide('on');
    expect(vi.mocked(inner.logEvent).mock.calls.map(([name]) => name)).toEqual(['b', 'c']);
  });

  it('follows a changed answer either way and ignores unknown', () => {
    const { inner, setCollection, gate } = setup();
    gate.decide('on');
    gate.decide('unknown');
    expect(gate.decision).toBe('on');
    gate.decide('off');
    gate.logEvent('x');
    gate.decide('on');
    gate.logEvent('y');
    expect(setCollection.mock.calls).toEqual([[true], [false], [true]]);
    expect(vi.mocked(inner.logEvent).mock.calls.map(([name]) => name)).toEqual(['y']);
  });

  it('survives a failing switch of the plugin', () => {
    const inner: AnalyticsService = { logEvent: vi.fn(), setUserProperty: vi.fn() };
    const gate = new GatedAnalytics(inner, () => Promise.reject(new Error('blocked')));
    expect(() => gate.decide('on')).not.toThrow();
  });
});
