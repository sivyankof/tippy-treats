/** Time a player spends outside the run itself, in seconds (economy model and checkpoint section of `npm run sim`). */
export const SESSION_TIME = {
  /** The results screen after every run. */
  resultsSec: 20,
  /** One rewarded ad. */
  adSec: 30,
} as const;
