import { describe, expect, it } from 'vitest';
import { MASTERY_FRAME } from '../../data/mastery-look';
import { MENU } from '../../data/menu-layout';
import {
  COLLECTION_BODY,
  crownSpot,
  isCollectionBody,
  masteryFramePad,
  outerRimReach,
} from './mastery-frame-geometry';

const WINDOW_BODY = { width: 600, height: 400 };

describe('mastery frame geometry', () => {
  it('knows the collection card from other plates', () => {
    expect(isCollectionBody(COLLECTION_BODY)).toBe(true);
    expect(isCollectionBody(WINDOW_BODY)).toBe(false);
  });

  it('keeps every crown fully inside the baked picture', () => {
    const pad = masteryFramePad();
    for (const body of [COLLECTION_BODY, WINDOW_BODY]) {
      const { cx, cy, r } = crownSpot(body);
      expect(pad + cy - r - MASTERY_FRAME.crown.outline).toBeGreaterThanOrEqual(0);
      expect(pad + cx - r).toBeGreaterThanOrEqual(0);
    }
  });

  it('fits the card frame into the collection grid gap', () => {
    const { gapX, gapY } = MENU.collection.card;
    expect(outerRimReach()).toBeLessThanOrEqual(Math.min(gapX, gapY) / 2);
    const { cy, r } = crownSpot(COLLECTION_BODY);
    // The crown top stays below the card above.
    expect(r - cy + MASTERY_FRAME.crown.outline).toBeLessThanOrEqual(gapY);
  });
});
