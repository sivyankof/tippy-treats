/**
 * Day-by-day economy model (analysis only, nothing here is used by the game).
 *
 * 1. Plays bot runs per profile and team with the real sim and keeps per-run samples
 *    (height, coins by source, berries, duration). The samples can be cached with `--cache=path`.
 * 2. Re-prices every sample with an economy (`CURRENT` from src/data, or a proposal object) and
 *    walks days: runs fill the daily play time, fixed daily income is added, coins are spent
 *    greedily on creatures and upgrades, berries are exchanged for coins.
 *
 * `npm run sim:economy -- [--runs=1000] [--cache=path] [--proposal]`
 */
import { heightBonusCoins } from '../src/core/coins';
import {
  levelReward as currentLevelReward,
  xpToNext as currentXpToNext,
} from '../src/core/progression';
import { Rng } from '../src/core/rng';
import { BALANCE, DIFFICULTY } from '../src/data/balance';
import { CREATURE_IDS, CREATURES, type CreatureId } from '../src/data/creatures';
import { DAILY } from '../src/data/daily';
import { BERRY_PACKS, UPGRADE_COSTS } from '../src/data/economy';
import { GIFT } from '../src/data/gift';
import { MISSIONS } from '../src/data/missions';
import type { LevelReward } from '../src/data/progression';
import { SHOP } from '../src/data/shop';
import { STREAK_REWARDS } from '../src/data/streak';
import { MS_PER_SECOND } from '../src/util/math';
import { COIN_SOURCES, CoinStats, type CoinsBySource } from './coin-stats';
import { intArg, nodeFs, scriptArgs } from './node-env';
import { ANALYSIS_MAX_HEIGHT, mean, playRun, profileStreams, teamSlots } from './sim-runner';

// ---------------------------------------------------------------- samples

interface RunSample {
  h: number;
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

function playSamples(profileId: ProfileId, setup: TeamSetup, runs: number): RunSample[] {
  const profile = DIFFICULTY.targets.find((t) => t.id === profileId);
  if (!profile) throw new Error(profileId);
  const { seeds, noise } = profileStreams(`${profileId}:${setup.key}`);
  const coins = new CoinStats();
  const out: RunSample[] = [];
  for (let i = 0; i < runs; i += 1) {
    const result = playRun(
      {
        seed: seeds.int(0, 2 ** 31 - 1),
        mode: 'classic',
        team: teamSlots({ name: setup.key, creatures: setup.creatures }, setup.level),
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

function loadSamples(runs: number, cache: string | null): Samples {
  if (cache && nodeFs().existsSync(cache)) {
    return JSON.parse(nodeFs().readFileSync(cache, 'utf8')) as Samples;
  }
  const samples: Samples = {};
  for (const p of PROFILES) {
    for (const setup of SETUPS) samples[`${p}:${setup.key}`] = playSamples(p, setup, runs);
  }
  if (cache) nodeFs().writeFileSync(cache, JSON.stringify(samples));
  return samples;
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

export const CURRENT: Economy = {
  name: 'current',
  runCoins: (r) => coinSum(r.c),
  runBerries: (r) => r.b,
  runXp: (r) => r.h,
  dailyXpBonus: { firstXp: 0, mult: 1 },
  xpToNext: currentXpToNext,
  levelReward: currentLevelReward,
  missionCoins: { ...MISSIONS.reward },
  missionXp: { easy: 0, medium: 0, hard: 0 },
  chestBerries: MISSIONS.chestBerries,
  streakCoins: STREAK_REWARDS.map((r) => (r.kind === 'coins' ? r.amount : 0)),
  streakBerries: STREAK_REWARDS.map((r) => (r.kind === 'berries' ? r.amount : 0)),
  giftCoins: (GIFT.minCoins + GIFT.maxCoins) / 2,
  dailyTiers: DAILY.tiers.map((t) => [t.height, t.reward.coins ?? 0, t.reward.berries ?? 0]),
  dailyAttempts: DAILY.attempts,
  shopFree: { amount: SHOP.freeCoins.amount, perDay: SHOP.freeCoins.perDay },
  doubleCap: Infinity,
  doubleMinCoins: 10,
  upgradeCosts: [...UPGRADE_COSTS],
  upgradeMinBaker: [1, 1, 1, 1],
  shopPrice: shopPriceFromData(),
  berryPack: bestPack,
  rainbowBerries: rainbowBerryPrice(),
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
}

/** Share of each mission group done per day, by profile (an estimate, see the report). */
const MISSION_RATE: Record<ProfileId, { easy: number; medium: number; hard: number }> = {
  novice: { easy: 1, medium: 0.7, hard: 0.3 },
  regular: { easy: 1, medium: 1, hard: 0.8 },
  expert: { easy: 1, medium: 1, hard: 1 },
  strong: { easy: 1, medium: 1, hard: 1 },
};

const RESULTS_SEC = 20;
const AD_SEC = 30;
const giftsPerDay = (minutes: number): number => (minutes >= 120 ? 4 : 2);

// ---------------------------------------------------------------- day walk

interface WalkResult {
  /** Day (1-based) on which baker level n was reached. */
  levelDay: Record<number, number | null>;
  /** Days of the coin purchases, in order. */
  buyDay: number[];
  fullDay: number | null;
  twinsDay: number | null;
  perDay: { coins: number; xp: number; runs: number };
}

const MAX_DAYS = 400;
const PREFER_CREATURE_UNDER = 900;
/** Income per day is averaged over the first this many days. */
const STATS_DAYS = 30;
const LEVEL_MARKS = [5, 10, 15, 20];

export function walk(eco: Economy, player: Player, samples: RunSample[]): WalkResult {
  const rng = new Rng(7);
  let sampleIdx = 0;
  const nextRun = (): RunSample => {
    const r = samples[sampleIdx % samples.length];
    sampleIdx += 1;
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
  const levelDay: Record<number, number | null> = {};
  for (const m of LEVEL_MARKS) levelDay[m] = null;
  const ownDay: number[] = [];
  const buyDay: number[] = [];
  let fullDay: number | null = null;
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
    while (budget > 0) {
      const r = nextRun();
      let earned = eco.runCoins(r);
      let cost = r.s + RESULTS_SEC;
      if (player.ads && doubles < eco.doubleCap && earned >= eco.doubleMinCoins) {
        earned *= 2;
        doubles += 1;
        cost += AD_SEC;
      }
      earnCoins(earned);
      berries += eco.runBerries(r);
      runXp(r);
      record = Math.max(record, r.h);
      totalRuns += 1;
      budget -= cost;
    }
    if (record >= 75 && twinsDay === null) {
      grantCreature('twins', day);
      twinsDay = day;
    }

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
    // Full collection without the twins: they need a record of 75, which a fixed bot team
    // reaches only through its distribution tail; their day is reported apart.
    const full =
      CREATURE_IDS.every((id) => id === 'twins' || owned.has(id)) &&
      [...owned.entries()].every(([id, lv]) => id === 'twins' || lv >= 5);
    if (full && fullDay === null) fullDay = day;
    if (day === STATS_DAYS) stats = avg(totalCoins, totalXp, totalRuns, day);
    if (fullDay !== null && levelDay[20] !== null && day >= STATS_DAYS) {
      return {
        levelDay,
        buyDay,
        fullDay,
        twinsDay,
        perDay: stats ?? avg(totalCoins, totalXp, totalRuns, day),
      };
    }
  }
  return {
    levelDay,
    buyDay,
    fullDay,
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

function perRunTable(eco: Economy, samples: Samples): void {
  console.log(`\n## ${eco.name}: per run and per hour (results 20 s, ad 30 s)`);
  console.log(
    '| profile | team | coins/run | XP/run | run, s | coins/h | XP/h | coins/h x2 | XP/h x2 | XP/h after fresh |',
  );
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const p of PROFILES) {
    for (const setup of SETUPS) {
      const runs = samples[`${p}:${setup.key}`] ?? [];
      const c = mean(runs.map(eco.runCoins));
      const x = mean(runs.map(eco.runXp)) * eco.dailyXpBonus.mult;
      const tired = mean(runs.map(eco.runXp));
      const s = mean(runs.map((r) => r.s));
      const perH = 3600 / (s + RESULTS_SEC);
      const perH2 = 3600 / (s + RESULTS_SEC + AD_SEC);
      console.log(
        `| ${p} | ${setup.key} | ${c.toFixed(1)} | ${x.toFixed(1)} | ${s.toFixed(0)} | ${(c * perH).toFixed(0)} | ${(x * perH).toFixed(0)} | ${(2 * c * perH2).toFixed(0)} | ${(x * perH2).toFixed(0)} | ${(tired * perH).toFixed(0)} |`,
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
    '| profile | team | min/day | ads | rainbow | coins/day | XP/day | runs/day | 1st buy | 2nd buy | full (no twins) | twins | lvl 5 | lvl 10 | lvl 15 | lvl 20 |',
  );
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
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
          const r = walk(eco, player, runs);
          console.log(
            `| ${p} | ${setup.key} | ${minutes} | ${ads ? 'x2' : '-'} | ${rainbowByBerries ? 'berries' : 'lvl 20'} | ${r.perDay.coins.toFixed(0)} | ${r.perDay.xp.toFixed(0)} | ${r.perDay.runs.toFixed(0)} | ${r.buyDay[0] ?? '-'} | ${r.buyDay[1] ?? '-'} | ${fmt(r.fullDay)} | ${fmt(r.twinsDay)} | ${fmt(r.levelDay[5] ?? null)} | ${fmt(r.levelDay[10] ?? null)} | ${fmt(r.levelDay[15] ?? null)} | ${fmt(r.levelDay[20] ?? null)} |`,
          );
        }
      }
    }
  }
}

// ---------------------------------------------------------------- main

function main(): void {
  let runs = 1000;
  let cache: string | null = null;
  let proposalOnly = false;
  for (const arg of scriptArgs()) {
    const [key, value = ''] = arg.replace(/^--/, '').split('=');
    if (key === 'runs') runs = intArg([arg], 'runs', runs);
    else if (key === 'cache') cache = value;
    else if (key === 'proposal') proposalOnly = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  const samples = loadSamples(runs, cache);
  const economies = proposalOnly ? [PROPOSAL] : [CURRENT, PROPOSAL];
  for (const eco of economies) {
    perRunTable(eco, samples);
    daysTable(eco, samples);
  }
}

// ---------------------------------------------------------------- proposal (filled in below)

/** Knobs of the proposal, kept together so the report can print them. */
export const KNOBS = {
  floating: 1,
  perfect: 1,
  combo: 0.5,
  golden: 10,
  /** Height bonus: `perStep` coins for every full `step` layers. */
  heightStep: 20,
  heightPerStep: 2,
  crumb: 1,
  doubleCap: 5,
  /** Full XP (1 per layer) for the first `freshLayers` layers of a local day, then 1 per `tiredEvery`. */
  freshLayers: 1300,
  tiredEvery: 6,
  missionXp: { easy: 20, medium: 40, hard: 60 },
  /** XP to leave levels 1..4, then `lateBase + lateStep * (level - 4)`. */
  earlyXp: [150, 250, 400, 600],
  lateBase: 100,
  lateStep: 810,
  /** Baker level needed for creature level 2, 3, 4, 5. */
  upgradeMinBaker: [1, 6, 11, 16],
  upgradeCosts: [200, 600, 1300, 2800],
  /** Gates of the legendary rainbow, which can be bought for berries before baker level 20. */
  rainbowMinBaker: [1, 6, 11, 20],
};

const proposalXpToNext = (level: number): number =>
  KNOBS.earlyXp[level - 1] ?? KNOBS.lateBase + KNOBS.lateStep * (level - 4);

export const PROPOSAL: Economy = {
  ...CURRENT,
  name: 'proposal',
  runCoins: (r) =>
    KNOBS.floating * r.c.floating +
    KNOBS.perfect * r.c.perfect +
    KNOBS.combo * r.c.combo +
    (r.c.golden / BALANCE.golden.normalCoins) * KNOBS.golden +
    Math.floor(r.h / KNOBS.heightStep) * KNOBS.heightPerStep +
    KNOBS.crumb * r.c.crumb,
  // Fresh layers count 1 XP, later ones 1 / tiredEvery: expressed as raw XP 1/tiredEvery per layer
  // and a daily bonus that lifts the first freshLayers / tiredEvery raw XP back to full.
  runXp: (r) => r.h / KNOBS.tiredEvery,
  dailyXpBonus: { firstXp: KNOBS.freshLayers / KNOBS.tiredEvery, mult: KNOBS.tiredEvery },
  xpToNext: proposalXpToNext,
  missionXp: KNOBS.missionXp,
  doubleCap: KNOBS.doubleCap,
  upgradeMinBaker: KNOBS.upgradeMinBaker,
  upgradeMinBakerFor: { rainbow: KNOBS.rainbowMinBaker },
  upgradeCosts: KNOBS.upgradeCosts,
};

void heightBonusCoins;
void BALANCE;
main();
