import { describe, expect, it } from 'vitest';
import { createDefaultSave } from '../core/save/defaults';
import type { Save } from '../core/save/schema';
import type { RunResult } from '../core/run/run-result';
import { MS_PER_DAY } from '../data/app/clock';
import { localDay } from '../util/calendar';
import { GameState } from './game-state';
import { createTestState, loadTestState } from './test-state';

// Every method and property of `GameState` is in exactly one of the two groups below
// (docs/08-architecture.md, section 5): a new one has to choose. The cases call each public
// one on a save whose `sync.dirty` is false and look at the flag afterwards.

const T0 = Date.UTC(2026, 5, 10, 12, 0, 0);

function run(over: Partial<RunResult> = {}): RunResult {
  return {
    seed: 1,
    mode: 'classic',
    height: 10,
    score: 100,
    coins: 30,
    berries: 0,
    perfects: 2,
    bestCombo: 3,
    continuesUsed: 0,
    zoneIndex: 0,
    durationMs: 1000,
    endReason: 'miss',
    ...over,
  };
}

type Clock = { ms: number };

/** A well-off player with every shop, the daily tower and a completed mission list. */
function richSave(clock: Clock): Save {
  const base = createDefaultSave(clock.ms, 'sync-test');
  const probe = createTestState({ ms: clock.ms });
  probe.refreshDay();
  const items = probe.missions.items.map((item) => ({ ...item, progress: item.target }));
  return {
    ...base,
    coins: 100_000,
    berries: 10_000,
    bakerLevel: 12,
    checkpoints: [20],
    missions: { day: localDay(clock.ms), items, rerollUsed: false, chestClaimed: false },
  };
}

/** The state of `save` reloaded with the flag down, so a case sees only its own change. */
function clean(save: Save, clock: Clock): Promise<GameState> {
  return loadTestState({ ...save, sync: { ...save.sync, dirty: false } }, clock);
}

/** `richSave` with all missions claimed, so only the chest is left. */
function chestSave(clock: Clock): Save {
  const save = richSave(clock);
  const items = save.missions.items.map((item) => ({ ...item, claimed: true }));
  return { ...save, missions: { ...save.missions, items } };
}

/** A new player with the missions of the day dealt and none of them done. */
function openMissions(clock: Clock): Save {
  const state = createTestState(clock);
  state.refreshDay();
  return state.data;
}

/** A save whose streak missed a day: the restore and the decline are open. */
function missedDay(clock: Clock): Save {
  const state = createTestState(clock);
  state.recordRun(run());
  clock.ms += 2 * MS_PER_DAY;
  return state.data;
}

interface Case {
  /** The save the case starts from (the flag is put down first); `richSave` when omitted. */
  save?: (clock: Clock) => Save;
  act: (state: GameState) => unknown;
}

const SETS_DIRTY: Record<string, Case | 'private'> = {
  recordRun: { act: (s) => s.recordRun(run()) },
  payCheckpoint: { act: (s) => s.payCheckpoint(20, 'berries') },
  claimStreak: { act: (s) => s.claimStreak() },
  restoreStreak: { save: missedDay, act: (s) => s.restoreStreak('ad') },
  declineStreak: { save: missedDay, act: (s) => s.declineStreak() },
  claimMission: { act: (s) => s.claimMission(0) },
  rerollMission: { save: openMissions, act: (s) => s.rerollMission(0) },
  claimChest: { save: chestSave, act: (s) => s.claimChest() },
  startDailyAttempt: { act: (s) => s.startDailyAttempt() },
  addDailyAttempt: { act: (s) => s.addDailyAttempt() },
  openGift: { act: (s) => s.openGift() },
  debugSetBakerLevel: { act: (s) => s.debugSetBakerLevel(5) },
  debugSetRuns: { act: (s) => s.debugSetRuns(3) },
  debugBumpBakerLevel: { act: (s) => s.debugBumpBakerLevel() },
  debugBumpCreatures: { act: (s) => s.debugBumpCreatures() },
  setTeam: { act: (s) => s.setTeam(['honey', null, null]) },
  buyCreature: { act: (s) => s.buyCreature(s.shopCreatures[0]?.id ?? 'puff', 'coins') },
  upgradeCreature: { act: (s) => s.upgradeCreature('honey') },
  addCoins: { act: (s) => s.addCoins(10) },
  claimDoubleCoins: { act: (s) => s.claimDoubleCoins(10) },
  addBerries: { act: (s) => s.addBerries(5) },
  spend: { act: (s) => s.spend({ coins: 1 }) },
  spendBerries: { act: (s) => s.spendBerries(1) },
  exchangeBerries: { act: (s) => s.exchangeBerries(10) },
  grantProduct: { act: (s) => s.grantProduct('berries_80', ['tx-1']) },
  claimFreeCoins: { act: (s) => s.claimFreeCoins() },
  noteStarterPackShown: { act: (s) => s.noteStarterPackShown() },
  resetProgress: { act: (s) => s.resetProgress() },
  progress: 'private',
  commit: 'private',
};

const RUN_FACTS = {
  runMs: 60_000,
  rewardedInRun: false,
  newRecord: false,
  levelUp: false,
  newCreature: false,
  shownInSession: 0,
};
const REVIEW_FACTS = {
  daily: false,
  newRecord: true,
  newCreature: false,
  interstitialDue: false,
  busy: false,
};

const KEEPS_CLEAN: Record<string, Case | 'private'> = {
  // Changes that are not the progress.
  load: { act: (s) => s.load() },
  flush: { act: (s) => s.flush() },
  beginSession: { act: (s) => s.beginSession() },
  noteInterstitialShown: { act: (s) => s.noteInterstitialShown() },
  noteRemoveAdsOffered: { act: (s) => s.noteRemoveAdsOffered() },
  notePlayDay: { act: (s) => s.notePlayDay() },
  noteReviewAsked: { act: (s) => s.noteReviewAsked('1.1') },
  refreshDay: { act: (s) => s.refreshDay() },
  countAdWatched: { act: (s) => s.countAdWatched() },
  noteAttAsked: { act: (s) => s.noteAttAsked() },
  markNotifAsked: { act: (s) => s.markNotifAsked() },
  setGiftNotifDay: { act: (s) => s.setGiftNotifDay('2026-06-10') },
  updateSettings: { act: (s) => s.updateSettings({ music: false }) },
  markHint: { act: (s) => s.markHint('oven') },
  beginRun: { act: (s) => s.beginRun() },
  // The store gives the ownership back on every device by itself; a creature it gives is progress (below).
  restorePurchases: { act: (s) => s.restorePurchases(['remove_ads']) },
  // Reading.
  data: { act: (s) => s.data },
  coins: { act: (s) => s.coins },
  berries: { act: (s) => s.berries },
  runsFinished: { act: (s) => s.runsFinished },
  wallet: { act: (s) => s.wallet },
  settings: { act: (s) => s.settings },
  clockBehind: { act: (s) => s.clockBehind },
  todayBest: { act: (s) => s.todayBest },
  recordHeight: { act: (s) => s.recordHeight },
  checkpoints: { act: (s) => s.checkpoints },
  checkpointAdsLeft: { act: (s) => s.checkpointAdsLeft },
  checkpointRows: { act: (s) => s.checkpointRows(true) },
  canShowInterstitial: { act: (s) => s.canShowInterstitial(RUN_FACTS) },
  removeAdsOfferDue: { act: (s) => s.removeAdsOfferDue(1) },
  canAskForReview: { act: (s) => s.canAskForReview('1.1', REVIEW_FACTS) },
  streakEntry: { act: (s) => s.streakEntry() },
  calendar: { act: (s) => s.calendar() },
  missions: { act: (s) => s.missions },
  claimableMissions: { act: (s) => s.claimableMissions },
  dailyInfo: { act: (s) => s.dailyInfo() },
  giftReady: { act: (s) => s.giftReady },
  msUntilGift: { act: (s) => s.msUntilGift },
  runTeam: { act: (s) => s.runTeam() },
  doublesLeft: { act: (s) => s.doublesLeft },
  ovenLeft: { act: (s) => s.ovenLeft },
  msUntilOven: { act: (s) => s.msUntilOven },
  canAffordBerries: { act: (s) => s.canAffordBerries(1) },
  starterPackOnHome: { act: (s) => s.starterPackOnHome },
  starterPackInShop: { act: (s) => s.starterPackInShop },
  starterPackMsLeft: { act: (s) => s.starterPackMsLeft },
  freeCoinsLeft: { act: (s) => s.freeCoinsLeft },
  shopCreatures: { act: (s) => s.shopCreatures },
  coinCreatureAffordable: { act: (s) => s.coinCreatureAffordable },
  unpaidTransactions: { act: (s) => s.unpaidTransactions([]) },
  tutorialRunPending: { act: (s) => s.tutorialRunPending },
  hasHint: { act: (s) => s.hasHint('oven') },
  onRunRecorded: { act: (s) => s.onRunRecorded(() => undefined) },
  debugTouched: { act: (s) => s.debugTouched },
  progressMark: { act: (s) => s.progressMark },
  adopt: { act: (s) => s.adopt({ rev: 9, id: 'c9', save: s.data }) },
  markCloudSent: { act: (s) => s.markCloudSent(2, 'c2', s.progressMark) },
  keepReplaced: { act: (s) => s.keepReplaced(s.data) },
  emit: 'private',
  tellRunListeners: 'private',
  noteRun: 'private',
  today: 'private',
  utcToday: 'private',
};

function cases(group: Record<string, Case | 'private'>): Array<[string, Case]> {
  return Object.entries(group).filter((entry): entry is [string, Case] => entry[1] !== 'private');
}

async function stateFor(c: Case): Promise<GameState> {
  const clock = { ms: T0 };
  const save = (c.save ?? richSave)(clock);
  return clean(save, clock);
}

describe('sync.dirty', () => {
  it('sorts every method and property of GameState into exactly one group', () => {
    const names = Object.getOwnPropertyNames(GameState.prototype).filter(
      (name) => name !== 'constructor',
    );
    const dirty = Object.keys(SETS_DIRTY);
    const kept = Object.keys(KEEPS_CLEAN);
    expect(dirty.filter((name) => kept.includes(name))).toEqual([]);
    expect([...dirty, ...kept].sort()).toEqual([...names].sort());
  });

  it('starts from a save with the flag down', async () => {
    const state = await stateFor({ act: () => undefined });
    expect(state.data.sync.dirty).toBe(false);
  });

  it.each(cases(SETS_DIRTY))('%s sets the flag', async (_name, c) => {
    const state = await stateFor(c);
    await c.act(state);
    expect(state.data.sync.dirty).toBe(true);
  });

  it.each(cases(KEEPS_CLEAN))('%s leaves the flag down', async (_name, c) => {
    const state = await stateFor(c);
    await c.act(state);
    expect(state.data.sync.dirty).toBe(false);
  });

  it('a restored starter pack that gives its creature sets the flag; one already owned does not', async () => {
    const gives = await stateFor({ act: () => undefined });
    expect(gives.restorePurchases(['starter_pack'])).toBe(true);
    expect(gives.data.sync.dirty).toBe(true);

    const clock = { ms: T0 };
    const owned = await clean(
      { ...richSave(clock), creatures: { ...richSave(clock).creatures, ...gives.data.creatures } },
      clock,
    );
    expect(owned.restorePurchases(['starter_pack', 'remove_ads'])).toBe(true);
    expect(owned.data.purchases).toEqual({ removeAds: true, starterPack: true });
    expect(owned.data.sync.dirty).toBe(false);
  });

  it('keeps the cloud copy on a reset and marks the progress changed', async () => {
    const clock = { ms: T0 };
    const save = richSave(clock);
    const state = await loadTestState(
      { ...save, sync: { cloudRev: 7, cloudId: 'abc', dirty: false } },
      clock,
    );
    state.resetProgress();
    expect(state.data.sync).toEqual({ cloudRev: 7, cloudId: 'abc', dirty: true });
  });
});
