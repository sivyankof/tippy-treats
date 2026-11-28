/** The boot screen of index.html (src/util/boot/boot-screen.ts, docs/07-ui-screens.md, section 1). */
export const BOOT_SCREEN = {
  /** Device storage of the launch count and the copied settings (localStorage, apart from the save). */
  storageKey: 'tippy.boot',
  /**
   * The screen stays at least this long after its first paint: the title has hopped in by then, so
   * a quick phone does not only flash it.
   */
  minShowMs: 700,
  /** The dissolve once the first frame of a screen of the game is drawn. */
  fadeOutMs: 300,
  /** The title waits this long at most for the Nunito files, then hops in with the fallback font. */
  fontWaitMs: 1000,
  /** The launch splash of the app fades out this long once the boot screen is painted. */
  splashFadeMs: 250,
} as const;
