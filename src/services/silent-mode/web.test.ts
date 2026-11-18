import { describe, expect, it } from 'vitest';
import { WebSilentMode } from './web';

describe('WebSilentMode', () => {
  it('is never silent and its subscription can be dropped', () => {
    const silent = new WebSilentMode();
    expect(silent.isSilent()).toBe(false);
    const stop = silent.onChange();
    expect(() => stop()).not.toThrow();
  });
});
