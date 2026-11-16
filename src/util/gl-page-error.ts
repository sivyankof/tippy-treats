/** WebGL error codes (the numbers of the WebGL spec). */
export const GL_NO_ERROR = 0;
export const GL_INVALID_ENUM = 0x0500;
export const GL_INVALID_VALUE = 0x0501;
export const GL_INVALID_OPERATION = 0x0502;
export const GL_OUT_OF_MEMORY = 0x0505;
export const GL_CONTEXT_LOST_WEBGL = 0x9242;

/**
 * What happened to the big atlas page (docs/08, section 13):
 * - `made`: it was just made; `errors` are the GL errors read right after (those left by other
 *   code were drained before), `contextLost` whether the context is lost at that moment;
 * - `context_lost`: the context was lost later; `msSinceBigPage` is the time since the big page
 *   was made, `null` when there is no big page.
 */
export type BigPageEvent =
  | { kind: 'made'; errors: readonly number[]; contextLost: boolean }
  | { kind: 'context_lost'; msSinceBigPage: number | null };

/**
 * True when the device must fall back to the smaller pages: any GL error right after the big page
 * was made (a driver may refuse it with OUT_OF_MEMORY, INVALID_VALUE, INVALID_OPERATION or
 * INVALID_ENUM, and each leaves a broken page), a context lost while it was made, or a context
 * lost within `strikeWindowMs` after it (the GPU did not cope with it). A loss later than that is
 * not the page's fault: the big page comes back on restore.
 */
export function bigPageFails(event: BigPageEvent, strikeWindowMs: number): boolean {
  if (event.kind === 'made') {
    return event.contextLost || event.errors.some((e) => e !== GL_NO_ERROR);
  }
  return event.msSinceBigPage !== null && event.msSinceBigPage <= strikeWindowMs;
}
