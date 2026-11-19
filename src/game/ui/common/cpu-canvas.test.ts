import { describe, expect, it } from 'vitest';
import { createCpuCanvas, type CanvasDocument } from './cpu-canvas';

describe('createCpuCanvas', () => {
  it('sizes the canvas and asks for a context that keeps its pixels in main memory', () => {
    const asked: unknown[] = [];
    const fake = {
      width: 0,
      height: 0,
      getContext: (kind: string, options: unknown) => {
        asked.push([kind, options]);
        return null;
      },
    };
    const doc = { createElement: () => fake } as unknown as CanvasDocument;
    const { canvas, context } = createCpuCanvas(1000, 780, doc);
    expect(canvas).toBe(fake);
    expect([canvas.width, canvas.height]).toEqual([1000, 780]);
    expect(context).toBeNull();
    expect(asked).toEqual([['2d', { willReadFrequently: true }]]);
  });
});
