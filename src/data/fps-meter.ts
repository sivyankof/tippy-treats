/** The small frame counter of `?fps=1` (it works in the dev server and in production builds): the frame rate and the average work time. */
export const FPS_METER = {
  refreshMs: 500,
  /** Gap under the pause button, in CSS pixels. */
  insetPx: 4,
  fontPx: 11,
  zIndex: 99998,
  color: '#ffffff',
  shadow: '0 0 2px #000, 0 0 2px #000',
  fpsDecimals: 0,
  workDecimals: 1,
} as const;
