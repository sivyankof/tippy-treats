import type {
  BuyError,
  Cost,
  Currency,
  EconomyResult,
  UpgradeError,
  Wallet,
} from '../core/economy/economy';
import {
  txProcessed,
  unpaidTransactions,
  withTxRecorded,
  type KnownTransaction,
} from '../core/economy/purchase-tx';
import { doublesLeft, withDoubleUsed } from '../core/economy/double-coins';
import { exchangeBerries, spend } from '../core/economy/economy';
import { freshLeft } from '../core/economy/oven';
import {
  canShowInterstitial,
  shouldOfferRemoveAds,
  type InterstitialRunFacts,
} from '../core/economy/video-policy';
import {
  canAskForReview,
  withPlayDay,
  withReviewAsked,
  type ReviewContext,
} from '../core/progression/review';
import type { CheckpointHeight, CheckpointMethod, CheckpointRow } from '../core/zones/checkpoints';
import type { RunResult } from '../core/run/run-result';
import {
  coinCreatureAffordable,
  freeCoinsLeft,
  shopCreatures,
  starterPackInShop,
  starterPackMsLeft,
  starterPackOnHome,
  withFreeCoinsClaimed,
  withProductGranted,
  withPurchasesRestored,
  withStarterPackShown,
} from '../core/economy/shop';
import type { ProductKey } from '../data/economy/shop';
import type { TeamSlot } from '../core/tower/sim-types';
import { runTeam, type TeamIds } from '../core/creatures/team';
import type { HintId, Save } from '../core/save/schema';
import type { CreatureId } from '../data/creatures/creatures';
import type { CalendarCell, StreakEntry } from '../core/progression/streak';
import { now } from '../util/clock';
import { clockWentBack, localDay, msUntilLocalMidnight, utcDay } from '../util/calendar';
import {
  infoOf,
  withAttemptAdded,
  withAttemptStarted,
  withDailyForDay,
  type DailyInfo,
} from './daily';
import { giftWaitMs, isGiftReady, withGiftOpened } from './gift';
import {
  claimableMissions,
  type MissionClaim,
  withChestClaimed,
  withMissionClaimed,
  withMissionRerolled,
  withMissionsForDay,
} from './missions';
import { checkpointAdsLeftOf, checkpointRowsOf, withCheckpointPaid } from './checkpoints';
import { withCreatureBought, withCreatureUpgraded, withTeam } from './creatures';
import { Hints } from './hints';
import {
  shownTodayCount,
  withInterstitialShown,
  withOfferShown,
  withRunCounted,
  withSessionStarted,
} from './interstitial';
import { applyRun, type RunSummary } from './run-record';
import { applyRunProgress, NO_EXTRAS, type RunExtras } from './run-progress';
import {
  calendarOf,
  entryOf,
  withStreakClaimed,
  withStreakDeclined,
  withStreakRestored,
  type RestorePayment,
  type StreakClaim,
} from './streak';
import { withBakerLevel, withBakerLevelBumped, withCreaturesBumped } from './debug-grants';
import { withProgressReset } from './reset';
import { withCloudAdopted, withCloudSent } from './cloud/cloud-adopt';
import type { CloudCopy } from '../core/save/cloud-merge';
import { serializeSave } from '../core/save/load';
import { REPLACED_SAVE_PREFIX } from '../data/app/cloud';
import { withProgressChanged } from '../core/save/sync';
import { STORAGE_KEYS } from '../data/app/storage';
import { draftMatches, makeRunDraft, readRunDraft } from './run/run-draft';
import {
  earnEvents,
  levelUpEvents,
  runEvents,
  settingsEvents,
  spendEvents,
  teamEvents,
  unlockEvents,
  type TelemetryEvent,
} from './events/state-events';
import { UserPropertySync } from './events/user-properties';
import { runCoinCredits, type CreditSource } from './session-tally';
import { SaveStore, type GameStateDeps, type LoadOptions, type LoadOutcome } from './save-store';
import { withAdWatched, withBerries, withCoins } from './wallet';

export { EMPTY_SUMMARY, type LevelUp, type OvenSummary, type RunSummary } from './run-record';
export type { MissionClaim } from './missions';
export type { DailyInfo } from './daily';
export type { RunExtras } from './run-progress';
export type { RestorePayment, StreakClaim } from './streak';
export type { GameStateDeps, LoadInfo, LoadOptions, LoadOutcome, Scheduler } from './save-store';

export type SettingsPatch = Partial<
  Pick<Save['settings'], 'music' | 'sfx' | 'haptics' | 'reducedFx' | 'lang' | 'notifications'>
>;

/**
 * The only owner of the save while the game runs (docs/08-architecture.md, section 5): the
 * rest of the game reads it here and changes it through these methods. Each method calls a pure
 * rule over the save and stores the result (a change of the progress through `progress`, which
 * sets `sync.dirty`; `state/sync-dirty.test.ts` sorts every method into one of the two); the `SaveStore` marks it dirty and writes it
 * `SAVE_WRITE_DEBOUNCE_MS` later, or at once on `flush()`.
 */
export class GameState {
  private readonly store: SaveStore;
  private readonly hints = new Hints();
  /** UTC day the running daily attempt started on; memory only, a closed page forgets it. */
  private dailyAttemptDay = '';
  private readonly runListeners = new Set<(save: Readonly<Save>) => void>();
  /** A debug writer changed the progress in this launch (memory only). */
  private debugWritten = false;
  /** Changes of the progress in this launch (memory only): a cloud write tells by it whether the progress moved meanwhile. */
  private progressCount = 0;
  /** A run draft was written in this launch and not removed yet (memory only). */
  private draftKept = false;

  constructor(private readonly deps: GameStateDeps) {
    const properties = deps.telemetry ? new UserPropertySync(deps.telemetry) : null;
    this.store = new SaveStore(
      deps,
      properties
        ? (save) => {
            try {
              properties.sync(save, (deps.now ?? now)());
            } catch {
              // The user properties are a convenience; the save must not suffer for them.
            }
          }
        : undefined,
    );
  }

  /** Reads the save from the storage; see `SaveStore.load`. Never throws. */
  load(options: LoadOptions = {}): Promise<LoadOutcome> {
    return this.store.load(options);
  }

  // --- Reading ---

  /** Read-only view of the save; do not keep it, it is replaced on every change. */
  get data(): Readonly<Save> {
    return this.store.save;
  }

  get coins(): number {
    return this.store.save.coins;
  }

  get berries(): number {
    return this.store.save.berries;
  }

  /** Runs that reached the save so far (`stats.runs`); a run in progress is not among them. */
  get runsFinished(): number {
    return this.store.save.stats.runs;
  }

  get wallet(): Wallet {
    return { coins: this.store.save.coins, berries: this.store.save.berries };
  }

  get settings(): Readonly<Save['settings']> {
    return this.store.save.settings;
  }

  /** The clock is behind the last launch by more than the tolerance (docs/09-services-analytics.md, section 9). */
  get clockBehind(): boolean {
    return clockWentBack(this.deps.realNow(), this.store.save.lastSeenAt);
  }

  /** Best classic height of the current local day; 0 before the first classic run of the day. */
  get todayBest(): number {
    const today = this.store.save.today;
    return today.day === localDay((this.deps.now ?? now)()) ? today.bestHeight : 0;
  }

  /** Best classic height to beat in the current run; `null` before the first run ever ends. */
  get recordHeight(): number | null {
    const save = this.store.save;
    return save.stats.runs === 0 ? null : save.records.classicHeight;
  }

  // --- Runs ---

  /**
   * Registers a finished run: stats, records, the coins of the run, XP and the level rewards.
   * Berries are not touched here: they were added the moment they were earned (`addBerries`).
   * `startHeight` is the checkpoint a run began from; those layers earn no XP. `extras` are the
   * counters of the run tally; the run also counts for the streak, the missions and, in the
   * daily tower, for the daily tiers.
   */
  recordRun(result: RunResult, startHeight = 0, extras: RunExtras = NO_EXTRAS): RunSummary {
    const firstRun = !this.hasHint('firstResults');
    const today = this.today();
    const refreshed = withDailyForDay(
      withMissionsForDay(this.store.save, today, this.clockBehind),
      this.utcToday(),
    );
    const applied = applyRun(refreshed, result, startHeight, firstRun, today, this.clockBehind);
    const progress = applyRunProgress(
      applied.save,
      result,
      extras,
      today,
      this.clockBehind,
      this.dailyAttemptDay,
      this.utcToday(),
      startHeight,
    );
    const next = withRunCounted(progress.save);
    const summary = {
      ...applied.summary,
      missions: progress.missions,
      dailyTiers: progress.dailyTiers,
      dailyStale: progress.dailyStale,
    };
    this.noteRun(this.store.save, next, summary, extras);
    const before = this.store.save;
    this.progress(next);
    this.emit(runEvents(before, next, result, summary, extras));
    this.tellRunListeners();
    // The run is in the save now: its draft goes, once the save is on its way to the disk.
    if (this.draftKept) {
      this.store.flush();
      void this.dropRunDraft();
    }
    return summary;
  }

  // --- Run draft (docs/08-architecture.md, section 5) ---

  /**
   * Keeps the running run beside the save while the app is in the background, where the system
   * may unload it without a page close: `recoverRunDraft` records it at the next launch.
   */
  async keepRunDraft(result: RunResult, startHeight: number, extras: RunExtras): Promise<void> {
    const draft = makeRunDraft(this.store.save, result, startHeight, extras, this.dailyAttemptDay);
    this.draftKept = true;
    await this.store.keepAside(STORAGE_KEYS.runDraft, JSON.stringify(draft));
  }

  /** The app is back with the run alive, or the run was recorded: its draft goes. */
  async dropRunDraft(): Promise<void> {
    this.draftKept = false;
    await this.store.dropAside(STORAGE_KEYS.runDraft);
  }

  /**
   * At launch, after the save was read: records as a quit the run a draft left (the app was
   * unloaded in the background), if the draft still belongs to this save; true when it did. The
   * draft is removed either way.
   */
  async recoverRunDraft(): Promise<boolean> {
    const text = await this.store.readAside(STORAGE_KEYS.runDraft);
    if (text === null) return false;
    const draft = readRunDraft(text);
    let recorded = false;
    if (draft !== null && draftMatches(draft, this.store.save)) {
      const attemptDay = this.dailyAttemptDay;
      this.dailyAttemptDay = draft.attemptDay;
      try {
        this.recordRun(draft.result, draft.startHeight, draft.extras);
        recorded = true;
      } finally {
        this.dailyAttemptDay = attemptDay;
      }
      this.store.flush();
    }
    await this.dropRunDraft();
    return recorded;
  }

  /**
   * Calls `listener` with the save after every run that reached it (the game services send the
   * scores from here); returns the unsubscribe. A listener that throws never reaches the save.
   */
  onRunRecorded(listener: (save: Readonly<Save>) => void): () => void {
    this.runListeners.add(listener);
    return () => this.runListeners.delete(listener);
  }

  // --- Checkpoints ---

  /** Opened checkpoint heights, lowest first. */
  get checkpoints(): readonly CheckpointHeight[] {
    return this.store.save.checkpoints as CheckpointHeight[];
  }

  /** Checkpoint starts a rewarded ad may still pay today. */
  get checkpointAdsLeft(): number {
    return checkpointAdsLeftOf(this.store.save, this.today(), this.clockBehind);
  }

  /** The rows of the start choice; `adReady`: the ad service has a rewarded ad loaded. */
  checkpointRows(adReady: boolean): CheckpointRow[] {
    return checkpointRowsOf(this.store.save, adReady, this.today(), this.clockBehind);
  }

  /**
   * Pays for a start from an opened checkpoint: berries are spent, an ad start is only counted
   * (the caller shows the ad). False, nothing changed, when it is not allowed or the berries are short.
   */
  payCheckpoint(height: CheckpointHeight, method: CheckpointMethod): boolean {
    const next = withCheckpointPaid(
      this.store.save,
      height,
      method,
      this.today(),
      this.clockBehind,
    );
    if (!next) return false;
    this.progress(next);
    return true;
  }

  // --- Interstitial ads ---

  /** The app was launched: the session counter grows; call once per launch, after the save is loaded. */
  beginSession(): void {
    this.store.replace(withSessionStarted(this.store.save));
  }

  /** The rules of docs/05, section 6 for the player leaving the results of the run described by `facts`. */
  canShowInterstitial(facts: InterstitialRunFacts): boolean {
    const { ads, purchases, createdAt } = this.store.save;
    return canShowInterstitial({
      ...facts,
      removeAds: purchases.removeAds,
      session: ads.sessions,
      createdAt,
      runsFinished: this.runsFinished,
      clockBehind: this.clockBehind,
      runsSince: ads.runsSinceInterstitial,
      nowMs: (this.deps.now ?? now)(),
      lastShownAt: ads.lastInterstitialAt,
      shownToday: shownTodayCount(this.store.save, this.today(), this.clockBehind),
    });
  }

  /** An interstitial was shown just now. */
  noteInterstitialShown(): void {
    this.emit([{ name: 'ad_interstitial_show' }]);
    this.store.replace(
      withInterstitialShown(
        this.store.save,
        (this.deps.now ?? now)(),
        this.today(),
        this.clockBehind,
      ),
    );
  }

  /** The "No ads" offer is due on Home: `shownInSession` interstitials were shown, none offered today. */
  removeAdsOfferDue(shownInSession: number): boolean {
    const { ads, purchases } = this.store.save;
    return shouldOfferRemoveAds(purchases.removeAds, shownInSession, ads.offerDay, this.today());
  }

  /** The "No ads" offer was shown today: it does not come again before tomorrow. */
  noteRemoveAdsOffered(): void {
    this.store.replace(withOfferShown(this.store.save, this.today()));
  }

  // --- Rating request ---

  /** The game was launched or came back to the front: a new local day of play is counted (once per day). */
  notePlayDay(): void {
    const next = withPlayDay(this.store.save.review, this.today(), this.clockBehind);
    if (next !== this.store.save.review) this.store.replace({ ...this.store.save, review: next });
  }

  /** The rules of docs/04, section 10: the system rating window may be asked for on the results `facts` describe. */
  canAskForReview(
    version: string,
    facts: Pick<ReviewContext, 'daily' | 'newRecord' | 'newCreature' | 'interstitialDue' | 'busy'>,
  ): boolean {
    return canAskForReview({
      ...facts,
      review: this.store.save.review,
      version,
      nowMs: (this.deps.now ?? now)(),
      runsFinished: this.runsFinished,
      clockBehind: this.clockBehind,
    });
  }

  /** The system rating window is being asked for in game version `version`: not again for this version and for 30 days. */
  noteReviewAsked(version: string): void {
    const review = withReviewAsked(this.store.save.review, version, (this.deps.now ?? now)());
    this.store.replace({ ...this.store.save, review });
  }

  // --- Days ---

  /** Deals the missions of the local day and starts the daily slice of the UTC day when they are new. */
  refreshDay(): void {
    const next = withDailyForDay(
      withMissionsForDay(this.store.save, this.today(), this.clockBehind),
      this.utcToday(),
    );
    if (next !== this.store.save) this.store.replace(next);
  }

  // --- Streak ---

  streakEntry(): StreakEntry {
    return entryOf(this.store.save, this.today(), this.clockBehind);
  }

  calendar(): CalendarCell[] {
    return calendarOf(this.store.save, this.today());
  }

  /** Pays today's calendar reward; null when there is nothing to claim. */
  claimStreak(): StreakClaim | null {
    const claimed = withStreakClaimed(this.store.save, this.today(), this.clockBehind);
    if (!claimed) return null;
    const before = this.store.save;
    this.commit(claimed.save, 'streak');
    this.emit([
      {
        name: 'streak_day',
        params: { count: claimed.save.streak.count, cycle: claimed.save.streak.cycle },
      },
      ...unlockEvents(before, claimed.save, () => 'streak'),
    ]);
    return claimed.claim;
  }

  /** Forgives the missed day; false (nothing charged) when it is not allowed or the berries are short. */
  restoreStreak(payment: RestorePayment): boolean {
    const before = this.store.save;
    const next = withStreakRestored(before, this.today(), this.clockBehind, payment);
    if (!next) return false;
    this.progress(next);
    this.emit([
      { name: 'streak_restore', params: { method: payment } },
      ...spendEvents(before, next, 'streak_restore'),
    ]);
    return true;
  }

  /** The player gives the streak up: it starts over. */
  declineStreak(): void {
    const before = this.store.save;
    const next = withStreakDeclined(before, this.today());
    if (next === before) return;
    this.progress(next);
    this.emit([{ name: 'streak_lost', params: { count: before.streak.count } }]);
  }

  // --- Missions ---

  /** The missions of the day as of the last `refreshDay`. */
  get missions(): Readonly<Save['missions']> {
    return this.store.save.missions;
  }

  get claimableMissions(): number {
    return claimableMissions(this.store.save);
  }

  /** Pays the coins and XP of a completed mission; null when it cannot be claimed. */
  claimMission(index: number): MissionClaim | null {
    const claimed = withMissionClaimed(this.store.save, index);
    if (!claimed) return null;
    const before = this.store.save;
    this.commit(claimed.save, 'mission');
    this.emit([
      ...levelUpEvents(claimed.levelUps),
      ...unlockEvents(before, claimed.save, () => 'level'),
    ]);
    return { coins: claimed.coins, xp: claimed.xp, levelUps: claimed.levelUps };
  }

  /** Swaps an open mission for another one, once a day; false when not allowed. */
  rerollMission(index: number): boolean {
    const next = withMissionRerolled(this.store.save, index, this.today());
    if (!next) return false;
    this.progress(next);
    return true;
  }

  /** Pays the chest of the day once all missions are claimed; 0 berries otherwise. */
  claimChest(): number {
    const claimed = withChestClaimed(this.store.save);
    if (!claimed) return 0;
    this.commit(claimed.save, 'chest');
    this.emit([{ name: 'mission_chest' }]);
    return claimed.berries;
  }

  // --- Daily tower ---

  dailyInfo(): DailyInfo {
    const clock = (this.deps.now ?? now)();
    return infoOf(this.store.save, utcDay(clock), clock);
  }

  /** Spends an attempt of today and remembers its UTC day; false when locked or none is left. */
  startDailyAttempt(): boolean {
    const day = this.utcToday();
    const next = withAttemptStarted(this.store.save, day);
    if (!next) return false;
    this.dailyAttemptDay = day;
    this.progress(next);
    return true;
  }

  /** The extra attempt of a watched ad; false when it was already used today. */
  addDailyAttempt(): boolean {
    const next = withAttemptAdded(this.store.save, this.utcToday());
    if (!next) return false;
    this.progress(next);
    return true;
  }

  // --- Gift ---

  get giftReady(): boolean {
    return isGiftReady(this.store.save, (this.deps.now ?? now)(), this.clockBehind);
  }

  get msUntilGift(): number {
    return giftWaitMs(this.store.save, (this.deps.now ?? now)());
  }

  /** Opens the box and pays its coins; null when it is not ready. The ad double is paid with `addCoins`. */
  openGift(): number | null {
    const opened = withGiftOpened(this.store.save, (this.deps.now ?? now)(), this.clockBehind);
    if (!opened) return null;
    this.commit(opened.save, 'gift');
    return opened.coins;
  }

  // --- Team and creatures ---

  /** The team of a normal run: owned creatures at their levels, in the open slots. */
  runTeam(): Array<TeamSlot | null> {
    const save = this.store.save;
    return runTeam(save.team, save.creatures, save.bakerLevel);
  }

  /** A debug writer (level, runs, creatures) changed the progress in this launch: the game services get nothing then. */
  get debugTouched(): boolean {
    return this.debugWritten;
  }

  /** Dev soak only: sets the baker level, which opens the shop, the upgrades and the team slots. */
  debugSetBakerLevel(level: number): void {
    this.debugWritten = true;
    this.progress(withBakerLevel(this.store.save, level));
  }

  /** Dev soak only: sets the finished run count, so Home shows what it shows after the first runs. */
  debugSetRuns(runs: number): void {
    this.debugWritten = true;
    const save = this.store.save;
    this.progress({ ...save, stats: { ...save.stats, runs: Math.max(0, Math.floor(runs)) } });
  }

  /** Dev only: baker level +1, level XP reset, no reward. */
  debugBumpBakerLevel(): void {
    this.debugWritten = true;
    this.progress(withBakerLevelBumped(this.store.save));
  }

  /** Dev only: every creature +1 level up to the max; creatures not owned yet become level 1. */
  debugBumpCreatures(): void {
    this.debugWritten = true;
    this.progress(withCreaturesBumped(this.store.save));
  }

  /** Saves the team; creatures the player does not own and repeats become empty slots. */
  setTeam(team: TeamIds): void {
    const before = this.store.save;
    const next = withTeam(before, team);
    this.progress(next);
    this.emit(teamEvents(before, next));
  }

  buyCreature(id: CreatureId, currency: Currency): EconomyResult<null, BuyError> {
    const before = this.store.save;
    const result = withCreatureBought(before, id, currency);
    if (!result.ok) return result;
    this.progress(result.value);
    this.emit([
      ...spendEvents(before, result.value, `creature_${id}`),
      ...unlockEvents(before, result.value, () => `shop_${currency}`),
    ]);
    return { ok: true, value: null };
  }

  upgradeCreature(id: CreatureId): EconomyResult<number, UpgradeError> {
    const before = this.store.save;
    const result = withCreatureUpgraded(before, id);
    if (!result.ok) return result;
    this.progress(result.value.save);
    this.emit([
      ...spendEvents(before, result.value.save, `upgrade_${id}`),
      { name: 'creature_upgrade', params: { creature: id, level: result.value.level } },
    ]);
    return { ok: true, value: result.value.level };
  }

  // --- Wallet ---

  /**
   * Coins of a reward outside a run (the doubled coins of a rewarded ad, gifts). `source` is for
   * the dev tally only; the default is the debug panel button.
   */
  addCoins(coins: number, source: CreditSource = 'debug'): void {
    const next = withCoins(this.store.save, coins);
    if (next !== this.store.save) this.commit(next, source);
  }

  /** "x2 coins" ads still allowed today. */
  get doublesLeft(): number {
    return doublesLeft(this.store.save.doubles, this.today(), this.clockBehind);
  }

  /** Fresh oven layers left today (the bar of Home and the results). */
  get ovenLeft(): number {
    return freshLeft(this.store.save.oven, this.today(), this.clockBehind);
  }

  /** Time until the fresh oven lights up again: the next local midnight. */
  get msUntilOven(): number {
    return msUntilLocalMidnight((this.deps.now ?? now)());
  }

  /**
   * Pays the doubled coins of a watched ad and counts it for today; false (nothing paid) when
   * today's doublings are used up.
   */
  claimDoubleCoins(coins: number): boolean {
    if (this.doublesLeft <= 0) return false;
    const doubles = withDoubleUsed(this.store.save.doubles, this.today(), this.clockBehind);
    const next = withCoins({ ...this.store.save, doubles }, coins);
    this.commit(next, 'ad_double');
    return true;
  }

  /** A rewarded ad was watched to the end. */
  countAdWatched(): void {
    this.store.replace(withAdWatched(this.store.save));
  }

  /** The tracking explainer and the system question were gone through; they are not shown again. */
  noteAttAsked(): void {
    const save = this.store.save;
    if (save.consent.attAsked) return;
    this.store.replace({ ...save, consent: { ...save.consent, attAsked: true } });
    this.store.flush();
  }

  /** Berries go in the moment they are earned, so they can pay for the continue of the same run. */
  addBerries(berries: number, source: CreditSource = 'run_berries'): void {
    const next = withBerries(this.store.save, berries);
    if (next !== this.store.save) this.commit(next, source);
  }

  /** Pays `cost`; false (nothing taken) when the wallet is not enough. A balance never goes below zero. */
  spend(cost: Cost): boolean {
    const paid = spend(this.store.save, cost);
    if (!paid) return false;
    this.progress(paid);
    return true;
  }

  /** `item` says what the berries paid for (the `currency_spend` event). */
  spendBerries(berries: number, item = 'berries'): boolean {
    const before = this.store.save;
    if (berries < 0 || !this.spend({ berries })) return false;
    this.emit(spendEvents(before, this.store.save, item));
    return true;
  }

  canAffordBerries(berries: number): boolean {
    return berries >= 0 && this.store.save.berries >= berries;
  }

  // --- Shop ---

  /** Home offers the starter pack: the first runs are over, it is not bought and its window is on. */
  get starterPackOnHome(): boolean {
    return starterPackOnHome(this.store.save, (this.deps.now ?? now)());
  }

  /** The shop offers the starter pack: not bought, and its window has not started or is still on. */
  get starterPackInShop(): boolean {
    return starterPackInShop(this.store.save, (this.deps.now ?? now)());
  }

  /** Time left of the starter pack window; null while it has not started (no timer then). */
  get starterPackMsLeft(): number | null {
    return starterPackMsLeft(this.store.save, (this.deps.now ?? now)());
  }

  /** The starter pack button has just appeared on Home: its window starts now if it has not yet. */
  noteStarterPackShown(): void {
    const next = withStarterPackShown(this.store.save, (this.deps.now ?? now)());
    if (next !== this.store.save) this.progress(next);
  }

  /** Free-coin ads left today (local day). */
  get freeCoinsLeft(): number {
    return freeCoinsLeft(this.store.save.shop, this.today());
  }

  /** The creatures the shop sells for coins at the baker level, cheapest first. */
  get shopCreatures(): Array<{ id: CreatureId; price: number }> {
    return shopCreatures(this.store.save);
  }

  /** A creature of the shop can be bought for coins now (the red dot on Shop). */
  get coinCreatureAffordable(): boolean {
    return coinCreatureAffordable(this.store.save);
  }

  /** Pays the coins of a watched free-coin ad; false when today's ads are used up. */
  claimFreeCoins(): boolean {
    const next = withFreeCoinsClaimed(this.store.save, this.today());
    if (!next) return false;
    this.commit(next, 'shop_free');
    return true;
  }

  /** Swaps a pack of berries (10, 50 or 100) for coins; false (nothing taken) when the berries are short. */
  exchangeBerries(berries: number): boolean {
    const before = this.store.save;
    const result = exchangeBerries(before, berries);
    if (!result.ok) return false;
    this.commit({ ...before, ...result.value }, 'berry_exchange');
    this.emit(spendEvents(before, this.store.save, 'berry_exchange'));
    return true;
  }

  /**
   * Pays out a purchase the store confirmed; false when a one-time product was already given or
   * the store transaction was already paid out. The transaction is remembered in the same save.
   */
  grantProduct(key: ProductKey, transactionIds: readonly string[] = []): boolean {
    const before = this.store.save;
    if (txProcessed(before, transactionIds)) return false;
    let next = withProductGranted(before, key);
    if (!next) return false;
    next = withTxRecorded(next, transactionIds);
    this.commit(next, 'purchase');
    this.emit(unlockEvents(before, next, () => 'purchase'));
    return true;
  }

  /** The completed store transactions that were never paid out here (see `unpaidTransactions`). */
  unpaidTransactions(transactions: readonly KnownTransaction[]): KnownTransaction[] {
    return unpaidTransactions(this.store.save, transactions, this.deps.realNow());
  }

  /**
   * Brings the save in line with the one-time products the store says are owned; true when it
   * changed. The ownership alone is not progress (the store gives it back on every device, and
   * a second device would otherwise lose the silent cloud take): only a creature it gives sets
   * `sync.dirty`.
   */
  restorePurchases(owned: readonly ProductKey[]): boolean {
    const before = this.store.save;
    const next = withPurchasesRestored(before, owned);
    if (next === before) return false;
    if (next.creatures !== before.creatures) this.progress(next);
    else this.store.replace(next);
    return true;
  }

  // --- Hints ---

  /**
   * Called when a run starts: true when it is the tutorial run. The tutorial stays pending
   * (restarts included) until the director marks it done. `force` comes from `?tutorial=` and
   * holds for this page load only, nothing of it is saved: `true` shows every hint fresh on
   * every run, `false` counts every hint as shown.
   */
  beginRun(force?: boolean): boolean {
    this.hints.force(force);
    return this.tutorialRunPending;
  }

  /** The next classic run would be the tutorial run (nothing is changed by asking). */
  get tutorialRunPending(): boolean {
    return !this.hasHint('tutorial');
  }

  hasHint(id: HintId): boolean {
    return this.hints.has(this.store.save, id);
  }

  markHint(id: HintId): void {
    const next = this.hints.mark(this.store.save, id);
    if (next === null) return;
    this.store.replace(next);
    this.emit([{ name: 'tutorial_step', params: { step: id } }]);
  }

  // --- Notifications ---

  /** The permission question was asked (or the system asked through the settings): never again by itself. */
  markNotifAsked(): void {
    const save = this.store.save;
    if (save.consent.notifAsked) return;
    this.store.replace({ ...save, consent: { ...save.consent, notifAsked: true } });
  }

  /** Stores the local day of a gift notification that has gone out (`notif.giftDay`, docs/04, section 7). */
  setGiftNotifDay(day: string): void {
    const save = this.store.save;
    if (save.notif.giftDay !== day) this.store.replace({ ...save, notif: { giftDay: day } });
  }

  // --- Settings ---

  updateSettings(patch: SettingsPatch): void {
    const save = this.store.save;
    const settings = { ...save.settings, ...patch };
    this.store.replace({ ...save, settings });
    this.emit(settingsEvents(save.settings, settings));
  }

  /** Wipes the progress (a new save as at the first launch) and writes it at once; see `withProgressReset`. */
  resetProgress(): void {
    this.progress(withProgressReset(this.store.save, this.deps.realNow()));
    this.store.flush();
  }

  // --- Cloud copy (docs/08-architecture.md, section 5, "Облачная копия") ---

  /** A mark of the progress now; `markCloudSent` compares it to tell a change made while a copy was on its way. */
  get progressMark(): number {
    return this.progressCount;
  }

  /**
   * Takes the cloud copy instead of the local save (see `withCloudAdopted`) and writes it at once.
   * The caller then checks the purchases and builds Home again.
   */
  adopt(copy: Pick<CloudCopy, 'rev' | 'id' | 'save'>): void {
    this.progressCount += 1;
    this.store.replace(withCloudAdopted(this.store.save, copy));
    this.store.flush();
  }

  /** The copy `rev`/`id` built at `mark` reached the cloud; the progress counts as changed if it moved since. */
  markCloudSent(rev: number, id: string, mark: number): void {
    this.store.replace(withCloudSent(this.store.save, rev, id, mark !== this.progressCount));
    this.store.flush();
  }

  /** Keeps a save that lost a choice on the device, under `save_replaced_<time>`. */
  keepReplaced(save: Readonly<Save>): Promise<boolean> {
    const key = `${REPLACED_SAVE_PREFIX}${this.deps.realNow()}`;
    return this.store.keepAside(key, serializeSave(save as Save));
  }

  /**
   * Swaps in a save whose progress changed: `sync.dirty` is set, so the cloud copy is known to
   * be behind (docs/08-architecture.md, section 5). Every other change goes through `store.replace`.
   */
  private progress(next: Save): void {
    this.progressCount += 1;
    this.store.replace(withProgressChanged(next));
  }

  /**
   * The one place where credits are told to the dev tally: swaps in `next` and counts what the
   * wallet gained by it for `source`. Without a tally (production) it is a plain `replace`.
   */
  private commit(next: Save, source: CreditSource): void {
    const before = this.store.save;
    this.deps.tally?.addWalletChange(source, before, next);
    this.progress(next);
    this.emit(earnEvents(before, next, source));
  }

  private tellRunListeners(): void {
    for (const listener of [...this.runListeners]) {
      try {
        listener(this.store.save);
      } catch {
        // The game services are a decoration of the run: their failure is not the save's.
      }
    }
  }

  /** Sends events to the analytics; a failure there never reaches the save. */
  private emit(events: readonly TelemetryEvent[]): void {
    const telemetry = this.deps.telemetry;
    if (!telemetry) return;
    try {
      for (const event of events) telemetry.logEvent(event.name, event.params);
    } catch {
      // Analytics is a decoration of the game: its failure is not the save's.
    }
  }

  /** Splits what a finished run paid: its own coins by source, level rewards, daily tiers, XP. */
  private noteRun(before: Save, after: Save, summary: RunSummary, extras: RunExtras): void {
    const tally = this.deps.tally;
    if (!tally) return;
    let levelCoins = 0;
    for (const up of summary.levelUps) {
      levelCoins += (up.reward.coins ?? 0) + (up.duplicate?.coins ?? 0);
      tally.add('berries', 'level_reward', (up.reward.berries ?? 0) + (up.duplicate?.berries ?? 0));
    }
    tally.add('coins', 'level_reward', levelCoins);
    tally.add('berries', 'lap_reward', summary.lapBerries);
    let tierCoins = 0;
    for (const tier of summary.dailyTiers) {
      tierCoins += tier.cost.coins ?? 0;
      tally.add('berries', 'daily_tier', tier.cost.berries ?? 0);
    }
    tally.add('coins', 'daily_tier', tierCoins);
    const runCoins = after.coins - before.coins - levelCoins - tierCoins;
    for (const [source, amount] of runCoinCredits(runCoins, extras.coinSources)) {
      tally.add('coins', source, amount);
    }
    tally.add('xp', 'run_xp', summary.xpGained);
  }

  /** Local day of the game clock (streak, missions). */
  private today(): string {
    return localDay((this.deps.now ?? now)());
  }

  /** UTC day of the game clock (daily tower). */
  private utcToday(): string {
    return utcDay((this.deps.now ?? now)());
  }

  // --- Writing ---

  /** Writes now if anything changed. Also called when the page goes to the background. */
  flush(): void {
    this.store.flush();
  }
}
