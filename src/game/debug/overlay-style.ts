/** One look for the buttons of the DOM tools over the canvas (benchmark summary, debug menu). */
export function overlayButtonCss(fontPx: number, minHeightPx: number, fill: string): string {
  return (
    `pointer-events:auto;font:bold ${fontPx}px sans-serif;min-height:${minHeightPx}px;` +
    `padding:0 16px;border:1px solid #fff;border-radius:6px;color:#fff;background:${fill};`
  );
}
