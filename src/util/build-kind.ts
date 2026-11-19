/**
 * What kind of build this is. `VITE_INTERNAL_BUILD=1` at build time makes the internal build of the
 * apps: the debug tools (URL debug parameters, the debug menu in the settings) are in it. The store
 * build leaves the variable unset; the bundler then drops every branch behind these flags.
 */
export const INTERNAL_BUILD: boolean = import.meta.env.VITE_INTERNAL_BUILD === '1';

/** The debug tools are on: the dev server or the internal build. */
export const DEBUG_TOOLS: boolean = import.meta.env.DEV || INTERNAL_BUILD;
// A `DEBUG_TOOLS` test does not let the bundler drop a dynamic `import()` behind it (the value is
// not folded across modules): where code must be absent from the store build, write
// `import.meta.env.DEV || import.meta.env.VITE_INTERNAL_BUILD === '1'` out in place.
