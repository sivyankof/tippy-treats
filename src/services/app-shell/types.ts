/**
 * The app around the game: what the native shell tells the game and what it does for it. In the
 * browser there is no shell: the page visibility covers going to the background, and the browser
 * owns its back button.
 */

/** Colour of the status bar icons: `light` over a dark top of the screen, `dark` over a light one. */
export type BarIcons = 'light' | 'dark';

export interface AppShellService {
  /** True inside the iOS or Android app. */
  readonly native: boolean;
  /** Calls back with `false` when the app stops being active (background, a call, the control centre) and `true` when it is back. Returns the function that stops it. */
  onActiveChange(callback: (active: boolean) => void): () => void;
  /** The hardware or gesture back of Android. While anyone listens, the system does not close the app itself. Returns the function that stops it. */
  onBack(callback: () => void): () => void;
  /** Sends the app to the background, as the home button would (Android). */
  minimize(): void;
  /** The game shows its first screen: the launch splash goes away. */
  hideSplash(): void;
  /** Sets the colour of the status bar icons (the clock, the battery); the browser keeps its own. */
  setBarIcons(icons: BarIcons): void;
}
