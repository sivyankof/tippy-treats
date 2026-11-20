import { describe, expect, it } from 'vitest';
import { loadSave } from '../../src/core/save/load';
import { HINT_IDS, SAVE_VERSION } from '../../src/core/save/schema';
import { STORE_SAVE } from '../../src/data/debug/store-shots';
import { storeDay, storeNowMs, storeSave, storeSaveText } from './store-save';

describe('storeSave', () => {
  it('is a save the game loads as it is', () => {
    const text = storeSaveText('ru');
    const loaded = loadSave(text, null, storeNowMs(), () => 'other');
    expect(loaded.source).toBe('primary');
    expect(loaded.corrupt).toEqual([]);
    expect(loaded.save).toEqual(JSON.parse(text));
    expect(loaded.save.version).toBe(SAVE_VERSION);
  });

  it('holds the player of STORE_SAVE in the language asked', () => {
    const save = storeSave('en');
    expect(save.settings.lang).toBe('en');
    expect(storeSave('ru').settings.lang).toBe('ru');
    expect(save.coins).toBe(STORE_SAVE.coins);
    expect(save.team).toEqual([...STORE_SAVE.team]);
    expect(save.creatures.rainbow?.level).toBe(STORE_SAVE.creatures.rainbow);
    expect(save.installId).toBe(STORE_SAVE.installId);
  });

  it('opens no window by itself: tutorial and hints done, streak claimed today', () => {
    const save = storeSave('en');
    expect(save.tutorial.firstRunDone).toBe(true);
    expect([...save.tutorial.hintsShown].sort()).toEqual([...HINT_IDS].sort());
    expect(save.streak.claimedDay).toBe(storeDay());
    expect(save.daily.day).toBe(storeDay());
    expect(save.ads.offerDay).toBe(storeDay());
  });
});
