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
import { clockWentBack } from '../util/clock';
import { withCreatureBought, withCreatureUpgraded, withTeam } from './creatures';
import { Hints } from './hints';
import { applyRun, type RunSummary } from './run-record';
import { SaveStore, type GameStateDeps, type LoadOptions, type LoadOutcome } from './save-store';
import { withAdWatched, withBerries, withCoins } from './wallet';

export { EMPTY_SUMMARY, type LevelUp, type RunSummary } from './run-record';
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

  /** Best classic height to beat in the current run; `null` before the first run ever ends. */
  get recordHeight(): number | null {
    const save = this.store.save;
    return save.stats.runs === 0 ? null : save.records.classicHeight;
  }

  // --- Runs ---

  /**
   * Registers a finished run: stats, records, the coins of the run, XP and the level rewards.
   * Berries are not touched here: they were added the moment they were earned (`addBerries`).
   * `startHeight` is the checkpoint a run began from; those layers earn no XP.
   */
  recordRun(result: RunResult, startHeight = 0): RunSummary {
    const firstRun = !this.hasHint('firstResults');
    const { save, summary } = applyRun(this.store.save, result, startHeight, firstRun);
    this.store.replace(save);
    return summary;
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

  // --- Writing ---

  /** Writes now if anything changed. Also called when the page goes to the background. */
  flush(): void {
    this.store.flush();
  }
}
