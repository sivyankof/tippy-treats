import { describe, expect, it } from 'vitest';
import { HoldCount } from './hold-count';

describe('HoldCount', () => {
  it('turns on with the first holder and off with the last', () => {
    const calls: boolean[] = [];
    const count = new HoldCount((on) => calls.push(on));
    const a = count.hold();
    const b = count.hold();
    expect(calls).toEqual([true]);
    a();
    expect(count.held).toBe(true);
    expect(calls).toEqual([true]);
    b();
    expect(count.held).toBe(false);
    expect(calls).toEqual([true, false]);
  });

  it('ignores a second release of the same hold', () => {
    const calls: boolean[] = [];
    const count = new HoldCount((on) => calls.push(on));
    const a = count.hold();
    const b = count.hold();
    a();
    a();
    expect(count.held).toBe(true);
    b();
    expect(calls).toEqual([true, false]);
  });
});
