import type * as Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { openScreen, SCENES } from './scene-keys';

function fakeScene(key: string) {
  const start = vi.fn();
  const scene = {
    scene: { key, isActive: () => false, isPaused: () => false, stop: vi.fn(), start },
  } as unknown as Phaser.Scene;
  return { scene, start };
}

describe('openScreen', () => {
  it('starts a screen opened without data with a fresh empty object', () => {
    // Phaser keeps the previous start's data when none is given: Home would reopen the
    // settings window after every later visit once a language change had restarted it.
    const { scene, start } = fakeScene(SCENES.shop);
    openScreen(scene, SCENES.home);
    expect(start).toHaveBeenCalledWith(SCENES.home, {});
  });

  it('passes given data through', () => {
    const { scene, start } = fakeScene(SCENES.shop);
    const data = { highlightPlay: true };
    openScreen(scene, SCENES.home, data);
    expect(start).toHaveBeenCalledWith(SCENES.home, data);
  });
});
