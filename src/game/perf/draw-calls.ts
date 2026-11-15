import type * as Phaser from 'phaser';

/** The calls of the WebGL context that put something on the screen. */
const DRAW_FUNCTIONS = [
  'drawArrays',
  'drawElements',
  'drawArraysInstanced',
  'drawElementsInstanced',
];

type DrawFunction = (...args: unknown[]) => unknown;
type DrawingContext = Record<string, unknown>;

/**
 * Phaser 4 keeps no draw call count of its own (its batches end in `renderer.drawElements`, the
 * filters and the tilemap layer in the same place, but nothing counts them), so the benchmark
 * counts the draw calls of the WebGL context itself: each one is wrapped on the context object,
 * only while `?perf=1` is on. Returns the running total, or `null` when the game has no WebGL
 * context to count on.
 */
export function countDrawCalls(game: Phaser.Game): (() => number) | null {
  const gl = (game.renderer as unknown as { gl?: DrawingContext }).gl;
  if (!gl) return null;
  let total = 0;
  for (const name of DRAW_FUNCTIONS) {
    const original = gl[name];
    if (typeof original !== 'function') continue;
    gl[name] = function (...args: unknown[]): unknown {
      total++;
      return (original as DrawFunction).apply(gl, args);
    };
  }
  return () => total;
}
