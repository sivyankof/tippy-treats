import type {
  BuyError,
  Cost,
  Currency,
  EconomyResult,
  UpgradeError,
  Wallet,
} from '../core/economy';
import { spend } from '../core/economy';
import type { RunResult } from '../core/run-result';
import type { TeamSlot } from '../core/sim-types';
import { runTeam, type TeamIds } from '../core/team';
import type { HintId, Save } from '../core/save/schema';
import type { CreatureId } from '../data/creatures';
import type { CalendarCell, StreakEntry } from '../core/streak';
import { clockWentBack, localDay, now, utcDay } from '../util/clock';
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
  withChestClaimed,
  withMissionClaimed,
  withMissionRerolled,
  withMissionsForDay,
} from './missions';
import { withCreatureBought, withCreatureUpgraded, withTeam } from './creatures';
import { Hints } from './hints';
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
import { SaveStore, type GameStateDeps, type LoadOptions, type LoadOutcome } from './save-store';
import { withAdWatched, withBerries, withCoins } from './wallet';

export { EMPTY_SUMMARY, type LevelUp, type RunSummary } from './run-record';
export type { DailyInfo } from './daily';
export type { RunExtras } from './run-progress';
export type { RestorePayment, StreakClaim } from './streak';
export type { GameStateDeps, LoadInfo, LoadOptions, LoadOutcome, Scheduler } from './save-store';

export type SettingsPatch = Partial<
  Pick<Save['settings'], 'music' | 'sfx' | 'haptics' | 'reducedFx' | 'lang'>
>;

/**
 * The only owner of the save while the game runs (docs/08-architecture.md, section 5): the
 * rest of the game reads it here and changes it through these methods. Each method calls a pure
 * rule over the save and stores the result; the `SaveStore` marks it dirty and writes it
 * `SAVE_WRITE_DEBOUNCE_MS` later, or at once on `flush()`.
 */
export class GameState {
  private readonly store: SaveStore;
  private readonly hints = new Hints();
  /** UTC day the running daily attempt started on; memory only, a closed page forgets it. */
  private dailyAttemptDay = '';

  constructor(private readonly deps: GameStateDeps) {
    this.store = new SaveStore(deps);
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
    const applied = applyRun(refreshed, result, startHeight, firstRun, today);
    const progress = applyRunProgress(
      applied.save,
      result,
      extras,
      today,
      this.clockBehind,
      this.dailyAttemptDay,
    );
    this.store.replace(progress.save);
    return { ...applied.summary, missions: progress.missions, dailyTiers: progress.dailyTiers };
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
    this.store.replace(claimed.save);
    return claimed.claim;
  }

  /** Forgives the missed day; false (nothing charged) when it is not allowed or the berries are short. */
  restoreStreak(payment: RestorePayment): boolean {
    const next = withStreakRestored(this.store.save, this.today(), this.clockBehind, payment);
    if (!next) return false;
    this.store.replace(next);
    return true;
  }

  /** The player gives the streak up: it starts over. */
  declineStreak(): void {
    const next = withStreakDeclined(this.store.save, this.today());
    if (next !== this.store.save) this.store.replace(next);
  }

  // --- Missions ---

  /** The missions of the day as of the last `refreshDay`. */
  get missions(): Readonly<Save['missions']> {
    return this.store.save.missions;
  }

  get claimableMissions(): number {
    return claimableMissions(this.store.save);
  }

  /** Pays the coins of a completed mission; 0 when it cannot be claimed. */
  claimMission(index: number): number {
    const claimed = withMissionClaimed(this.store.save, index);
    if (!claimed) return 0;
    this.store.replace(claimed.save);
    return claimed.coins;
  }

  /** Swaps an open mission for another one, once a day; false when not allowed. */
  rerollMission(index: number): boolean {
    const next = withMissionRerolled(this.store.save, index, this.today());
    if (!next) return false;
    this.store.replace(next);
    return true;
  }

  /** Pays the chest of the day once all missions are claimed; 0 berries otherwise. */
  claimChest(): number {
    const claimed = withChestClaimed(this.store.save);
    if (!claimed) return 0;
    this.store.replace(claimed.save);
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
    this.store.replace(next);
    return true;
  }

  /** The extra attempt of a watched ad; false when it was already used today. */
  addDailyAttempt(): boolean {
    const next = withAttemptAdded(this.store.save, this.utcToday());
    if (!next) return false;
    this.store.replace(next);
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
    this.store.replace(opened.save);
    return opened.coins;
  }

  // --- Team and creatures ---

  /** The team of a normal run: owned creatures at their levels, in the open slots. */
  runTeam(): Array<TeamSlot | null> {
    const save = this.store.save;
    return runTeam(save.team, save.creatures, save.bakerLevel);
  }

  /** Saves the team; creatures the player does not own and repeats become empty slots. */
  setTeam(team: TeamIds): void {
    this.store.replace(withTeam(this.store.save, team));
  }

  buyCreature(id: CreatureId, currency: Currency): EconomyResult<null, BuyError> {
    const result = withCreatureBought(this.store.save, id, currency);
    if (!result.ok) return result;
    this.store.replace(result.value);
    return { ok: true, value: null };
  }

  upgradeCreature(id: CreatureId): EconomyResult<number, UpgradeError> {
    const result = withCreatureUpgraded(this.store.save, id);
    if (!result.ok) return result;
    this.store.replace(result.value.save);
    return { ok: true, value: result.value.level };
  }

  // --- Wallet ---

  /** Coins of a reward outside a run (the doubled coins of a rewarded ad, gifts). */
  addCoins(coins: number): void {
    const next = withCoins(this.store.save, coins);
    if (next !== this.store.save) this.store.replace(next);
  }

  /** A rewarded ad was watched to the end. */
  countAdWatched(): void {
    this.store.replace(withAdWatched(this.store.save));
  }

  /** Berries go in the moment they are earned, so they can pay for the continue of the same run. */
  addBerries(berries: number): void {
    const next = withBerries(this.store.save, berries);
    if (next !== this.store.save) this.store.replace(next);
  }

  /** Pays `cost`; false (nothing taken) when the wallet is not enough. A balance never goes below zero. */
  spend(cost: Cost): boolean {
    const paid = spend(this.store.save, cost);
    if (!paid) return false;
    this.store.replace(paid);
    return true;
  }

  spendBerries(berries: number): boolean {
    return berries >= 0 && this.spend({ berries });
  }

  canAffordBerries(berries: number): boolean {
    return berries >= 0 && this.store.save.berries >= berries;
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
    return !this.hasHint('tutorial');
  }

  hasHint(id: HintId): boolean {
    return this.hints.has(this.store.save, id);
  }

  markHint(id: HintId): void {
    const next = this.hints.mark(this.store.save, id);
    if (next !== null) this.store.replace(next);
  }

  // --- Settings ---

  updateSettings(patch: SettingsPatch): void {
    const save = this.store.save;
    this.store.replace({ ...save, settings: { ...save.settings, ...patch } });
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
