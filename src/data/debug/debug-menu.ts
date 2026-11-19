/** The debug menu of the internal build (opened by taps on the version line of the settings window). */
export const DEBUG_MENU = {
  /** Taps on the version line that open the menu, and the time they all have to fall into. */
  openTaps: 5,
  openWindowMs: 2000,
  zIndex: 100000,
  /** Height of every button, CSS px (a finger on a phone). */
  buttonPx: 48,
  fontPx: 16,
  titleFontPx: 20,
  infoFontPx: 12,
  paddingPx: 16,
  gapPx: 8,
  maxWidthPx: 480,
  background: '#140c08',
  color: '#ffffff',
  buttonFill: 'rgba(255,255,255,0.18)',
  pickedFill: '#2f9e44',
  startFill: '#ff8a4c',
  /** The weather and the place a run is left to roll by itself when none is chosen. */
  autoLabel: 'auto',
} as const;
