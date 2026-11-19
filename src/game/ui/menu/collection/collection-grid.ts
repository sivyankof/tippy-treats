import { MENU } from '../../../../data/common/menu-layout';

const { collection } = MENU;
const card = collection.card;

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
 * Cards shrink when the grid does not fit the width or the height. `height` is the bottom edge
 * of the room (the top of the safe band at the bottom) and `top` is where the room starts (the
 * safe band at the top of the canvas).
 */
export function collectionGrid(width: number, height: number, count: number, top = 0): GridLayout {
  const cols = collection.columns;
  const rows = Math.ceil(count / cols);
  const fullW = cols * card.width + (cols - 1) * card.gapX;
  const fullH = rows * card.height + (rows - 1) * card.gapY;
  const gridTop = top + collection.gridTop;
  const roomH = height - gridTop - collection.bottomMargin;
  const scale = Math.min(1, width / fullW, roomH / fullH);
  const stepX = (card.width + card.gapX) * scale;
  const stepY = (card.height + card.gapY) * scale;
  const left = (width - fullW * scale) / 2 + (card.width * scale) / 2;
  const first = gridTop + (roomH - fullH * scale) / 2 + (card.height * scale) / 2;
  const cells: GridCell[] = [];
  for (let i = 0; i < count; i++) {
    cells.push({ x: left + (i % cols) * stepX, y: first + Math.floor(i / cols) * stepY });
  }
  return { scale, cells };
}
