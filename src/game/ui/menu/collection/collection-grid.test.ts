import { describe, expect, it } from 'vitest';
import { MENU } from '../../../../data/common/menu-layout';
import { collectionGrid } from './collection-grid';

describe('collectionGrid', () => {
  it('fits 12 cards at the smallest screen height', () => {
    const { scale, cells } = collectionGrid(1080, 1920, 12);
    const last = cells[11] ?? { x: 0, y: Infinity };
    expect(cells).toHaveLength(12);
    const bottom = last.y + (MENU.collection.card.height * scale) / 2;
    expect(bottom).toBeLessThanOrEqual(1920);
    expect(scale).toBeGreaterThan(0.8);
  });

  it('shrinks cards when the room is too small', () => {
    expect(collectionGrid(1080, 1200, 12).scale).toBeLessThan(1);
    expect(collectionGrid(600, 1920, 12).scale).toBeLessThan(1);
  });

  it('centres the grid horizontally and vertically in the free space', () => {
    const cells = collectionGrid(1080, 2338, 12).cells;
    const first = cells[0] ?? { x: 0, y: 0 };
    const last = cells[11] ?? { x: 0, y: 0 };
    expect(first.x + (cells[2]?.x ?? 0)).toBeCloseTo(1080);
    const { collection } = MENU;
    const card = collection.card;
    const top = first.y - card.height / 2 - collection.gridTop;
    const bottom = 2338 - collection.bottomMargin - (last.y + card.height / 2);
    expect(top).toBeCloseTo(bottom);
  });

  it('moves down with the top band and keeps the size when the room is as tall', () => {
    const plain = collectionGrid(1080, 2000, 12);
    const banded = collectionGrid(1080, 2150, 12, 150);
    expect(banded.scale).toBeCloseTo(plain.scale);
    expect(banded.cells[0]?.y).toBeCloseTo((plain.cells[0]?.y ?? 0) + 150);
  });

  it('shrinks the cards for a band at the bottom', () => {
    const last = collectionGrid(1080, 1920 - 100, 12).cells[11];
    expect(last?.y).toBeLessThan(collectionGrid(1080, 1920, 12).cells[11]?.y ?? 0);
  });
});
