import { describe, expect, it } from 'vitest';
import { backHandlerCount, handleBack, pushBack } from './back-stack';

describe('back stack', () => {
  it('runs the latest handler that acts and reports when none does', () => {
    const seen: string[] = [];
    const screen = pushBack(() => (seen.push('screen'), true));
    const window = pushBack(() => (seen.push('window'), true));
    expect(handleBack()).toBe(true);
    expect(seen).toEqual(['window']);
    window();
    expect(handleBack()).toBe(true);
    expect(seen).toEqual(['window', 'screen']);
    screen();
    expect(handleBack()).toBe(false);
    expect(backHandlerCount()).toBe(0);
  });

  it('skips a handler that does not act and removes each one only once', () => {
    const passive = pushBack(() => false);
    const seen: string[] = [];
    const active = pushBack(() => (seen.push('active'), true));
    const busy = pushBack(() => false);
    expect(handleBack()).toBe(true);
    expect(seen).toEqual(['active']);
    busy();
    busy();
    active();
    passive();
    expect(backHandlerCount()).toBe(0);
  });
});
