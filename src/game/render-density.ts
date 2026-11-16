import * as Phaser from 'phaser';
import { cappedBackingSize } from '../util/density-scale';

/** Lets the cap change while the game runs (the effects level moves). */
export interface DensityCap {
  setCap(cap: number): void;
}

type Box = [number, number, number, number];

/**
 * Draws the canvas with at most `cap` canvas pixels per CSS pixel. Phaser 4.2 has no `resolution`
 * setting: the backing store of the canvas is the logical size (1080 wide), about 2.5 pixels per
 * CSS pixel on a phone. Here only the backing store shrinks; the game size, the cameras, the input
 * (it maps CSS pixels to the game size) and every texture keep the logical size. The renderer still
 * sets the viewport and the scissor box of the canvas in logical pixels, so the two calls are
 * scaled on the WebGL context while the canvas framebuffer is bound; framebuffers of textures and
 * filters are left alone. Returns null when the game does not draw with WebGL, else a handle that changes the cap.
 */
export function capRenderDensity(game: Phaser.Game, initialCap: number): DensityCap | null {
  const renderer = game.renderer;
  if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return null;
  const gl = renderer.gl;
  const canvas = game.canvas;
  const viewport = Array.from(gl.getParameter(gl.VIEWPORT) as Int32Array) as Box;
  const scissor = Array.from(gl.getParameter(gl.SCISSOR_BOX) as Int32Array) as Box;
  const rawViewport = gl.viewport.bind(gl);
  const rawScissor = gl.scissor.bind(gl);
  const rawBind = gl.bindFramebuffer.bind(gl);
  let canvasBound = gl.getParameter(gl.FRAMEBUFFER_BINDING) === null;
  let cap = initialCap;
  let scaleX = 1;
  let scaleY = 1;

  const scaled = (box: Box, apply: (x: number, y: number, w: number, h: number) => void): void => {
    const sx = canvasBound ? scaleX : 1;
    const sy = canvasBound ? scaleY : 1;
    apply(
      Math.round(box[0] * sx),
      Math.round(box[1] * sy),
      Math.round(box[2] * sx),
      Math.round(box[3] * sy),
    );
  };
  const reapply = (): void => {
    scaled(viewport, rawViewport);
    scaled(scissor, rawScissor);
  };

  gl.viewport = (x, y, w, h): void => {
    viewport.splice(0, 4, x, y, w, h);
    scaled(viewport, rawViewport);
  };
  gl.scissor = (x, y, w, h): void => {
    scissor.splice(0, 4, x, y, w, h);
    scaled(scissor, rawScissor);
  };
  gl.bindFramebuffer = (target, framebuffer): void => {
    rawBind(target, framebuffer);
    const toCanvas = framebuffer === null;
    if (toCanvas === canvasBound) return;
    canvasBound = toCanvas;
    // The renderer skips a viewport it believes is set already, so the scale follows the binding.
    reapply();
  };

  const fit = (): void => {
    const logical = { width: game.scale.baseSize.width, height: game.scale.baseSize.height };
    const css = canvas.getBoundingClientRect().width || game.scale.displaySize.width;
    const backing = cappedBackingSize(logical, css, window.devicePixelRatio, cap);
    // Setting the size clears the canvas, so only a real change does it.
    if (canvas.width !== backing.width) canvas.width = backing.width;
    if (canvas.height !== backing.height) canvas.height = backing.height;
    scaleX = backing.width / logical.width;
    scaleY = backing.height / logical.height;
    reapply();
  };
  fit();
  // The scale manager puts the canvas back to the logical size on every resize of the game.
  game.scale.on(Phaser.Scale.Events.RESIZE, fit);
  return {
    setCap(next: number): void {
      if (next === cap) return;
      cap = next;
      fit();
    },
  };
}
