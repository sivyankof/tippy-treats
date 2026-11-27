import { MENU } from '../../../data/common/menu-layout';

/**
 * Room a `PopupWindow` keeps for its ribbon title, which stands half above the window: under an
 * island (`frameTop` > 0) the window moves down by half the ribbon, elsewhere it stays centred and
 * keeps the same room below too.
 */
export function popupReserve(frameTop: number): number {
  const ribbonHalf = MENU.style.ribbon.height / 2;
  return frameTop > 0 ? ribbonHalf : ribbonHalf * 2;
}

/** Height a window body may take on a safe frame `frameHeight` tall without being shrunk. */
export function popupRoom(frameHeight: number, frameTop: number): number {
  return frameHeight - MENU.popup.screenMargin * 2 - popupReserve(frameTop);
}
