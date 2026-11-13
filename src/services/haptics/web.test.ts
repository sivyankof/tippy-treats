import { describe, expect, it, vi } from 'vitest';
import { HAPTICS } from '../../data/haptics';
import type { HapticKind } from './types';
import { WebHaptics } from './web';

const KINDS = Object.keys(HAPTICS.patterns) as HapticKind[];

describe('WebHaptics', () => {
  it.each(KINDS)('sends the %s pattern to vibrate', (kind) => {
    const vibrate = vi.fn(() => true);
    new WebHaptics(vibrate).play(kind);
    expect(vibrate).toHaveBeenCalledWith([...HAPTICS.patterns[kind]]);
  });

  it('the triple pattern is three medium hits separated by the gap', () => {
    const [medium] = HAPTICS.patterns.medium;
    expect(HAPTICS.patterns.triple).toEqual([
      medium,
      HAPTICS.tripleGap,
      medium,
      HAPTICS.tripleGap,
      medium,
    ]);
  });

  it('does nothing when disabled', () => {
    const vibrate = vi.fn(() => true);
    const haptics = new WebHaptics(vibrate);
    haptics.setEnabled(false);
    haptics.play('light');
    expect(haptics.enabled).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('is a no-op without navigator.vibrate', () => {
    const haptics = new WebHaptics();
    expect(() => haptics.play('heavy')).not.toThrow();
  });

  it('swallows errors thrown by vibrate', () => {
    const haptics = new WebHaptics(() => {
      throw new Error('blocked');
    });
    expect(() => haptics.play('medium')).not.toThrow();
  });
});
