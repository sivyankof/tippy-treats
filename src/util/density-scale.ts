/** Size of the canvas backing store for a render density cap. */
export interface BackingSize {
  width: number;
  height: number;
}

/**
 * The canvas backing store that draws a logical screen at no more than `cap` canvas pixels per CSS
 * pixel (and never above the device's own density, nor above the logical size itself). The logical
 * size is what every scene lays out in; only the number of pixels the video chip fills changes.
 */
export function cappedBackingSize(
  logical: BackingSize,
  cssWidth: number,
  devicePixelRatio: number,
  cap: number,
): BackingSize {
  if (!(cssWidth > 0) || !(logical.width > 0) || !(cap > 0)) return { ...logical };
  const density = Math.min(devicePixelRatio > 0 ? devicePixelRatio : 1, cap);
  const scale = Math.min(1, (cssWidth * density) / logical.width);
  return {
    width: Math.max(1, Math.round(logical.width * scale)),
    height: Math.max(1, Math.round(logical.height * scale)),
  };
}
