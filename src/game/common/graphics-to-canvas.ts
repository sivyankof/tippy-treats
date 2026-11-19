/** The part of a Phaser `Graphics` that draws it into a canvas. */
export interface CanvasGraphics {
  generateTexture(key: HTMLCanvasElement, width?: number, height?: number): unknown;
}

interface RenderListCamera {
  renderList: unknown[];
}

/** The camera `generateTexture` draws with: a static of the object's class (`Graphics.TargetCamera`). */
function targetCamera(g: CanvasGraphics): RenderListCamera | null {
  const camera = (g.constructor as { TargetCamera?: Partial<RenderListCamera> }).TargetCamera;
  return Array.isArray(camera?.renderList) ? (camera as RenderListCamera) : null;
}

/**
 * Draws `g` into `canvas` with `generateTexture` and lets the drawing go afterwards.
 *
 * Phaser 4.2.1 draws through one shared camera, `Graphics.TargetCamera`, which adds every object
 * it draws to its `renderList`. A scene camera empties that list before each frame; this camera
 * is never rendered, so the list kept every baked Graphics (destroyed ones too, with their
 * command buffers) for the whole game: the slow growth of the heap from lap to lap (docs/08,
 * journal 2026-11-19). Nothing reads that list, so it is emptied after each drawing.
 */
export function drawGraphicsToCanvas(
  g: CanvasGraphics,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): void {
  try {
    g.generateTexture(canvas, width, height);
  } finally {
    const camera = targetCamera(g);
    if (camera) camera.renderList.length = 0;
  }
}
