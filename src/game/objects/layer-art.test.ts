import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../data/balance';
import { CREATURE_LOOKS } from '../../data/creature-looks';
import { CREATURE_IDS, CREATURES } from '../../data/creatures';
import { creatureColors } from './creature-art/primitives';
import { artAlpha, artHeight, artOriginY, artTopPad, layerArtKey } from './layer-art';
import { layerBox } from './layer-draw';

describe('layerArtKey', () => {
  it('keeps the plain key form', () => {
    expect(layerArtKey(3, null, 400, null)).toBe('layer_3_400_n');
    expect(layerArtKey(0, null, 399.6, 'left')).toBe('layer_0_400_l');
    expect(layerArtKey(5, null, 90, 'right')).toBe('layer_5_90_r');
  });

  it('puts the creature id into a creature key and ignores the colour index', () => {
    expect(layerArtKey(3, 'honey', 400, null)).toBe('layer_c_honey_400_n');
    expect(layerArtKey(0, 'honey', 400, null)).toBe(layerArtKey(4, 'honey', 400, null));
    expect(layerArtKey(0, 'puff', 400, 'left')).toBe('layer_c_puff_400_l');
  });

  it('gives every creature, width and cut its own key', () => {
    const keys = new Set<string>();
    for (const id of CREATURE_IDS) {
      for (const width of [200, 201]) {
        for (const cut of [null, 'left', 'right'] as const)
          keys.add(layerArtKey(0, id, width, cut));
      }
    }
    expect(keys.size).toBe(CREATURE_IDS.length * 2 * 3);
  });
});

describe('creature art geometry', () => {
  it('keeps the layer body at the same place of the picture whatever grows above it', () => {
    for (const id of [null, ...CREATURE_IDS]) {
      // The origin pixel is the centre of the body: the room above plus half the layer height.
      expect(artOriginY(id) * artHeight(id)).toBeCloseTo(artTopPad(id) + BALANCE.layer.height / 2);
      expect(artHeight(id)).toBeGreaterThanOrEqual(BALANCE.layer.height);
    }
  });

  it('a plain layer keeps the old symmetric picture', () => {
    expect(artOriginY(null)).toBeCloseTo(0.5);
  });

  it('details above the top edge make the picture grow upward only', () => {
    expect(artTopPad('ghost')).toBeGreaterThan(artTopPad(null));
    expect(artTopPad('honey')).toBe(artTopPad(null));
    expect(artOriginY('ghost')).toBeGreaterThan(0.5);
  });

  it('only the see-through creatures are drawn with an alpha below 1', () => {
    for (const id of CREATURE_IDS) {
      expect(artAlpha(id) < 1).toBe(id === 'jelly' || id === 'ghost');
    }
    expect(artAlpha(null)).toBe(1);
  });

  it('a recipe of each creature has its own kind and a reach that fits the data', () => {
    for (const id of CREATURE_IDS) {
      expect(CREATURE_LOOKS[id].art.kind).toBe(id);
      expect(CREATURE_LOOKS[id].art.topPad).toBeGreaterThanOrEqual(0);
    }
  });

  it('every palette colour of a creature is a #rrggbb string', () => {
    for (const id of CREATURE_IDS) {
      for (const color of Object.values(CREATURES[id].palette)) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/);
      }
      expect(creatureColors(id).sponge).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('layerBox', () => {
  it('is centred on the origin with the outline inside', () => {
    const box = layerBox(300);
    expect(box.left).toBe(-150);
    expect(box.right).toBe(150);
    expect(box.top).toBe(-BALANCE.layer.height / 2);
    expect(box.innerRight - box.innerLeft).toBeCloseTo(box.innerW);
    expect(box.innerBottom - box.innerTop).toBeCloseTo(box.innerH);
  });

  it('shrinks the corner radius on a very narrow layer', () => {
    expect(layerBox(20).radius).toBe(10);
  });
});
