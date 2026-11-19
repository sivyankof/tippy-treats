import { describe, expect, it } from 'vitest';
import { drawGraphicsToCanvas } from './graphics-to-canvas';

/** Behaves like Phaser 4.2.1 `Graphics`: drawing adds the object to the shared camera's list. */
class FakeGraphics {
  static TargetCamera = { renderList: [] as unknown[] };
  calls: unknown[][] = [];
  fail = false;

  generateTexture(key: HTMLCanvasElement, width?: number, height?: number): this {
    FakeGraphics.TargetCamera.renderList.push(this);
    this.calls.push([key, width, height]);
    if (this.fail) throw new Error('draw failed');
    return this;
  }
}

const canvas = {} as HTMLCanvasElement;

describe('drawGraphicsToCanvas', () => {
  it('draws into the canvas and leaves nothing on the shared camera', () => {
    const g = new FakeGraphics();
    drawGraphicsToCanvas(g, canvas, 12, 34);
    drawGraphicsToCanvas(new FakeGraphics(), canvas, 5, 6);
    expect(g.calls).toEqual([[canvas, 12, 34]]);
    expect(FakeGraphics.TargetCamera.renderList).toEqual([]);
  });

  it('empties the list even when the drawing throws', () => {
    const g = new FakeGraphics();
    g.fail = true;
    expect(() => drawGraphicsToCanvas(g, canvas, 1, 1)).toThrow('draw failed');
    expect(FakeGraphics.TargetCamera.renderList).toEqual([]);
  });

  it('draws a graphics without a shared camera as it is', () => {
    const calls: unknown[] = [];
    drawGraphicsToCanvas({ generateTexture: (...a: unknown[]) => calls.push(a) }, canvas, 2, 3);
    expect(calls).toEqual([[canvas, 2, 3]]);
  });
});
