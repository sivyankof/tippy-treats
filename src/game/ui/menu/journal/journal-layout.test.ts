import { describe, expect, it } from 'vitest';
import { MENU } from '../../../../data/common/menu-layout';
import { JOURNAL_ROW_IDS } from '../../../../data/progression/journal';
import { stackColumn } from './journal-layout';

describe('stackColumn', () => {
  it('puts items one under another at one gap', () => {
    expect(stackColumn([100, 50, 20], 10)).toEqual({ tops: [0, 110, 170], height: 190 });
  });

  it('is empty for no items', () => {
    expect(stackColumn([], 10)).toEqual({ tops: [], height: 0 });
  });

  it('grows by one step when an item is appended and moves nothing above it', () => {
    const { barHeight, rowHeight, gap } = MENU.journal;
    const heights = [barHeight, ...JOURNAL_ROW_IDS.map(() => rowHeight)];
    const before = stackColumn(heights, gap);
    const after = stackColumn([...heights, rowHeight], gap);
    expect(after.tops.slice(0, heights.length)).toEqual(before.tops);
    expect(after.height).toBe(before.height + rowHeight + gap);
  });

  it('keeps every journal row at least 88 px high', () => {
    expect(MENU.journal.rowHeight).toBeGreaterThanOrEqual(88);
  });
});
