import { describe, expect, it, vi } from 'vitest';
import { ImpactStyle, NotificationType } from '@capacitor/haptics';
import { HAPTICS } from '../../data/app/haptics';
import { type HapticsPlugin, NativeHaptics } from './native';
import type { HapticKind } from './types';

function fakePlugin(): HapticsPlugin & { calls: string[] } {
  const calls: string[] = [];
  const done = (name: string) => () => {
    calls.push(name);
    return Promise.resolve();
  };
  return {
    calls,
    impact: ({ style }) => done(`impact:${style}`)(),
    notification: ({ type }) => done(`notification:${type}`)(),
    selectionStart: done('selectionStart'),
    selectionChanged: done('selectionChanged'),
    selectionEnd: done('selectionEnd'),
  };
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('NativeHaptics', () => {
  it.each<[HapticKind, string]>([
    ['light', `impact:${ImpactStyle.Light}`],
    ['medium', `impact:${ImpactStyle.Medium}`],
    ['heavy', `impact:${ImpactStyle.Heavy}`],
    ['success', `notification:${NotificationType.Success}`],
    ['error', `notification:${NotificationType.Error}`],
  ])('plays %s as %s (docs/06, section 8)', (kind, call) => {
    const plugin = fakePlugin();
    new NativeHaptics(plugin).play(kind);
    expect(plugin.calls).toEqual([call]);
  });

  it('ticks a selection between its start and end', async () => {
    const plugin = fakePlugin();
    new NativeHaptics(plugin).play('selection');
    await flush();
    expect(plugin.calls).toEqual(['selectionStart', 'selectionChanged', 'selectionEnd']);
  });

  it('plays the record series as three medium hits the gap apart', () => {
    const plugin = fakePlugin();
    const delays: number[] = [];
    const haptics = new NativeHaptics(plugin, (run, delayMs) => {
      delays.push(delayMs);
      run();
    });
    haptics.play('triple');
    expect(delays).toEqual([0, HAPTICS.tripleGap, 2 * HAPTICS.tripleGap]);
    expect(plugin.calls).toEqual(Array(3).fill(`impact:${ImpactStyle.Medium}`));
  });

  it('does nothing when disabled, also for the hits of a series still to come', () => {
    const plugin = fakePlugin();
    const later: Array<() => void> = [];
    const haptics = new NativeHaptics(plugin, (run) => later.push(run));
    haptics.setEnabled(false);
    haptics.play('light');
    expect(plugin.calls).toEqual([]);
    haptics.setEnabled(true);
    haptics.play('triple');
    haptics.setEnabled(false);
    later.forEach((run) => run());
    expect(plugin.calls).toEqual([]);
  });

  it('swallows failures of the plugin', async () => {
    const plugin = fakePlugin();
    plugin.impact = vi.fn(() => Promise.reject(new Error('no engine')));
    expect(() => new NativeHaptics(plugin).play('heavy')).not.toThrow();
    await flush();
  });
});
