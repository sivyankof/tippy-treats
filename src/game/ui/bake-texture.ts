import type * as Phaser from 'phaser';

/** One deferred bake: draws and uploads a single texture. */
export type BakeStep = () => void;

let sink: BakeStep[] | null = null;

/** Stores a finished canvas on the shared atlas; false when the key keeps a texture of its own. */
export type SharedPictureStore = (
  scene: Phaser.Scene,
  key: string,
  canvas: HTMLCanvasElement,
) => boolean;

// Set by shared-atlas.ts when it loads; kept apart so this module does not load Phaser itself.
let sharedStore: SharedPictureStore | null = null;

export function setSharedPictureStore(store: SharedPictureStore): void {
  sharedStore = store;
}

/** The colour (0xRRGGBB) of a pixel of a picture on the shared atlas; null when `key` is not there. */
export type SharedPicturePixels = (
  textures: Phaser.Textures.TextureManager,
  x: number,
  y: number,
  key: string,
) => number | null;

let sharedPixels: SharedPicturePixels | null = null;

export function setSharedPicturePixels(read: SharedPicturePixels): void {
  sharedPixels = read;
}

/**
 * The colour (0xRRGGBB, 0 outside the picture) of a pixel of the texture `key`. Reads the
 * picture an atlas cell keeps, since an atlas page holds its pixels only on the GPU.
 */
export function picturePixel(
  textures: Phaser.Textures.TextureManager,
  x: number,
  y: number,
  key: string,
): number {
  return sharedPixels?.(textures, x, y, key) ?? textures.getPixel(x, y, key)?.color ?? 0;
}

/**
 * Runs `record` and returns the bakes it asked for instead of doing them, one step per
 * texture, so a caller can spread a big set of textures over several frames.
 */
export function collectBakeSteps(record: () => void): BakeStep[] {
  const steps: BakeStep[] = [];
  const outer = sink;
  sink = steps;
  try {
    record();
  } finally {
    sink = outer;
  }
  return steps;
}

/**
 * Draws with a hidden Graphics once and stores the result as a texture.
 * Does nothing when the key already exists (inside `collectBakeSteps` it is only recorded). Sizes are rounded up to whole pixels.
 * (0, 0) of the texture is its top-left corner; use translateCanvas to move the origin.
 */
export function bakeTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  if (scene.textures.exists(key)) return;
  if (sink) {
    const steps = sink;
    steps.push(() => {
      const previous = sink;
      sink = null;
      try {
        bakeTexture(scene, key, width, height, draw);
      } finally {
        sink = previous;
      }
    });
    return;
  }
  const g = scene.add.graphics().setVisible(false);
  try {
    draw(g);
    // The picture goes into a canvas first and the texture is made from the finished canvas,
    // so the GPU gets one upload instead of an empty one and a second after the drawing.
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width);
    canvas.height = Math.ceil(height);
    g.generateTexture(canvas, canvas.width, canvas.height);
    // Small pictures drawn many times per frame share an atlas page (see shared-atlas.ts).
    if (!sharedStore?.(scene, key, canvas)) scene.textures.addCanvas(key, canvas);
  } finally {
    g.destroy();
  }
}

/** A game object that only exists to be drawn into a texture: it leaves the scene's display list. */
export function offList<T extends Phaser.GameObjects.GameObject>(object: T): T {
  object.removeFromDisplayList();
  return object;
}
