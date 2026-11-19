import * as Phaser from 'phaser';

export type WebGLRenderer = Phaser.Renderer.WebGL.WebGLRenderer;

/** The renderer when it draws with WebGL, else null (canvas renderer, or the renderer has not booted yet). */
export function asWebGLRenderer(renderer: Phaser.Game['renderer']): WebGLRenderer | null {
  return renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer ? renderer : null;
}

/** The WebGL renderer of the game, or null while there is none. */
export function webglRendererOf(game: Phaser.Game): WebGLRenderer | null {
  return asWebGLRenderer(game.renderer);
}
