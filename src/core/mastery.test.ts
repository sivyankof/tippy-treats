import { describe, expect, it } from 'vitest';
import { CREATURE_IDS, MAX_CREATURE_LEVEL } from '../data/creatures';
import { MASTERY } from '../data/mastery';
import {
  hasNewLook,
  isMaster,
  lookStage,
  masterInfo,
  perksAt,
  teamHasNewLook,
  upgradePreview,
} from './mastery';

const STEPS = [1, 2, 3, 4] as const;

describe('look and master level', () => {
  it('grows the look from level 3 on', () => {
    expect([1, 2, 3, 4, 5].map(lookStage)).toEqual(['base', 'base', 'grown', 'grown', 'grown']);
    expect([1, 2, 3, 4, 5].map(hasNewLook)).toEqual([false, false, true, true, true]);
    expect(MASTERY.lookLevel).toBe(3);
  });

  it('finds the new look of a creature in a team', () => {
    const team = [{ id: 'brownie', level: 2 }, null, { id: 'jelly', level: 3 }] as const;
    expect(teamHasNewLook(team, 'jelly')).toBe(true);
    expect(teamHasNewLook(team, 'brownie')).toBe(false);
    expect(teamHasNewLook(team, 'frosty')).toBe(false);
    expect(
      teamHasNewLook(
        [
          { id: 'jelly', level: 1 },
          { id: 'jelly', level: 4 },
        ],
        'jelly',
      ),
    ).toBe(true);
  });

  it('is master only at level 5', () => {
    expect([1, 2, 3, 4, 5].map(isMaster)).toEqual([false, false, false, false, true]);
  });

  it('clamps levels outside 1..5', () => {
    expect(lookStage(0)).toBe('base');
    expect(lookStage(99)).toBe('grown');
    expect(isMaster(99)).toBe(true);
    expect(isMaster(4.9)).toBe(false);
  });
});

describe('upgradePreview', () => {
  it('gives every creature something visible on every step', () => {
    for (const id of CREATURE_IDS) {
      for (const from of STEPS) {
        const preview = upgradePreview(id, from);
        expect(preview, `${id} ${from}`).not.toBeNull();
        if (!preview) continue;
        const things =
          preview.changes.length +
          preview.perks.length +
          (preview.newLook ? 1 : 0) +
          (preview.master ? 1 : 0);
        expect(things, `${id} ${from} -> ${from + 1}`).toBeGreaterThan(0);
        for (const [key, was, becomes] of preview.changes) {
          expect(was, `${id} ${from} ${key}`).not.toBe(becomes);
        }
      }
    }
  });

  it('brings the new look on the step to 3 and the master on the step to 5, nowhere else', () => {
    for (const id of CREATURE_IDS) {
      for (const from of STEPS) {
        const preview = upgradePreview(id, from);
        expect(preview?.toLevel).toBe(from + 1);
        expect(preview?.newLook, `${id} ${from}`).toBe(from + 1 === MASTERY.lookLevel);
        expect(preview?.master, `${id} ${from}`).toBe(from + 1 === MASTERY.masterLevel ? id : null);
      }
    }
  });

  it('has nothing after the maximum level', () => {
    expect(upgradePreview('honey', MAX_CREATURE_LEVEL)).toBeNull();
  });

  it('lists the changed numbers of the ability text', () => {
    expect(upgradePreview('honey', 1)?.changes).toEqual([['value', 30, 34]]);
    expect(upgradePreview('jelly', 4)?.changes).toEqual([
      ['value', 75, 100],
      ['percent', 45, 55],
    ]);
  });

  it('closes the empty steps of the ghost and the rainbow with new properties', () => {
    expect(upgradePreview('ghost', 1)).toEqual({
      toLevel: 2,
      changes: [],
      perks: [{ id: 'ghost_centre_mark', values: {} }],
      newLook: false,
      master: null,
    });
    expect(upgradePreview('rainbow', 1)?.perks).toEqual([
      { id: 'rainbow_protected_score', values: { value: 50 } },
    ]);
    expect(upgradePreview('rainbow', 2)).toMatchObject({
      changes: [],
      perks: [{ id: 'rainbow_own_layer', values: {} }],
      newLook: true,
    });
    expect(upgradePreview('rainbow', 3)?.changes).toEqual([['value', 1, 2]]);
    expect(upgradePreview('rainbow', 3)?.perks).toEqual([]);
    expect(upgradePreview('rainbow', 4)).toMatchObject({
      changes: [],
      perks: [],
      master: 'rainbow',
    });
  });
});

describe('perksAt', () => {
  it('lists the ladder properties a level has', () => {
    expect(perksAt('ghost', 1)).toEqual([]);
    expect(perksAt('ghost', 5)).toEqual([{ id: 'ghost_centre_mark', values: {} }]);
    expect(perksAt('rainbow', 1)).toEqual([]);
    expect(perksAt('rainbow', 3).map((perk) => perk.id)).toEqual([
      'rainbow_protected_score',
      'rainbow_own_layer',
    ]);
    expect(perksAt('honey', 5)).toEqual([]);
  });
});

describe('masterInfo', () => {
  it('names the i18n keys and fills the numbers from the mastery data', () => {
    expect(masterInfo('brownie')).toEqual({
      nameKey: 'mastery.brownie.name',
      shortKey: 'mastery.brownie.short',
      values: { coins: MASTERY.brownie.shieldCoins },
    });
    expect(masterInfo('crumb').values).toEqual({ percent: 30, coins: 3 });
    expect(masterInfo('ghost').values).toEqual({});
  });
});
