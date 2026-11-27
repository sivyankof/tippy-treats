import { BALANCE } from '../../../../data/tower/balance';
import { CLIMB_MAP } from '../../../../data/progression/climb-map';
import { MENU } from '../../../../data/common/menu-layout';

/** Pixels of one layer on the ribbon. */
export const LAYER_PX = CLIMB_MAP.bandHeight / BALANCE.zones.length;

/** The strip y (0 at its top) of the top of layer `layers` on a strip of `totalLayers` layers. */
export function heightToY(layers: number, totalLayers: number): number {
  return (totalLayers - layers) * LAYER_PX;
}

/** A vertical span on the strip, `top` < `bottom`. */
export interface Span {
  top: number;
  bottom: number;
}

/** The part of the span inside the view, or null when none of it is. */
export function visibleSlice(span: Span, view: Span): Span | null {
  const top = Math.max(span.top, view.top);
  const bottom = Math.min(span.bottom, view.bottom);
  return bottom > top ? { top, bottom } : null;
}

/**
 * How visible an object is next to an edge of the view: 1 when it is `fade` pixels inside, 0 when
 * it touches or crosses an edge, in between along the way.
 */
export function edgeAlpha(span: Span, view: Span, fade: number): number {
  const room = Math.min(span.top - view.top, view.bottom - span.bottom);
  return Math.min(1, Math.max(0, room / fade));
}

/**
 * Keeps marks `gap` apart: `ys` are the strip y of the marks from the bottom up (so falling), a mark
 * too near the one under it moves up, and so do the ones above it.
 */
export function spreadMarks(ys: readonly number[], gap: number): number[] {
  const out: number[] = [];
  for (const y of ys) {
    const below = out[out.length - 1];
    out.push(below === undefined ? y : Math.min(y, below - gap));
  }
  return out;
}

/** The scroll offset (strip y of the top of the view) that puts strip y `y` in the middle of the view. */
export function offsetForCentre(y: number, viewHeight: number, stripHeight: number): number {
  return Math.min(Math.max(0, y - viewHeight / 2), Math.max(0, stripHeight - viewHeight));
}

/** How many layers of a band (`from`..`to`) a tower `towerTop` layers tall fills, 0..band size. */
export function layersInBand(band: { from: number; to: number }, towerTop: number): number {
  return Math.min(band.to - band.from + 1, Math.max(0, towerTop - (band.from - 1)));
}

/**
 * Height of the content of the window so that the window fills the safe frame of a canvas
 * (`frameHeight` tall, `frameTop` from the top): the room `PopupWindow` leaves minus its ribbon
 * title and paddings, so the window is not shrunk.
 */
export function windowContentHeight(frameHeight: number, frameTop: number): number {
  const popup = MENU.popup;
  const ribbonHalf = MENU.style.ribbon.height / 2;
  const reserve = frameTop > 0 ? ribbonHalf : ribbonHalf * 2;
  const room = frameHeight - popup.screenMargin * 2 - reserve;
  return Math.max(popup.minContentHeight, Math.floor(room - popup.titleSpace - popup.padBottom));
}

/** Height of the ribbon: the content minus the goal row; a row appended under the goal takes its height from the ribbon. */
export function ribbonHeight(contentHeight: number, extraRows: readonly number[] = []): number {
  const goal = CLIMB_MAP.goal;
  const below = [goal.height, ...extraRows].reduce((sum, h) => sum + h + goal.gap, 0);
  return Math.max(0, contentHeight - below);
}
