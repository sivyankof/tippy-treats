import type * as Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { bakeTexture, collectBakeSteps } from './bake-texture';

function fakeScene(): { scene: Phaser.Scene; keys: Set<string> } {
  const keys = new Set<string>();
  const graphics = {
    setVisible: () => graphics,
    generateTexture: (key: string) => keys.add(key),
    destroy: () => undefined,
  };
  const scene = {
    textures: { exists: (key: string) => keys.has(key) },
    add: { graphics: () => graphics },
  } as unknown as Phaser.Scene;
  return { scene, keys };
}

describe('collectBakeSteps', () => {
  it('records bakes instead of doing them, one step per texture', () => {
    const { scene, keys } = fakeScene();
    const steps = collectBakeSteps(() => {
      bakeTexture(scene, 'a', 4, 4, () => undefined);
      bakeTexture(scene, 'b', 4, 4, () => undefined);
    });
    expect(steps).toHaveLength(2);
    expect(keys.size).toBe(0);
    steps[0]?.();
    expect([...keys]).toEqual(['a']);
    steps[1]?.();
    expect([...keys]).toEqual(['a', 'b']);
  });

  it('bakes at once outside a collection and skips textures that exist', () => {
    const { scene, keys } = fakeScene();
    bakeTexture(scene, 'a', 4, 4, () => undefined);
    expect(keys.has('a')).toBe(true);
    expect(collectBakeSteps(() => bakeTexture(scene, 'a', 4, 4, () => undefined))).toHaveLength(0);
  });
});
