/** The art sheet debug page (`?artsheet=1`, docs/08 section 9): one grid of every picture. */
export const ART_SHEET = {
  columns: 5,
  /** Cell box a picture is fitted into, and the gap between cells. */
  cellWidth: 200,
  cellHeight: 190,
  gap: 8,
  margin: 16,
  /** Pictures are never blown up beyond this factor (tiny sparks stay readable). */
  maxScale: 2,
  /** Height reserved under the picture for the caption. */
  captionHeight: 44,
  captionFont: '15px monospace',
  captionColor: '#3b2a4a',
  background: 0x9a8cb4,
  cellColor: 0xcdbfe0,
  /** Size a picture with no texture (a drawn container) is built at. */
  liveSize: 120,
  /** The creature layers of both looks are drawn this wide, scaled to this size across. */
  grownLayerWidth: 340,
  grownPictureSize: 190,
  /** Width of the layer the sleeping silhouettes are primed at. */
  sleepLayerWidth: 420,
} as const;

/** Keys that start with one of these are not pictures: Phaser internals and per-run caches. */
export const ART_SHEET_SKIP_PREFIXES: readonly string[] = ['__', 'layer_'];

/** Keys that are not pictures and have no common prefix. */
export const ART_SHEET_SKIP_KEYS: readonly string[] = [];

/** True when the texture is a picture of the game and belongs on the sheet. */
export function isSheetPicture(key: string): boolean {
  if (ART_SHEET_SKIP_KEYS.includes(key)) return false;
  return !ART_SHEET_SKIP_PREFIXES.some((prefix) => key.startsWith(prefix));
}
