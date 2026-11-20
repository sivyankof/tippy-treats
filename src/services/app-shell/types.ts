/**
 * The app around the game: what the native shell tells the game and what it does for it. In the
 * browser there is no shell: the page visibility covers going to the background, and the browser
 * owns its back button.
 */

/** Colour of the status bar icons: `light` over a dark top of the screen, `dark` over a light one. */
export type BarIcons = 'light' | 'dark';

/** The device the game runs on, for the support letter (docs/09-services-analytics.md, section 12). */
export interface DeviceInfo {
  /** The model: "iPhone", "Pixel 7". */
  model: string;
  /** The system and its version: "iOS 18.1", "Android 15". */
  os: string;
}

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
  /** Opens an outside address (a page of the game's site): the system browser in the app, a new tab in a browser. */
  openExternal(url: string): void;
  /** The device model and the system version; never rejects (an unknown device gives `unknown`). */
  deviceInfo(): Promise<DeviceInfo>;
  /** The build number of the app (iOS `CFBundleVersion`, Android `versionCode`); `null` in a browser or when it cannot be read. */
  appBuild(): Promise<string | null>;
}
