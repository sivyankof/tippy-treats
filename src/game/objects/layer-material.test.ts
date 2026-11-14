import { afterEach, describe, expect, it } from 'vitest';
import type * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { CREATURE_MATERIALS } from '../../data/creature-materials';
import { effectsMode } from '../effects-mode';
import { LayerMaterial } from './layer-material';

/** Just enough of a container: the material only scales it. */
function fakeRoot(): { root: Phaser.GameObjects.Container; scale: { x: number; y: number } } {
  const scale = { x: 1, y: 1 };
  const root = {
    setScale(x: number, y?: number) {
      scale.x = x;
      scale.y = y ?? x;
      return root;
    },
  };
  return { root: root as unknown as Phaser.GameObjects.Container, scale };
}

const swaying = { timeMs: 175, swayShare: 1, phase: 0 };

describe('LayerMaterial', () => {
  afterEach(() => effectsMode.setChoice('auto'));

  it('lands like a plain layer without a creature', () => {
    const material = new LayerMaterial(fakeRoot().root);
    material.setCreature(null);
    expect(material.landing(1)).toEqual({
      scaleX: ANIM.land.scaleX,
      scaleY: ANIM.land.scaleY,
      durationMs: ANIM.land.durationMs,
      ease: ANIM.land.ease,
    });
    expect(material.tilt).toBe(1);
  });

  it('gives the jelly a deeper, longer landing and a stronger tilt', () => {
    const material = new LayerMaterial(fakeRoot().root);
    material.setCreature('jelly');
    const land = material.landing(1);
    expect(land.scaleY).toBeLessThan(ANIM.land.scaleY);
    expect(land.durationMs).toBeGreaterThan(ANIM.land.durationMs);
    expect(material.tilt).toBe(CREATURE_MATERIALS.jelly.sway?.tilt);
  });

  it('jiggles the jelly while the tower sways', () => {
    const { root, scale } = fakeRoot();
    const material = new LayerMaterial(root);
    material.setCreature('jelly');
    material.tick(16, swaying);
    expect(scale.y).not.toBe(1);
  });

  it('keeps only the landing with fewer effects', () => {
    effectsMode.setChoice('on');
    const { root, scale } = fakeRoot();
    const material = new LayerMaterial(root);
    material.setCreature('jelly');
    material.tick(16, swaying);
    expect(scale).toEqual({ x: 1, y: 1 });
    expect(material.tilt).toBe(1);
    expect(material.landing(1).scaleY).toBeLessThan(ANIM.land.scaleY);
  });

  it('stands still without motion (a flying or falling layer)', () => {
    const { root, scale } = fakeRoot();
    const material = new LayerMaterial(root);
    material.setCreature('puff');
    material.tick(16);
    expect(scale).toEqual({ x: 1, y: 1 });
  });

  it('shivers after its own landing and calms down', () => {
    const { root, scale } = fakeRoot();
    const material = new LayerMaterial(root);
    material.setCreature('lemon');
    const shiver = CREATURE_MATERIALS.lemon.landShiver;
    if (!shiver) throw new Error('lemon has a landing shiver');
    const motion = { timeMs: shiver.periodMs / 4, swayShare: 0, phase: 0 };
    material.startShiver();
    material.tick(1, motion);
    expect(scale.y).toBeLessThan(1);
    material.tick(shiver.ms, motion);
    expect(scale).toEqual({ x: 1, y: 1 });
  });
});
