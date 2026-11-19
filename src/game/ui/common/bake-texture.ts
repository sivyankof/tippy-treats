import type * as Phaser from 'phaser';
import { paddedSize } from '../../../util/field-pad';
import { clipGuardActive, drawProbed } from '../../clip-guard';

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
 * Runs one piece of a bake that is not a texture itself (a slice of pixel work) now, or, inside
 * `collectBakeSteps`, as one of the recorded steps, so a big job can be spread over frames.
 */
export function deferStep(step: BakeStep): void {
  if (sink) sink.push(step);
  else step();
}

/**
 * Draws with a hidden Graphics once and stores the result as a texture.
 * Does nothing when the key already exists (inside `collectBakeSteps` it is only recorded). Sizes are rounded up to whole pixels.
 * (0, 0) of the texture is its top-left corner; use translateCanvas to move the origin.
 * `finish` may then edit the pixels of the canvas (erase a piece) before the texture is made.
 */
export function bakeTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
  finish?: (context: CanvasRenderingContext2D) => void,
): void {
  if (scene.textures.exists(key)) return;
  if (sink) {
    const steps = sink;
    steps.push(() => {
      const previous = sink;
      sink = null;
      try {
        bakeTexture(scene, key, width, height, draw, finish);
      } finally {
        sink = previous;
      }
    });
    return;
  }
  const g = scene.add.graphics().setVisible(false);
  try {
    // The picture goes into a canvas first and the texture is made from the finished canvas,
    // so the GPU gets one upload instead of an empty one and a second after the drawing.
    const w = Math.ceil(width);
    const h = Math.ceil(height);
    let canvas: HTMLCanvasElement;
    if (clipGuardActive()) {
      // The probe runs `finish` itself, so the measured picture is the kept one.
      canvas = drawProbed(g, key, w, h, draw, finish);
    } else {
      draw(g);
      canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      g.generateTexture(canvas, w, h);
      // `finish` edits the finished pixels (cuts a piece out of the picture).
      const context = finish ? canvas.getContext('2d') : null;
      if (finish && context) finish(context);
    }
    // Small pictures drawn many times per frame share an atlas page (see shared-atlas.ts).
    if (!sharedStore?.(scene, key, canvas)) scene.textures.addCanvas(key, canvas);
  } finally {
    g.destroy();
  }
}

/**
 * Bakes a picture whose drawing sits in the middle of a field `pad` px bigger on every side than
 * `width` x `height`: the drawing keeps its coordinates, the room around it holds the outline and
 * tips that would be cut off. Place the picture by `paddedOrigin` to keep it where it was.
 */
export function bakePadded(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  pad: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  const [w, h] = paddedSize(width, height, pad);
  bakeTexture(scene, key, w, h, (g) => {
    g.translateCanvas(pad, pad);
    draw(g);
  });
}

/** A game object that only exists to be drawn into a texture: it leaves the scene's display list. */
export function offList<T extends Phaser.GameObjects.GameObject>(object: T): T {
  object.removeFromDisplayList();
  return object;
}
