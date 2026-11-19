/** Version from package.json, put in by `define` in vite.config.ts. */
declare const __APP_VERSION__: string;

/** Short git hash of the build, put in by `define` in vite.config.ts ('unknown' without git). */
declare const __BUILD_HASH__: string;
/** Time of the build as `yyyy-mm-dd HH:MM UTC`, put in by `define` in vite.config.ts. */
declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
  /** `1` in the internal build of the apps (debug menu, URL debug parameters); unset in the store build. */
  readonly VITE_INTERNAL_BUILD?: string;
}
