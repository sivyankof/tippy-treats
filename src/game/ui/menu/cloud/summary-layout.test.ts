import { describe, expect, it } from 'vitest';
import { CLOUD_WINDOW } from '../../../../data/common/cloud-window-layout';
import { summaryCardHeight } from './summary-layout';

describe('summaryCardHeight', () => {
  it('adds the head line and its gap', () => {
    const { lineHeight, headGap } = CLOUD_WINDOW.card;
    expect(summaryCardHeight(true) - summaryCardHeight(false)).toBe(lineHeight + headGap);
  });
});
