import type * as Phaser from 'phaser';

// The SVG sources are bundled as text. The Phaser loader fetches files by URL, and small files
// would otherwise be inlined by Vite as data URIs, which its loader cannot read, so each
// source is handed over as a short-lived blob URL. Pictures are drawn at the size written
// in the file, in logical pixels.
const SVG_SOURCES = import.meta.glob<string>('../../../assets/svg/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
});

function svgSource(key: string): string {
  const source = SVG_SOURCES[`../../../assets/svg/${key}.svg`];
  if (!source) throw new Error(`Missing picture assets/svg/${key}.svg`);
  return source;
}

/**
 * Queues the pictures `assets/svg/<key>.svg` in the scene loader under their file names, each
 * rasterised at `scale` times the size written in the file; call it from `preload`.
 */
export function loadSvgTextures(scene: Phaser.Scene, keys: readonly string[], scale = 1): void {
  const urls: string[] = [];
  for (const key of keys) {
    const blob = new Blob([svgSource(key)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    urls.push(url);
    scene.load.svg(key, url, scale === 1 ? undefined : { scale });
  }
  scene.load.once('complete', () => {
    for (const url of urls) URL.revokeObjectURL(url);
  });
}
