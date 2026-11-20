/** Version from package.json, put in by `define` in vite.config.ts. */
declare const __APP_VERSION__: string;

/** Short git hash of the build, put in by `define` in vite.config.ts ('unknown' without git). */
declare const __BUILD_HASH__: string;
/** Time of the build as `yyyy-mm-dd HH:MM UTC`, put in by `define` in vite.config.ts. */
declare const __BUILD_TIME__: string;

/** True when `ios/App/App/GoogleService-Info.plist` was there at build time (`define` in vite.config.ts). */
declare const __FIREBASE_IOS__: boolean;
/** True when `android/app/google-services.json` was there at build time (`define` in vite.config.ts). */
declare const __FIREBASE_ANDROID__: boolean;

interface ImportMetaEnv {
  /** `1` in the internal build of the apps (debug menu, URL debug parameters); unset in the store build. */
  readonly VITE_INTERNAL_BUILD?: string;
  /** The iOS simulator trace build: `1` logs the sound's status every few seconds; `soundboard` opens the sound test page and plays every track. */
  readonly VITE_AUDIO_TRACE?: string;
  /** AdMob ad units of the store build (`.env`); the dev server and the internal build use Google's sample units. */
  readonly VITE_ADMOB_REWARDED_ID_IOS?: string;
  readonly VITE_ADMOB_INTERSTITIAL_ID_IOS?: string;
  readonly VITE_ADMOB_REWARDED_ID_ANDROID?: string;
  readonly VITE_ADMOB_INTERSTITIAL_ID_ANDROID?: string;
  /** Public SDK keys of RevenueCat (`.env`); without one the purchases of that platform stay unavailable. */
  readonly VITE_REVENUECAT_API_KEY_IOS?: string;
  readonly VITE_REVENUECAT_API_KEY_ANDROID?: string;
}
