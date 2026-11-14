import { MENU } from '../../../data/menu-layout';

const { card, collection } = MENU;

export interface GridCell {
  x: number;
  y: number;
}

export interface GridLayout {
  /** Scale of every card so the whole grid fits the room. */
  scale: number;
  cells: GridCell[];
}

/**
 * Centres a grid of `count` cards (centres of the cells) in the free space below the header.
 * Cards shrink when the grid does not fit the width or the height.
 */
export function collectionGrid(width: number, height: number, count: number): GridLayout {
  const cols = collection.columns;
  const rows = Math.ceil(count / cols);
  const fullW = cols * card.width + (cols - 1) * card.gapX;
  const fullH = rows * card.height + (rows - 1) * card.gapY;
  const roomH = height - collection.gridTop - collection.bottomMargin;
  const scale = Math.min(1, width / fullW, roomH / fullH);
  const stepX = (card.width + card.gapX) * scale;
  const stepY = (card.height + card.gapY) * scale;
  const left = (width - fullW * scale) / 2 + (card.width * scale) / 2;
  const top = collection.gridTop + (roomH - fullH * scale) / 2 + (card.height * scale) / 2;
  const cells: GridCell[] = [];
  for (let i = 0; i < count; i++) {
    cells.push({ x: left + (i % cols) * stepX, y: top + Math.floor(i / cols) * stepY });
  }
  return { scale, cells };
}
