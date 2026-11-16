/**
 * Day-by-day economy model (analysis only, nothing here is used by the game).
 *
 * 1. Plays bot runs per profile and team with the real sim and keeps per-run samples
 *    (height, coins by source, berries, duration). The samples can be cached with `--cache=path`.
 * 2. Prices every sample with an economy and walks days: runs fill the daily play time, fixed
 *    daily income is added, coins are spent greedily on creatures and upgrades, berries are
 *    exchanged for coins. `CURRENT` reads the rules of the game from src/data (fresh oven, XP
 *    curve, upgrade gates with the legendary rule, twins for coins, x2 limit, coin rules);
 *    `BEFORE` is the frozen economy of the game before the 2026-11-15 decisions, kept for
 *    comparison (the samples come from the current sim, so the old coin rules are re-priced from
 *    their sources).
 *
 * The income is based on the play volume (runs in the minutes of the day), not on a fixed number
 * of runs a day.
 *
 * Mastery (docs/05-economy-monetization.md, section 3): the master effects exist only at creature
 * level 5, which opens at baker level 16 (a legendary creature at 20). In `CURRENT`, from the day
 * the player reaches baker level 16 the runs come from samples of the same team at level 5 (a
 * legendary one at 4 until baker level 20), without checking whether the model player bought
 * those upgrades: an upper bound of the income, cautious for "strong not before day 28". An extra
 * acceptance row plays the strong player with the best level-5 coin team of `npm run sim:coins`
 * from baker level 16 (`--mastery-team=a+b+c` replaces it).
 *
 * `npm run sim:economy -- [--runs=1000] [--cache=path] [--current] [--mastery-team=a+b+c] [--set=...]`
 */
import { SESSION_TIME } from './session-time';
import {
  levelReward as currentLevelReward,
  xpToNext as currentXpToNext,
} from '../src/core/progression';
import { legacyXpToNext } from '../src/core/save/frozen-v5';
import { Rng } from '../src/core/rng';
import { DIFFICULTY } from '../src/data/balance';
import {
  CREATURE_IDS,
  CREATURES,
  isCreatureId,
  MAX_CREATURE_LEVEL,
  type CreatureId,
} from '../src/data/creatures';
import { DAILY } from '../src/data/daily';
import {
  BERRY_PACKS,
  LEGENDARY_UPGRADE_MIN_BAKER,
  UPGRADE_COSTS,
  UPGRADE_MIN_BAKER,
} from '../src/data/economy';
import { GIFT } from '../src/data/gift';
import { MISSIONS } from '../src/data/missions';
import { OVEN, type LevelReward } from '../src/data/progression';
import { REWARDED_OFFERS } from '../src/data/rewarded-video';
import { SHOP } from '../src/data/shop';
import { STREAK_REWARDS } from '../src/data/streak';
import { checkpointBerryPrice, checkpointHasAd } from '../src/core/checkpoints';
import { BALANCE } from '../src/data/balance';
import { CHECKPOINT_HEIGHTS, type CheckpointHeight } from '../src/data/checkpoints';
import { MS_PER_SECOND } from '../src/util/math';
import { playCheckpointRuns } from './checkpoint-runs';
import { COIN_SOURCES, CoinStats, type CoinsBySource } from './coin-stats';
import { intArg, nodeFs, scriptArgs } from './node-env';
import { ANALYSIS_MAX_HEIGHT, mean, playRun, profileStreams, teamSlots } from './sim-runner';
import { applySets, setArg } from './what-if';

// ---------------------------------------------------------------- samples

interface RunSample {
  /** Layers placed in the run (XP and the height bonus count these). */
  h: number;
  /** Full height of a run from a checkpoint (start + placed); absent when it equals `h`. */
  top?: number;
  c: CoinsBySource;
  b: number;
  s: number;
}

interface TeamSetup {
  key: string;
  creatures: CreatureId[];
  level: number;
}

const SETUPS: TeamSetup[] = [
  { key: 'starter', creatures: ['honey'], level: 1 },
  { key: 'coin', creatures: ['caramel', 'ghost', 'rainbow'], level: 1 },
];
const PROFILES = ['novice', 'regular', 'expert', 'strong'] as const;
type ProfileId = (typeof PROFILES)[number];

/** Index of the upgrade to the last level in the upgrade gate lists. */
const LAST_STEP = MAX_CREATURE_LEVEL - 2;
const gate = (gates: readonly number[]): number => {
  const level = gates[LAST_STEP];
  if (level === undefined) throw new Error('no gate of the last upgrade');
  return level;
};

/** Runs of a team from a baker level on: the team at level 5 with the master effects. */
interface MasteryStage {
  fromBaker: number;
  /** Sample key suffix. */
  key: string;
  levelOf: (id: CreatureId) => number;
}

const isLegendary = (id: CreatureId): boolean => CREATURES[id].rarity === 'legendary';

/** Level 5 from baker 16; a legendary creature waits at level 4 for its own gate (baker 20). */
function masteryStages(creatures: readonly CreatureId[]): MasteryStage[] {
  const full: MasteryStage = {
    fromBaker: gate(LEGENDARY_UPGRADE_MIN_BAKER),
    key: 'L5',
    levelOf: () => MAX_CREATURE_LEVEL,
  };
  if (!creatures.some(isLegendary)) return [{ ...full, fromBaker: gate(UPGRADE_MIN_BAKER) }];
  return [
    {
      fromBaker: gate(UPGRADE_MIN_BAKER),
      key: 'L5-legendary4',
      levelOf: (id) => (isLegendary(id) ? MAX_CREATURE_LEVEL - 1 : MAX_CREATURE_LEVEL),
    },
    full,
  ];
}

/**
 * The team with the most coins per run at level 5 for the strong profile, master effects
 * included (`npm run sim:coins -- --profile=strong`, 2026-11-16, before the mastery numbers were
 * tuned: 398 coins per run). Re-check it after tuning.
 */
const BEST_COIN_TEAM_L5: readonly CreatureId[] = ['honey', 'frosty', 'ghost'];
const BEST_KEY = 'best5';

function playSamples(
  profileId: ProfileId,
  key: string,
  creatures: readonly CreatureId[],
  level: number | ((id: CreatureId) => number),
  runs: number,
): RunSample[] {
  const profile = DIFFICULTY.targets.find((t) => t.id === profileId);
  if (!profile) throw new Error(profileId);
  const { seeds, noise } = profileStreams(`${profileId}:${key}`);
  const coins = new CoinStats();
  const out: RunSample[] = [];
  for (let i = 0; i < runs; i += 1) {
    const result = playRun(
      {
        seed: seeds.int(0, 2 ** 31 - 1),
        mode: 'classic',
        team: teamSlots({ name: key, creatures }, level),
        tutorial: false,
      },
      profile,
      noise,
      [coins],
      ANALYSIS_MAX_HEIGHT,
    );
    const c = coins.runs[coins.runs.length - 1];
    if (!c) throw new Error('no coin stats');
    out.push({ h: result.height, c, b: result.berries, s: result.durationMs / MS_PER_SECOND });
  }
  return out;
}

type Samples = Record<string, RunSample[]>;

/** Key of the samples of the best level-5 coin team: the team is part of it, so a cache follows it. */
const bestKey = (team: readonly CreatureId[]): string => `${BEST_KEY}=${team.join('+')}`;

interface SampleJob {
  key: string;
  play: (runs: number) => RunSample[];
}

/** Every sample set the report needs: each setup at level 1 and in its mastery stages, the best coin team. */
function sampleJobs(bestTeam: readonly CreatureId[]): SampleJob[] {
  const jobs: SampleJob[] = [];
  for (const p of PROFILES) {
    for (const setup of SETUPS) {
      const base = setup.key;
      jobs.push({
        key: `${p}:${base}`,
        play: (runs) => playSamples(p, base, setup.creatures, setup.level, runs),
      });
      for (const stage of masteryStages(setup.creatures)) {
        const key = `${base}:${stage.key}`;
        jobs.push({
          key: `${p}:${key}`,
          play: (runs) => playSamples(p, key, setup.creatures, stage.levelOf, runs),
        });
      }
    }
  }
  for (const stage of masteryStages(bestTeam)) {
    const key = `${bestKey(bestTeam)}:${stage.key}`;
    jobs.push({
      key: `strong:${key}`,
      play: (runs) => playSamples('strong', key, bestTeam, stage.levelOf, runs),
    });
  }
  return jobs;
}

/** Plays the samples, or reads them from `cache` and plays only the ones it lacks. */
function loadSamples(runs: number, cache: string | null, bestTeam: readonly CreatureId[]): Samples {
  const samples: Samples =
    cache && nodeFs().existsSync(cache)
      ? (JSON.parse(nodeFs().readFileSync(cache, 'utf8')) as Samples)
      : {};
  let played = false;
  for (const job of sampleJobs(bestTeam)) {
    if (samples[job.key]) continue;
    samples[job.key] = job.play(runs);
    played = true;
  }
  if (cache && played) nodeFs().writeFileSync(cache, JSON.stringify(samples));
  return samples;
}

/** Runs of the mastery stages of a team, ready for `walk`; none in an economy without mastery. */
interface StageSamples {
  fromBaker: number;
  samples: RunSample[];
}

function stageSamples(
  eco: Economy,
  samples: Samples,
  profile: ProfileId,
  teamKey: string,
  creatures: readonly CreatureId[],
): StageSamples[] {
  if (!eco.mastery) return [];
  return masteryStages(creatures).map((stage) => ({
    fromBaker: stage.fromBaker,
    samples: samples[`${profile}:${teamKey}:${stage.key}`] ?? [],
  }));
}

function setupByKey(key: string): TeamSetup {
  const setup = SETUPS.find((s) => s.key === key);
  if (!setup) throw new Error(`setup ${key}`);
  return setup;
}

// ---------------------------------------------------------------- economy

export interface Economy {
  name: string;
  /** Coins one run pays, from its sample. */
  runCoins: (r: RunSample) => number;
  /** Berries one run pays. */
  runBerries: (r: RunSample) => number;
  /** Baker XP one run pays before the daily bonus. */
  runXp: (r: RunSample) => number;
  /** The first `firstXp` raw XP of each local day are multiplied by `mult` (1 = no bonus). */
  dailyXpBonus: { firstXp: number; mult: number };
  xpToNext: (level: number) => number;
  levelReward: (level: number) => LevelReward;
  missionCoins: { easy: number; medium: number; hard: number };
  missionXp: { easy: number; medium: number; hard: number };
  chestBerries: number;
  /** Streak calendar, 7 cells; `null` is the creature cell of day 7. */
  streakCoins: number[];
  streakBerries: number[];
  giftCoins: number;
  /** Daily tiers: [height, coins, berries]. */
  dailyTiers: Array<[number, number, number]>;
  dailyAttempts: number;
  shopFree: { amount: number; perDay: number };
  /** Max "x2 coins" per day on results (Infinity = no cap). */
  doubleCap: number;
  doubleMinCoins: number;
  upgradeCosts: number[];
  /** Baker level needed to upgrade a creature to level index+2 (index 0: 1 -> 2). */
  upgradeMinBaker: number[];
  /** Per-creature override of `upgradeMinBaker`. */
  upgradeMinBakerFor?: Partial<Record<CreatureId, number[]>>;
  /** Coin price and baker gate of every shop creature (others come free). */
  shopPrice: Partial<Record<CreatureId, { coins: number; minBaker: number }>>;
  /** Berries -> coins, best pack only. */
  berryPack: { berries: number; coins: number };
  /** The rainbow's berry price and baker gate in the shop (it also comes free at level 20). */
  rainbowBerries: { berries: number; minBaker: number };
  /** Creature mastery exists: from baker level 16 the runs come from the level-5 samples. */
  mastery: boolean;
}

const shopPriceFromData = (): Economy['shopPrice'] => {
  const out: Economy['shopPrice'] = {};
  for (const id of CREATURE_IDS) {
    for (const u of CREATURES[id].unlock) {
      if (u.kind === 'shop' && u.coins !== undefined) {
        out[id] = { coins: u.coins, minBaker: u.minBakerLevel ?? 1 };
      }
    }
  }
  return out;
};

function rainbowBerryPrice(): Economy['rainbowBerries'] {
  for (const u of CREATURES.rainbow.unlock) {
    if (u.kind === 'shop' && u.berries !== undefined) {
      return { berries: u.berries, minBaker: u.minBakerLevel ?? 1 };
    }
  }
  throw new Error('rainbow has no berry price');
}

const coinSum = (c: CoinsBySource): number =>
  COIN_SOURCES.reduce((sum, source) => sum + c[source], 0);

const bestPack = BERRY_PACKS[BERRY_PACKS.length - 1] ?? { berries: 100, coins: 1400 };

/** Frozen numbers of the economy before the 2026-11-15 decisions (save version 4 and older). */
const BEFORE_RULES = {
  heightStep: 10,
  heightPerStep: 2,
  /** Every perfect drop of a combo of 5+ paid, now every second one does. */
  comboFactor: 2,
  upgradeCosts: [150, 400, 900, 2000],
} as const;

/** The rules of the game, read from src/data and src/core. */
export const CURRENT: Economy = {
  name: 'current',
  // The samples are played by the current sim, so their coins already follow the current rules.
  runCoins: (r) => coinSum(r.c),
  runBerries: (r) => r.b,
  // Layers beyond the fresh ones pay 1 XP per `layersPerXp`; the fresh ones are a daily bonus
  // that lifts the first `freshLayers / layersPerXp` raw XP of the day back to 1 XP per layer.
  runXp: (r) => r.h / OVEN.layersPerXp,
  dailyXpBonus: { firstXp: OVEN.freshLayers / OVEN.layersPerXp, mult: OVEN.layersPerXp },
  xpToNext: currentXpToNext,
  levelReward: currentLevelReward,
  missionCoins: { ...MISSIONS.reward },
  missionXp: { ...MISSIONS.xp },
  chestBerries: MISSIONS.chestBerries,
  streakCoins: STREAK_REWARDS.map((r) => (r.kind === 'coins' ? r.amount : 0)),
  streakBerries: STREAK_REWARDS.map((r) => (r.kind === 'berries' ? r.amount : 0)),
  giftCoins: (GIFT.minCoins + GIFT.maxCoins) / 2,
  dailyTiers: DAILY.tiers.map((t) => [t.height, t.reward.coins ?? 0, t.reward.berries ?? 0]),
  dailyAttempts: DAILY.attempts,
  shopFree: { amount: SHOP.freeCoins.amount, perDay: SHOP.freeCoins.perDay },
  doubleCap: REWARDED_OFFERS.doubleCoinsPerDay,
  doubleMinCoins: REWARDED_OFFERS.doubleCoinsMin,
  upgradeCosts: [...UPGRADE_COSTS],
  upgradeMinBaker: [...UPGRADE_MIN_BAKER],
  upgradeMinBakerFor: Object.fromEntries(
    CREATURE_IDS.filter((id) => CREATURES[id].rarity === 'legendary').map((id) => [
      id,
      [...LEGENDARY_UPGRADE_MIN_BAKER],
    ]),
  ),
  shopPrice: shopPriceFromData(),
  berryPack: bestPack,
  rainbowBerries: rainbowBerryPrice(),
  mastery: true,
};

/** The economy before the decisions, for comparison: samples are re-priced to the old coin rules. */
export const BEFORE: Economy = {
  ...CURRENT,
  name: 'before',
  runCoins: (r) =>
    coinSum(r.c) -
    r.c.combo -
    r.c.height +
    BEFORE_RULES.comboFactor * r.c.combo +
    Math.floor(r.h / BEFORE_RULES.heightStep) * BEFORE_RULES.heightPerStep,
  runXp: (r) => r.h,
  dailyXpBonus: { firstXp: 0, mult: 1 },
  xpToNext: legacyXpToNext,
  missionXp: { easy: 0, medium: 0, hard: 0 },
  doubleCap: Infinity,
  upgradeCosts: [...BEFORE_RULES.upgradeCosts],
  upgradeMinBaker: [1, 1, 1, 1],
  upgradeMinBakerFor: {},
  mastery: false,
  // The twins were never sold.
  shopPrice: Object.fromEntries(
    Object.entries(shopPriceFromData()).filter(([id]) => id !== 'twins'),
  ),
};

// ---------------------------------------------------------------- player behaviour

export interface Player {
  profile: ProfileId;
  team: string;
  minutesPerDay: number;
  /** Watches the "x2" ad after every run (up to the cap), the gift x2, shop free coins, +1 daily attempt. */
  ads: boolean;
  /** Saves berries for the rainbow and buys it in the shop instead of waiting for level 20. */
  rainbowByBerries?: boolean;
  /**
   * Starts classic runs from a checkpoint: `ads` = up to `adsPerDay` ad starts from the highest
   * opened of 20/40/60 (needs `ads`); `berries` = the same plus a berry start from the highest
   * opened checkpoint whenever the berries cover the price.
   */
  checkpoints?: 'ads' | 'berries';
}

/** Runs of one profile and team from every checkpoint, by start height. */
export type CheckpointSamples = Record<CheckpointHeight, RunSample[]>;

/** Share of each mission group done per day, by profile (an estimate, see the report). */
const MISSION_RATE: Record<ProfileId, { easy: number; medium: number; hard: number }> = {
  novice: { easy: 1, medium: 0.7, hard: 0.3 },
  regular: { easy: 1, medium: 1, hard: 0.8 },
  expert: { easy: 1, medium: 1, hard: 1 },
  strong: { easy: 1, medium: 1, hard: 1 },
};

const RESULTS_SEC = SESSION_TIME.resultsSec;
const AD_SEC = SESSION_TIME.adSec;
const giftsPerDay = (minutes: number): number => (minutes >= 120 ? 4 : 2);

// ---------------------------------------------------------------- day walk

interface WalkResult {
  /** Day (1-based) on which baker level n was reached. */
  levelDay: Record<number, number | null>;
  /** Days of the coin purchases, in order. */
  buyDay: number[];
  /** All 12 creatures owned at level 5 (the twins by record or bought for coins). */
  fullDay: number | null;
  /** The same without the twins. */
  fullNoTwinsDay: number | null;
  twinsDay: number | null;
  perDay: { coins: number; xp: number; runs: number };
}

const MAX_DAYS = 400;
const PREFER_CREATURE_UNDER = 900;
/** Income per day is averaged over the first this many days. */
const STATS_DAYS = 30;
const LEVEL_MARKS = [5, 10, 15, 20];

export function walk(
  eco: Economy,
  player: Player,
  samples: RunSample[],
  cp?: CheckpointSamples,
  stages: readonly StageSamples[] = [],
): WalkResult {
  const rng = new Rng(7);
  let sampleIdx = 0;
  const cpIdx: Record<number, number> = {};
  const nextCheckpointRun = (height: CheckpointHeight): RunSample => {
    const list = cp?.[height] ?? [];
    const i = cpIdx[height] ?? 0;
    cpIdx[height] = i + 1;
    const r = list[i % list.length];
    if (!r) throw new Error(`no checkpoint samples for ${height}`);
    return r;
  };
  const stageIdx = stages.map(() => 0);
  const nextRun = (): RunSample => {
    // The latest mastery stage the baker level has opened, otherwise the level-1 runs.
    let stage = -1;
    stages.forEach((s, i) => {
      if (level >= s.fromBaker) stage = i;
    });
    const list = stages[stage]?.samples ?? samples;
    const i = stage < 0 ? sampleIdx : (stageIdx[stage] ?? 0);
    if (stage < 0) sampleIdx += 1;
    else stageIdx[stage] = i + 1;
    const r = list[i % list.length];
    if (!r) throw new Error('no samples');
    return r;
  };
  void rng;
  const owned = new Map<CreatureId, number>([['honey', 1]]);
  let coins = 0;
  let berries = 0;
  let level = 1;
  let xp = 0;
  let record = 0;
  /** Best height of a run from zero: only such a run opens checkpoints. */
  let zeroBest = 0;
  const levelDay: Record<number, number | null> = {};
  for (const m of LEVEL_MARKS) levelDay[m] = null;
  const ownDay: number[] = [];
  const buyDay: number[] = [];
  let fullDay: number | null = null;
  let fullNoTwinsDay: number | null = null;
  let twinsDay: number | null = null;
  let totalCoins = 0;
  let totalXp = 0;
  let totalRuns = 0;
  let stats: WalkResult['perDay'] | null = null;
  const rate = MISSION_RATE[player.profile];

  const grantCreature = (id: CreatureId, day: number): void => {
    if (owned.has(id)) {
      const price = eco.shopPrice[id];
      if (price) coins += price.coins / 2;
      return;
    }
    owned.set(id, 1);
    ownDay.push(day);
    if (id === 'twins') twinsDay = day;
  };

  const gainXp = (amount: number, day: number): void => {
    xp += amount;
    totalXp += amount;
    while (xp >= eco.xpToNext(level)) {
      xp -= eco.xpToNext(level);
      level += 1;
      const reward = eco.levelReward(level);
      coins += reward.coins ?? 0;
      berries += reward.berries ?? 0;
      if (reward.creature) grantCreature(reward.creature, day);
      if (levelDay[level] === null) levelDay[level] = day;
    }
  };

  const earnCoins = (amount: number): void => {
    coins += amount;
    totalCoins += amount;
  };

  const spend = (day: number): void => {
    for (;;) {
      if (player.rainbowByBerries && !owned.has('rainbow')) {
        if (level >= eco.rainbowBerries.minBaker && berries >= eco.rainbowBerries.berries) {
          berries -= eco.rainbowBerries.berries;
          grantCreature('rainbow', day);
          continue;
        }
      } else if (berries >= eco.berryPack.berries) {
        berries -= eco.berryPack.berries;
        coins += eco.berryPack.coins;
        continue;
      }
      // Cheapest next step: a new creature or an upgrade.
      // A new creature first while one up to `PREFER_CREATURE_UNDER` coins is on sale, otherwise
      // the cheapest step (a player saves for a creature rather than spending on upgrades).
      let best: { cost: number; act: () => void } | null = null;
      let creatureFirst = false;
      for (const id of CREATURE_IDS) {
        const price = eco.shopPrice[id];
        if (!owned.has(id) && price && level >= price.minBaker) {
          const preferred = price.coins <= PREFER_CREATURE_UNDER;
          if (
            !best ||
            (preferred && !creatureFirst) ||
            (preferred === creatureFirst && price.coins < best.cost)
          ) {
            creatureFirst = preferred;
            best = {
              cost: price.coins,
              act: () => {
                grantCreature(id, day);
                buyDay.push(day);
              },
            };
          }
        }
        const lv = owned.get(id);
        const gates = eco.upgradeMinBakerFor?.[id] ?? eco.upgradeMinBaker;
        if (lv !== undefined && lv < 5 && level >= (gates[lv - 1] ?? 1)) {
          const cost = eco.upgradeCosts[lv - 1] ?? Infinity;
          if (!creatureFirst && (!best || cost < best.cost)) {
            best = { cost, act: () => owned.set(id, lv + 1) };
          }
        }
      }
      if (!best || best.cost > coins) return;
      coins -= best.cost;
      best.act();
    }
  };

  for (let day = 1; day <= MAX_DAYS; day += 1) {
    // Fixed income of the day.
    const cell = (day - 1) % 7;
    if (day === 7) grantCreature('brownie', day);
    else {
      earnCoins(eco.streakCoins[cell] ?? 0);
      berries += eco.streakBerries[cell] ?? 0;
    }
    const gifts = giftsPerDay(player.minutesPerDay);
    earnCoins(gifts * eco.giftCoins * (player.ads ? 2 : 1));
    let budget = player.minutesPerDay * 60;
    if (player.ads) {
      earnCoins(eco.shopFree.amount * eco.shopFree.perDay);
      budget -= eco.shopFree.perDay * AD_SEC + gifts * AD_SEC;
    }

    // Runs: the daily tower first (from baker level 5), then classic runs.
    let doubles = 0;
    let rawXpToday = 0;
    const runXp = (r: RunSample): void => {
      const raw = eco.runXp(r);
      const bonusPart = Math.max(0, Math.min(raw, eco.dailyXpBonus.firstXp - rawXpToday));
      rawXpToday += raw;
      gainXp(raw + bonusPart * (eco.dailyXpBonus.mult - 1), day);
    };
    if (level >= 5) {
      const attempts = eco.dailyAttempts + (player.ads ? 1 : 0);
      let best = 0;
      for (let a = 0; a < attempts && budget > 0; a += 1) {
        const r = nextRun();
        best = Math.max(best, r.h);
        earnCoins(eco.runCoins(r));
        berries += eco.runBerries(r);
        runXp(r);
        totalRuns += 1;
        budget -= r.s + RESULTS_SEC + (a >= eco.dailyAttempts ? AD_SEC : 0);
      }
      for (const [h, c, b] of eco.dailyTiers) {
        if (best >= h) {
          earnCoins(c);
          berries += b;
        }
      }
    }
    let adStarts = 0;
    while (budget > 0) {
      let r: RunSample | null = null;
      let cost = RESULTS_SEC;
      if (player.checkpoints && cp) {
        // Checkpoints open when a run from zero reaches them.
        const opened = CHECKPOINT_HEIGHTS.filter((h) => h <= zeroBest);
        const adHeight = [...opened].reverse().find(checkpointHasAd);
        const top = opened[opened.length - 1];
        if (player.ads && adHeight !== undefined && adStarts < BALANCE.checkpoints.adsPerDay) {
          r = nextCheckpointRun(adHeight);
          adStarts += 1;
          cost += AD_SEC;
        } else if (
          player.checkpoints === 'berries' &&
          top !== undefined &&
          berries >= checkpointBerryPrice(top)
        ) {
          berries -= checkpointBerryPrice(top);
          r = nextCheckpointRun(top);
        }
      }
      r ??= nextRun();
      cost += r.s;
      let earned = eco.runCoins(r);
      if (player.ads && doubles < eco.doubleCap && earned >= eco.doubleMinCoins) {
        earned *= 2;
        doubles += 1;
        cost += AD_SEC;
      }
      earnCoins(earned);
      berries += eco.runBerries(r);
      runXp(r);
      record = Math.max(record, r.top ?? r.h);
      if (r.top === undefined) zeroBest = Math.max(zeroBest, r.h);
      totalRuns += 1;
      budget -= cost;
    }
    if (record >= 75 && !owned.has('twins')) grantCreature('twins', day);

    // Missions after the day's play.
    const missionCoins =
      rate.easy * eco.missionCoins.easy +
      rate.medium * eco.missionCoins.medium +
      rate.hard * eco.missionCoins.hard;
    earnCoins(missionCoins);
    gainXp(
      rate.easy * eco.missionXp.easy +
        rate.medium * eco.missionXp.medium +
        rate.hard * eco.missionXp.hard,
      day,
    );
    berries += rate.easy * rate.medium * rate.hard * eco.chestBerries;

    spend(day);
    // The twins come by a record of 75 or, in the current economy, for coins from baker level 14.
    const maxed = (skipTwins: boolean): boolean =>
      CREATURE_IDS.every((id) => (skipTwins && id === 'twins') || (owned.get(id) ?? 0) >= 5);
    if (fullNoTwinsDay === null && maxed(true)) fullNoTwinsDay = day;
    if (fullDay === null && maxed(false)) fullDay = day;
    if (day === STATS_DAYS) stats = avg(totalCoins, totalXp, totalRuns, day);
    if (fullDay !== null && levelDay[20] !== null && day >= STATS_DAYS) {
      return {
        levelDay,
        buyDay,
        fullDay,
        fullNoTwinsDay,
        twinsDay,
        perDay: stats ?? avg(totalCoins, totalXp, totalRuns, day),
      };
    }
  }
  return {
    levelDay,
    buyDay,
    fullDay,
    fullNoTwinsDay,
    twinsDay,
    perDay: stats ?? avg(totalCoins, totalXp, totalRuns, MAX_DAYS),
  };
}

const avg = (coins: number, xp: number, runs: number, days: number) => ({
  coins: coins / days,
  xp: xp / days,
  runs: runs / days,
});

// ---------------------------------------------------------------- report

const fmt = (n: number | null, digits = 0): string => (n === null ? '>400' : n.toFixed(digits));

/** Sample keys of the per-run table: each setup, then its mastery stages when the economy has them. */
function perRunKeys(eco: Economy, p: ProfileId, bestTeam: readonly CreatureId[]): string[] {
  const keys: string[] = [];
  for (const setup of SETUPS) {
    keys.push(setup.key);
    if (eco.mastery) {
      for (const stage of masteryStages(setup.creatures)) keys.push(`${setup.key}:${stage.key}`);
    }
  }
  if (eco.mastery && p === 'strong') {
    for (const stage of masteryStages(bestTeam)) keys.push(`${bestKey(bestTeam)}:${stage.key}`);
  }
  return keys;
}

function perRunTable(eco: Economy, samples: Samples, bestTeam: readonly CreatureId[]): void {
  console.log(`\n## ${eco.name}: per run and per hour (results 20 s, ad 30 s)`);
  console.log(
    '| profile | team | coins/run | XP/run | run, s | coins/h | XP/h | coins/h x2 | XP/h x2 | XP/h after fresh |',
  );
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const p of PROFILES) {
    for (const key of perRunKeys(eco, p, bestTeam)) {
      const runs = samples[`${p}:${key}`] ?? [];
      const c = mean(runs.map(eco.runCoins));
      const x = mean(runs.map(eco.runXp)) * eco.dailyXpBonus.mult;
      const tired = mean(runs.map(eco.runXp));
      const s = mean(runs.map((r) => r.s));
      const perH = 3600 / (s + RESULTS_SEC);
      const perH2 = 3600 / (s + RESULTS_SEC + AD_SEC);
      console.log(
        `| ${p} | ${key} | ${c.toFixed(1)} | ${x.toFixed(1)} | ${s.toFixed(0)} | ${(c * perH).toFixed(0)} | ${(x * perH).toFixed(0)} | ${(2 * c * perH2).toFixed(0)} | ${(x * perH2).toFixed(0)} | ${(tired * perH).toFixed(0)} |`,
      );
    }
  }
}

/** Ads on or off, and whether the player saves berries for the rainbow. */
const RUN_VARIANTS: ReadonlyArray<readonly [boolean, boolean]> = [
  [false, false],
  [true, false],
  [true, true],
];

function daysTable(eco: Economy, samples: Samples): void {
  console.log(`\n## ${eco.name}: days to goals`);
  console.log(
    '| profile | team | min/day | ads | rainbow | coins/day | XP/day | runs/day | 1st buy | 2nd buy | full (12) | full (no twins) | twins | lvl 5 | lvl 10 | lvl 15 | lvl 20 |',
  );
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const p of PROFILES) {
    for (const setup of SETUPS) {
      for (const minutes of [30, 210]) {
        for (const [ads, rainbowByBerries] of RUN_VARIANTS) {
          const runs = samples[`${p}:${setup.key}`] ?? [];
          const player = {
            profile: p,
            team: setup.key,
            minutesPerDay: minutes,
            ads,
            rainbowByBerries,
          };
          const stages = stageSamples(eco, samples, p, setup.key, setup.creatures);
          const r = walk(eco, player, runs, undefined, stages);
          console.log(
            `| ${p} | ${setup.key} | ${minutes} | ${ads ? 'x2' : '-'} | ${rainbowByBerries ? 'berries' : 'lvl 20'} | ${r.perDay.coins.toFixed(0)} | ${r.perDay.xp.toFixed(0)} | ${r.perDay.runs.toFixed(0)} | ${r.buyDay[0] ?? '-'} | ${r.buyDay[1] ?? '-'} | ${fmt(r.fullDay)} | ${fmt(r.fullNoTwinsDay)} | ${fmt(r.twinsDay)} | ${fmt(r.levelDay[5] ?? null)} | ${fmt(r.levelDay[10] ?? null)} | ${fmt(r.levelDay[15] ?? null)} | ${fmt(r.levelDay[20] ?? null)} |`,
          );
        }
      }
    }
  }
}

/** The acceptance criteria of the 2026-11-15 economy, checked for key players of `eco`. */
function criteriaTable(eco: Economy, samples: Samples, bestTeam: readonly CreatureId[]): void {
  const walkFor = (
    profile: ProfileId,
    team: string,
    minutes: number,
    ads: boolean,
    berries = false,
    stages = stageSamples(eco, samples, profile, team, setupByKey(team).creatures),
  ) =>
    walk(
      eco,
      { profile, team, minutesPerDay: minutes, ads, rainbowByBerries: berries },
      samples[`${profile}:${team}`] ?? [],
      undefined,
      stages,
    );
  const rows: Array<{ name: string; r: WalkResult; rule: string; ok: boolean }> = [];
  for (const ads of [false, true]) {
    const r = walkFor('regular', 'starter', 30, ads);
    const day = r.fullDay;
    rows.push({
      name: `regular, starter, 30 min, ${ads ? 'x2' : 'no x2'}: all 12 at level 5 and baker 20`,
      r,
      rule: '60..90',
      ok: day !== null && day >= 60 && day <= 90 && (r.levelDay[20] ?? 999) <= day,
    });
  }
  for (const berries of [false, true]) {
    const r = walkFor('strong', 'coin', 210, true, berries);
    rows.push({
      name: `strong, coin team, 210 min, x2, rainbow ${berries ? 'by berries' : 'at lvl 20'}: everything incl. Rainbow L5`,
      r,
      rule: '>= 28',
      ok: r.fullDay !== null && r.fullDay >= 28,
    });
  }
  if (eco.mastery) {
    // The strong player switches to the best level-5 coin team once baker level 16 opens level 5.
    for (const berries of [false, true]) {
      const stages = stageSamples(eco, samples, 'strong', bestKey(bestTeam), bestTeam);
      const r = walkFor('strong', 'coin', 210, true, berries, stages);
      rows.push({
        name: `strong, coin team, from baker ${stages[0]?.fromBaker ?? '-'} the best L5 coin team ${bestTeam.join('+')}, 210 min, x2, rainbow ${berries ? 'by berries' : 'at lvl 20'}`,
        r,
        rule: '>= 28',
        ok: r.fullDay !== null && r.fullDay >= 28,
      });
    }
  }
  for (const [profile, team] of [
    ['regular', 'starter'],
    ['novice', 'starter'],
    ['strong', 'coin'],
  ] as const) {
    const r = walkFor(profile, team, 30, false);
    rows.push({
      name: `${profile}, ${team}, 30 min: 1st buy day 1, 2nd by day 3, baker 5 by day 2`,
      r,
      rule: 'buy1 = 1, buy2 <= 3, lvl5 <= 2',
      ok: r.buyDay[0] === 1 && (r.buyDay[1] ?? 99) <= 3 && (r.levelDay[5] ?? 99) <= 2,
    });
  }
  console.log(`\n## ${eco.name}: acceptance criteria`);
  console.log('| player | rule | full (12) | lvl 20 | 1st buy | 2nd buy | lvl 5 | ok |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const { name, r, rule, ok } of rows) {
    console.log(
      `| ${name} | ${rule} | ${fmt(r.fullDay)} | ${fmt(r.levelDay[20] ?? null)} | ${r.buyDay[0] ?? '-'} | ${r.buyDay[1] ?? '-'} | ${fmt(r.levelDay[5] ?? null)} | ${ok ? 'yes' : 'NO'} |`,
    );
  }
}

// ---------------------------------------------------------------- checkpoint starts

/** Runs of a profile and team from every checkpoint; the same seeds as the runs from zero. */
function playCheckpointSamples(
  profileId: ProfileId,
  setup: TeamSetup,
  runs: number,
): CheckpointSamples {
  const out = {} as CheckpointSamples;
  for (const start of CHECKPOINT_HEIGHTS) {
    out[start] = playCheckpointRuns({
      profileId,
      team: { name: setup.key, creatures: setup.creatures },
      level: setup.level,
      start,
      runs,
      streamId: `${profileId}:${setup.key}`,
    }).map((s) => ({ h: s.placed, top: s.full, c: s.c, b: s.berries, s: s.seconds }));
  }
  return out;
}

const REGULAR_TARGET_DAYS = [60, 90] as const;
const STRONG_MIN_DAYS = 28;

/** Checkpoint starts in the economy: the same players with and without them, and the owner's targets. */
function checkpointTable(eco: Economy, samples: Samples, runs: number): void {
  const cases: Array<{
    profile: ProfileId;
    setup: TeamSetup;
    minutes: number;
    ads: boolean;
    rainbow: boolean;
    variants: Array<Player['checkpoints']>;
  }> = [];
  const regular = SETUPS.find((s) => s.key === 'starter');
  const strong = SETUPS.find((s) => s.key === 'coin');
  if (!regular || !strong) throw new Error('setups');
  cases.push({
    profile: 'regular',
    setup: regular,
    minutes: 30,
    ads: false,
    rainbow: false,
    variants: [undefined, 'berries'],
  });
  cases.push({
    profile: 'regular',
    setup: regular,
    minutes: 30,
    ads: true,
    rainbow: false,
    variants: [undefined, 'ads', 'berries'],
  });
  for (const rainbow of [false, true]) {
    cases.push({
      profile: 'strong',
      setup: strong,
      minutes: 210,
      ads: true,
      rainbow,
      variants: [undefined, 'ads', 'berries'],
    });
  }
  const cpSamples = {
    regular: playCheckpointSamples('regular', regular, runs),
    strong: playCheckpointSamples('strong', strong, runs),
  };
  console.log(
    `\n## ${eco.name}: checkpoint starts (${runs} runs per start height; XP only for placed layers, fresh oven as above)`,
  );
  console.log(
    '| profile | team | min/day | x2 ads | rainbow | checkpoint starts | coins/day | XP/day | full (12) | lvl 5 | lvl 10 | lvl 15 | lvl 20 | target |',
  );
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const [lo, hi] = REGULAR_TARGET_DAYS;
  for (const c of cases) {
    for (const variant of c.variants) {
      const player: Player = {
        profile: c.profile,
        team: c.setup.key,
        minutesPerDay: c.minutes,
        ads: c.ads,
        rainbowByBerries: c.rainbow,
        checkpoints: variant,
      };
      const r = walk(
        eco,
        player,
        samples[`${c.profile}:${c.setup.key}`] ?? [],
        cpSamples[c.profile as 'regular' | 'strong'],
        stageSamples(eco, samples, c.profile, c.setup.key, c.setup.creatures),
      );
      const lvl20 = r.levelDay[20] ?? null;
      const target =
        c.profile === 'regular'
          ? r.fullDay !== null &&
            lvl20 !== null &&
            r.fullDay >= lo &&
            r.fullDay <= hi &&
            lvl20 >= lo &&
            lvl20 <= hi
            ? `ok (${lo}..${hi} days)`
            : `MISSED (${lo}..${hi} days)`
          : r.fullDay !== null && r.fullDay >= STRONG_MIN_DAYS
            ? `ok (>= ${STRONG_MIN_DAYS} days)`
            : `MISSED (>= ${STRONG_MIN_DAYS} days)`;
      console.log(
        `| ${c.profile} | ${c.setup.key} | ${c.minutes} | ${c.ads ? 'x2' : '-'} | ${c.rainbow ? 'berries' : 'lvl 20'} | ${variant ?? 'none'} | ${r.perDay.coins.toFixed(0)} | ${r.perDay.xp.toFixed(0)} | ${fmt(r.fullDay)} | ${fmt(r.levelDay[5] ?? null)} | ${fmt(r.levelDay[10] ?? null)} | ${fmt(r.levelDay[15] ?? null)} | ${fmt(lvl20)} | ${target} |`,
      );
    }
  }
}

// ---------------------------------------------------------------- main

function parseTeam(value: string): CreatureId[] {
  const ids = value.split('+');
  if (ids.length === 0 || !ids.every(isCreatureId)) throw new Error(`Invalid team: ${value}`);
  return ids;
}

function main(): void {
  let runs = 1000;
  let cache: string | null = null;
  let currentOnly = false;
  let bestTeam: readonly CreatureId[] = BEST_COIN_TEAM_L5;
  for (const arg of scriptArgs()) {
    const [key, value = ''] = arg.replace(/^--/, '').split('=');
    if (key === 'runs') runs = intArg([arg], 'runs', runs);
    else if (key === 'cache') cache = value;
    else if (key === 'current') currentOnly = true;
    else if (key === 'mastery-team') bestTeam = parseTeam(value);
    else if (key === 'set') continue;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  const sets = applySets(setArg(scriptArgs()));
  if (sets.length > 0) console.log(`What-if values: ${sets.join('; ')}`);
  const samples = loadSamples(runs, cache, bestTeam);
  const economies = currentOnly ? [CURRENT] : [BEFORE, CURRENT];
  for (const eco of economies) {
    perRunTable(eco, samples, bestTeam);
    daysTable(eco, samples);
    criteriaTable(eco, samples, bestTeam);
  }
  checkpointTable(CURRENT, samples, runs);
}

main();
