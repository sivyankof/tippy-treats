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
  /** A restarted run that is abandoned after this long (the pause "Restart" path). */
  abandonAfterMs: 3_000,
  /** How long a menu screen is looked at before the next one opens. */
  screenDwellMs: 1_200,
  /** Time on the results screen before "Play again". */
  resultsDwellMs: 1_500,
  /** How often the driver looks at the scenes while it waits. */
  pollMs: 200,
  /** Languages the settings step switches to, in turn; the last one must be the language the soak began with (`en`). */
  languages: ['ru', 'en'],
  /** Texture keys are grouped by their name with digit runs replaced by this mark. */
  textureDigitMark: '#',
  /** How many texture groups a sample lists (the biggest first). */
  textureGroupLimit: 25,
} as const;
