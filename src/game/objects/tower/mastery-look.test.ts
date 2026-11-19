import { describe, expect, it } from 'vitest';
import { artRecipe } from '../../../data/creatures/creature-looks';
import { hasNewLook } from '../../../core/creatures/mastery';
import { MASTERY } from '../../../data/creatures/mastery';
import { CREATURE_IDS } from '../../../data/creatures/creatures';
import { GROWN_ACCENTS, GROWN_LOOKS, MASTERY_FRAME } from '../../../data/creatures/mastery-look';
import { artTopPad, creatureStage, layerArtKey } from './layer-art';

describe('grown look', () => {
  it('starts at level 3', () => {
    expect(MASTERY.lookLevel).toBe(3);
    expect(hasNewLook(2)).toBe(false);
    expect(hasNewLook(3)).toBe(true);
    expect(hasNewLook(0)).toBe(false);
  });

  it('has a picture for every creature, at least as tall as the usual one', () => {
    for (const id of CREATURE_IDS) {
      expect(GROWN_LOOKS[id].topPad).toBeGreaterThanOrEqual(artRecipe(id).topPad);
      expect(artTopPad(id, 'grown')).toBeGreaterThanOrEqual(artTopPad(id));
    }
  });

  it('keys the grown pictures apart from the usual ones', () => {
    expect(layerArtKey(0, 'honey', 400, null, false, 'grown')).toBe('layer_c_honey_400_n_g');
    expect(layerArtKey(0, 'ghost', 400, null, false, 'glow')).toBe('layer_c_ghost_400_n_gl');
    expect(layerArtKey(0, 'honey', 400, null)).toBe('layer_c_honey_400_n');
  });

  it('lights only the grown Ghost in the Stars and Space zones', () => {
    expect(creatureStage('ghost', true, 1)).toBe('grown');
    expect(creatureStage('ghost', true, 90)).toBe('glow');
    expect(creatureStage('honey', true, 90)).toBe('grown');
    expect(creatureStage('ghost', false, 90)).toBe('base');
    expect(creatureStage(null, true, 90)).toBe('base');
  });

  it('gives accents only to some creatures and a frame the card size', () => {
    expect(Object.keys(GROWN_ACCENTS).sort()).toEqual(['frosty', 'honey', 'sprinkle']);
    expect(MASTERY_FRAME.key).toBe('ui_mastery_frame');
  });
});
