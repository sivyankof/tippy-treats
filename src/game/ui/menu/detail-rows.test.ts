import { afterEach, describe, expect, it } from 'vitest';
import { upgradePreview } from '../../../core/creatures/mastery';
import { CREATURE_IDS, MAX_CREATURE_LEVEL } from '../../../data/creatures/creatures';
import { setLang, t } from '../../../i18n';
import { changeRows, detailPlan, DETAIL_PLAN_STEPS, masterBlock, upgradeRows } from './detail-rows';

afterEach(() => setLang('en'));

describe('upgradeRows', () => {
  it('has rows for every step of every creature, none at the maximum level', () => {
    for (const id of CREATURE_IDS) {
      for (let level = 1; level < MAX_CREATURE_LEVEL; level++) {
        expect(upgradeRows(id, level).length).toBeGreaterThan(0);
      }
      expect(upgradeRows(id, MAX_CREATURE_LEVEL)).toEqual([]);
    }
  });

  it('shows the perk of Meringue and Rainbow on the steps the core gives them', () => {
    expect(upgradeRows('ghost', 1).map((row) => row.kind)).toEqual(['perk']);
    expect(upgradeRows('rainbow', 2).map((row) => row.kind)).toContain('perk');
  });

  it('adds the new look on the step to level 3 and the master name and phrase to level 5', () => {
    expect(upgradeRows('honey', 2).some((row) => row.kind === 'look')).toBe(true);
    expect(upgradeRows('honey', 3).some((row) => row.kind === 'look')).toBe(false);
    const kinds = upgradeRows('honey', 4).map((row) => row.kind);
    expect(kinds.slice(-2)).toEqual(['master', 'phrase']);
    expect(upgradeRows('honey', 3).some((row) => row.kind === 'master')).toBe(false);
  });

  it('starts with the level the step leads to and never says "no change"', () => {
    setLang('ru');
    for (const id of CREATURE_IDS) {
      for (let level = 1; level < MAX_CREATURE_LEVEL; level++) {
        const preview = upgradePreview(id, level);
        const [first] = upgradeRows(id, level);
        expect(first?.text.startsWith(`Ур. ${preview?.toLevel} ·`)).toBe(true);
        expect(first?.text).not.toContain('без изменений');
      }
    }
  });
});

describe('changeRows', () => {
  it('labels every changed number, one line per number', () => {
    setLang('ru');
    expect(
      changeRows('jelly', [
        ['value', 75, 100],
        ['percent', 45, 55],
      ]).map((r) => r.text),
    ).toEqual(['Гашение качки: 75 → 100', 'Пружина: 45% → 55%']);
    setLang('en');
    expect(changeRows('honey', [['value', 38, 39]])[0]?.text).toBe('Tolerance: 38 → 39 px');
    setLang('ru');
  });

  it('has a label for every number that changes on any step of any creature', () => {
    for (const lang of ['ru', 'en'] as const) {
      setLang(lang);
      for (const id of CREATURE_IDS) {
        for (let level = 1; level < MAX_CREATURE_LEVEL; level++) {
          for (const row of changeRows(id, upgradePreview(id, level)?.changes ?? [])) {
            expect(row.text).not.toContain('mastery.stat');
            expect(row.text).toContain('→');
          }
        }
      }
    }
    setLang('ru');
  });
});

describe('masterBlock', () => {
  it('is only there from the master level', () => {
    expect(masterBlock('honey', 4)).toEqual([]);
    expect(masterBlock('honey', 5).map((row) => row.kind)).toEqual(['master', 'phrase']);
  });
});

describe('detailPlan', () => {
  it('drops the secondary parts one by one and keeps them all at step 0', () => {
    expect(detailPlan(0)).toEqual({
      trait: true,
      otherWays: true,
      tryButton: 'text',
      masterPhrase: true,
    });
    expect(detailPlan(DETAIL_PLAN_STEPS - 1)).toEqual({
      trait: false,
      otherWays: false,
      tryButton: 'icon',
      masterPhrase: false,
    });
  });
});

describe('creature descriptions', () => {
  it('has three short lines for every creature in both languages', () => {
    for (const lang of ['ru', 'en'] as const) {
      setLang(lang);
      for (const id of CREATURE_IDS) {
        for (const part of ['character', 'likes', 'dislikes']) {
          const text = t(`creature.${id}.bio.${part}`);
          expect(text).not.toContain('.bio.');
          expect(text.length).toBeLessThanOrEqual(40);
        }
      }
    }
  });
});
