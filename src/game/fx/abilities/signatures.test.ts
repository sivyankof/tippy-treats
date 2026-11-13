import { describe, expect, it, vi } from 'vitest';
import { ABILITY_ANIM } from '../../../data/ability-anim';
import { CREATURE_IDS } from '../../../data/creatures';
import { RARITIES, RARITY_COLORS } from '../../../data/rarity';
import { SIGNATURES } from './signatures';

// Phaser needs a browser; the effects only look easing functions up when they are made.
vi.mock('../ease', () => ({ easeFn: () => (t: number) => t }));

describe('signature animations', () => {
  it('has one for every creature and nothing else', () => {
    expect(Object.keys(SIGNATURES).sort()).toEqual([...CREATURE_IDS].sort());
    for (const id of CREATURE_IDS) expect(typeof SIGNATURES[id]).toBe('function');
  });

  it('has numbers in the data for every creature', () => {
    for (const id of CREATURE_IDS) expect(ABILITY_ANIM).toHaveProperty(id);
  });
});

describe('rarity colours', () => {
  it('give every rarity its own colour: green, blue, purple, gold', () => {
    expect(new Set(RARITIES.map((r) => RARITY_COLORS[r])).size).toBe(RARITIES.length);
    expect(RARITY_COLORS.common).toBe(0x3ddc97);
    expect(RARITY_COLORS.legendary).toBe(0xffc93c);
  });
});
