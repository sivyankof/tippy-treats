import { describe, expect, it, vi } from 'vitest';
import type { SimEvent } from '../../core/tower-sim';
import { HAPTICS } from '../../data/haptics';
import type { Services } from '../../services';
import { cuesForEvents, playCues } from './run-cues';

const land = (over: Partial<Extract<SimEvent, { type: 'land' }>> = {}): SimEvent => ({
  type: 'land',
  quality: 'normal',
  dx: 0,
  cutWidth: 0,
  cutSide: null,
  newWidth: 100,
  ...over,
});
const sneeze: SimEvent = { type: 'wobble_sneeze', newWidth: 50 };
const miss: SimEvent = { type: 'miss', shielded: false };
const memo = { width: 200 };

describe('cuesForEvents', () => {
  it('maps a normal landing to a drop and a light haptic', () => {
    expect(cuesForEvents([land()], { combo: 0 }, memo)).toEqual({
      sounds: [{ kind: 'drop' }],
      haptics: ['light'],
    });
  });

  it('maps a perfect landing to the combo step and a medium haptic', () => {
    expect(cuesForEvents([land({ quality: 'perfect' })], { combo: 3 }, memo)).toEqual({
      sounds: [{ kind: 'perfect', step: 3 }],
      haptics: ['medium'],
    });
  });

  it('adds the crunch for a bite, heavy only above the big-bite share', () => {
    const small = Math.floor(memo.width * HAPTICS.bigBiteShare);
    const smallCues = cuesForEvents(
      [land({ cutWidth: small, cutSide: 'left' })],
      { combo: 0 },
      memo,
    );
    expect(smallCues.sounds).toEqual([{ kind: 'drop' }, { kind: 'bite' }]);
    expect(smallCues.haptics).toEqual(['light']);
    const bigCues = cuesForEvents(
      [land({ cutWidth: small + 1, cutSide: 'left' })],
      { combo: 0 },
      memo,
    );
    expect(bigCues.haptics).toEqual(['heavy']);
  });

  it('falls back to light when the width before landing is unknown', () => {
    const cues = cuesForEvents([land({ cutWidth: 90, cutSide: 'left' })], { combo: 0 }, null);
    expect(cues.haptics).toEqual(['light']);
  });

  it('gives one error haptic when a sneeze and a miss share a step', () => {
    const cues = cuesForEvents([land(), sneeze, miss], { combo: 0 }, memo);
    expect(cues.sounds.map((s) => s.kind)).toEqual(['drop', 'sneeze', 'miss']);
    expect(cues.haptics).toEqual(['light', 'error']);
  });

  it('treats a shielded miss as a thud without the miss jingle or the error haptic', () => {
    const shielded: SimEvent = { type: 'miss', shielded: true };
    expect(cuesForEvents([shielded], { combo: 0 }, memo)).toEqual({
      sounds: [{ kind: 'drop' }],
      haptics: ['medium'],
    });
  });

  it('gives an error haptic for a plain miss', () => {
    expect(cuesForEvents([miss], { combo: 0 }, memo)).toEqual({
      sounds: [{ kind: 'miss' }],
      haptics: ['error'],
    });
  });

  it('is silent for steps without feedback events', () => {
    expect(cuesForEvents([{ type: 'effect_end', effect: 'x' }], { combo: 0 }, memo)).toEqual({
      sounds: [],
      haptics: [],
    });
  });
});

describe('playCues', () => {
  it('calls the matching service methods', () => {
    const audio = {
      drop: vi.fn(),
      bite: vi.fn(),
      sneeze: vi.fn(),
      miss: vi.fn(),
      perfect: vi.fn(),
    };
    const haptics = { play: vi.fn() };
    const services = { audio, haptics } as unknown as Services;
    playCues(
      {
        sounds: [{ kind: 'drop' }, { kind: 'bite' }, { kind: 'perfect', step: 4 }],
        haptics: ['heavy'],
      },
      services,
    );
    expect(audio.drop).toHaveBeenCalledOnce();
    expect(audio.bite).toHaveBeenCalledOnce();
    expect(audio.perfect).toHaveBeenCalledWith(4);
    expect(haptics.play).toHaveBeenCalledWith('heavy');
  });
});
