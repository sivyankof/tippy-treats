import type * as Phaser from 'phaser';

/** One deferred bake: draws and uploads a single texture. */
export type BakeStep = () => void;

let sink: BakeStep[] | null = null;

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
    g.generateTexture(key, Math.ceil(width), Math.ceil(height));
  } finally {
    g.destroy();
  }
}
