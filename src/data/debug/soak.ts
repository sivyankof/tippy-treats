import { FIRST_RUNS } from '../economy/first-runs';

/**
 * The dev-only soak run (`window.tippySoak`, docs/08-architecture.md, section 9): a bot plays runs
 * with restarts and visits the menu screens between them, while a harness samples the counts of
 * live things to find what grows from lap to lap. None of these numbers touch the game.
 */
export const SOAK = {
  /** Runs per lap: the first two play until the results, the last one is abandoned. */
  runsPerLap: 3,
  /** A run that has not reached the results by then is left through the pause path. */
  runMaxMs: 45_000,
  /** The checkpoint run of a lap may take longer: it plays a whole zone and its change. */
  zoneRunMaxMs: 120_000,
  /** How long the record results stay (the celebration plays and the record music comes in). */
  recordDwellMs: 6_000,
  /** First screen of a run: how long its HUD takes to come in before the driver may leave it. */
  hudEnterMs: 800,
  /** A run that ended while the driver waited to leave it: how long its results or Home may take to show. */
  endedWaitMs: 8_000,
  /** A restarted run that is abandoned after this long (the pause "Restart" path). */
  abandonAfterMs: 3_000,
  /** How long a menu screen is looked at before the next one opens. */
  screenDwellMs: 1_200,
  /** Time on the results screen before "Play again". */
  resultsDwellMs: 1_500,
  /** How often the driver looks at the scenes while it waits. */
  pollMs: 200,
  /** How often the poke of a run looks at its hooks: a Rainbow arc is fully grown for only a short while. */
  pokeMs: 50,
  /**
   * Teams set on the team screen before the first run of each lap, in turn (the tester's crash came
   * after a team change). Creatures the save does not own become empty slots; each has Rainbow, so
   * its arc can grow (with `start(true)` every creature is owned).
   */
  teams: [
    ['puff', 'honey', 'rainbow'],
    ['rainbow', 'jelly', 'caramel'],
    ['honey', 'rainbow', 'lemon'],
  ],
  /** Languages the settings step switches to, in turn; the last one must be the language the soak began with (`en`). */
  languages: ['ru', 'en'],
  /** The rich save of `start(true)`: coins and berries given, upgrade steps tried per creature, team size. */
  /** Baker level of the rich save: the shop, upgrades and the last team slot are gated by it. */
  richBakerLevel: 30,
  richCoins: 10_000_000,
  richBerries: 100_000,
  richUpgrades: 6,
  richTeamSize: 3,
  /** Finished runs of the rich save: past the quiet first runs, so Home has its starter pack button. */
  richRuns: FIRST_RUNS.quiet,
  /** Texture keys are grouped by their name with digit runs replaced by this mark. */
  textureDigitMark: '#',
  /** How many texture groups a sample lists (the biggest first). */
  textureGroupLimit: 25,
  /**
   * How far the live audio node count may differ between the smoke lap's two reads. The count is the
   * sounds' and beds' nodes only (`soundNodes`): the music's chain and notes move with the beat
   * (30-61 nodes on the lofi menu) and are left out. At the same quiet Home no sound is in flight, so
   * 16 only absorbs a sound that happens to end between the reads, while a real leak (sounds that
   * never release) adds far more in one lap.
   */
  audioNodesTolerance: 16,
  /** The smoke lap (`tippySoak.smoke()`): one fixed pass through every screen and run kind. */
  smoke: {
    /** Game-time multiplier of the runs in the lap (headless only; 1 outside the lap). */
    speed: 4,
    /** Shorter looks at the menu screens than in the soak. */
    screenDwellMs: 400,
    resultsDwellMs: 500,
    abandonAfterMs: 1_500,
    /** Team of `teams` the lap plays with: Rainbow in the first slot, so it comes at layer 6 and its arc and joke happen in a short run. */
    teamIndex: 1,
    /** Runs the Rainbow step may play to get a run that reaches the Rainbow layer. */
    rainbowAttempts: 4,
    /** Checkpoint the checkpoint run starts from. */
    checkpointIndex: 0,
    /** Counts are read until two reads in a row agree: at most this many reads, this far apart. */
    settleReads: 10,
    /** Reads taken at least, whatever they show: idle tweens come and go, a leaked one stays. */
    settleMinReads: 4,
    settleMs: 600,
    /** A finite tween that ends within this many ms is a passing one (a portrait or gloss tween of Home) and is left out of the compared tween count; infinite, paused and longer ones count. */
    shortTweenMs: 600,
  },
} as const;
