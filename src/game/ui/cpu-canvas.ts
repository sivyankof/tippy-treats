/** What `createCpuCanvas` needs of the page (a test passes a stand-in). */
export type CanvasDocument = Pick<Document, 'createElement'>;

/**
 * A canvas whose 2D context keeps its pixels in main memory (`willReadFrequently`). A big canvas
 * otherwise lives on the video chip, and turning it into a WebGL texture first reads all of it back:
 * for the 1000-px nebula picture that read cost 29 ms in one frame (docs/08, journal). Use it for a
 * picture written with `putImageData` or read back with `getImageData`.
 */
export function createCpuCanvas(
  width: number,
  height: number,
  doc: CanvasDocument = document,
): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D | null } {
  const canvas = doc.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, context: canvas.getContext('2d', { willReadFrequently: true }) };
}
