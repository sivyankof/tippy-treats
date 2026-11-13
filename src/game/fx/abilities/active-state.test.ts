import { describe, expect, it } from 'vitest';
import type { ActiveEffect } from '../../../core/abilities/types';
import { CREATURE_IDS, type CreatureId } from '../../../data/creatures';
import {
  bubbleInputFor,
  emptyFlags,
  guideGlow,
  isFadedIn,
  nextBubblePhase,
  readActiveFlags,
} from './active-state';

const effect = (id: CreatureId, layersLeft = 2): ActiveEffect => ({
  id,
  layersLeft,
  level: 1,
  boosted: false,
  value: 0,
});

describe('readActiveFlags', () => {
  it('raises the flag of every running effect and the shield', () => {
    const flags = readActiveFlags([effect('ghost'), effect('lemon')], 2, true, emptyFlags());
    expect(flags.ghost).toBe(true);
    expect(flags.lemon).toBe(true);
    expect(flags.shield).toBe(true);
    expect(flags.frosty).toBe(false);
  });

  it('drops flags of effects that are gone since the last read', () => {
    const flags = emptyFlags();
    readActiveFlags([effect('frosty')], 0, true, flags);
    readActiveFlags([], 0, true, flags);
    expect(CREATURE_IDS.every((id) => !flags[id])).toBe(true);
    expect(flags.shield).toBe(false);
  });

  it('turns everything off when the run is over', () => {
    const flags = readActiveFlags([effect('rainbow')], 3, false, emptyFlags());
    expect(flags.rainbow).toBe(false);
    expect(flags.shield).toBe(false);
  });

  it('reuses the object it is given', () => {
    const flags = emptyFlags();
    expect(readActiveFlags([], 0, true, flags)).toBe(flags);
  });
});

describe('guideGlow', () => {
  it('lights up within the tolerance on either side, edge included', () => {
    expect(guideGlow(true, 500, 500, 30)).toBe(true);
    expect(guideGlow(true, 530, 500, 30)).toBe(true);
    expect(guideGlow(true, 470, 500, 30)).toBe(true);
  });

  it('stays dark outside the tolerance', () => {
    expect(guideGlow(true, 531, 500, 30)).toBe(false);
    expect(guideGlow(true, 469, 500, 30)).toBe(false);
  });

  it('stays dark without guides or without a flying layer', () => {
    expect(guideGlow(false, 500, 500, 30)).toBe(false);
    expect(guideGlow(true, null, 500, 30)).toBe(false);
  });
});

describe('nextBubblePhase', () => {
  it('shows, pops and rests', () => {
    let phase = nextBubblePhase('idle', 'shield_up');
    expect(phase).toBe('on');
    phase = nextBubblePhase(phase, 'pop');
    expect(phase).toBe('popping');
    expect(nextBubblePhase(phase, 'done')).toBe('idle');
  });

  it('melts when the shield runs out', () => {
    expect(nextBubblePhase('on', 'melt')).toBe('melting');
    expect(nextBubblePhase('melting', 'done')).toBe('idle');
  });

  it('does not restart while it is bursting and ignores effects on a hidden bubble', () => {
    expect(nextBubblePhase('popping', 'shield_up')).toBe('popping');
    expect(nextBubblePhase('idle', 'pop')).toBe('idle');
    expect(nextBubblePhase('idle', 'melt')).toBe('idle');
  });

  it('hides a shown bubble whose shield vanished without a burst or a melt', () => {
    expect(nextBubblePhase('on', 'shield_down')).toBe('idle');
    expect(nextBubblePhase('melting', 'shield_down')).toBe('melting');
  });
});

describe('bubbleInputFor', () => {
  it('shows the bubble while there is a shield, even when the run is over', () => {
    expect(bubbleInputFor(true, true)).toBe('shield_up');
    expect(bubbleInputFor(true, false)).toBe('shield_up');
  });

  it('hides it at once without a shield in a running game and melts it when the run stops', () => {
    expect(bubbleInputFor(false, true)).toBe('shield_down');
    expect(bubbleInputFor(false, false)).toBe('melt');
  });
});

describe('bubble on the step the shield runs out and catches a miss', () => {
  it('pops from a melt that has just begun', () => {
    const melting = nextBubblePhase('on', 'melt');
    expect(nextBubblePhase(melting, 'pop')).toBe('popping');
  });
});

describe('isFadedIn', () => {
  it('is true only above the threshold', () => {
    expect(isFadedIn(0)).toBe(false);
    expect(isFadedIn(0.01)).toBe(false);
    expect(isFadedIn(0.02)).toBe(true);
  });
});
