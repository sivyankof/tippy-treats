/** WebGL error codes that matter for a page allocation (the numbers of the WebGL spec). */
export const GL_INVALID_VALUE = 0x0501;
export const GL_OUT_OF_MEMORY = 0x0505;
export const GL_CONTEXT_LOST_WEBGL = 0x9242;

/**
 * What the GL errors read right after a page was made mean:
 * - `ok`: the page is fine (no error, or only errors unrelated to the allocation);
 * - `lost`: the context was lost, which is not a failure of the page (the restore path refills it);
 * - `too_big`: the GPU refused the allocation, so pages must be the smaller size.
 */
export type PageVerdict = 'ok' | 'lost' | 'too_big';

export function pageVerdict(errors: readonly number[], contextLost: boolean): PageVerdict {
  if (contextLost || errors.includes(GL_CONTEXT_LOST_WEBGL)) return 'lost';
  return errors.some((e) => e === GL_OUT_OF_MEMORY || e === GL_INVALID_VALUE) ? 'too_big' : 'ok';
}
