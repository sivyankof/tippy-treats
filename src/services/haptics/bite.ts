import { HAPTICS } from '../../data/haptics';

/** True when the cut-off part is wide enough for a heavy impact. */
export function isBigBite(cutWidth: number, layerWidth: number): boolean {
  return layerWidth > 0 && cutWidth / layerWidth > HAPTICS.bigBiteShare;
}
