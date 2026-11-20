/** Numbers of the real-money purchases (docs/09-services-analytics.md, section 5). */
export const IAP_RULES = {
  /**
   * Store transactions already paid out that the save remembers, newest last. A consumable whose
   * transaction is on the list is never paid again.
   */
  processedTxKeep: 50,
  /**
   * A completed transaction found at launch that was never paid here (an approved "Ask to Buy",
   * an app killed between the store's answer and the payout) is paid only when it is at most this
   * many days old. Together with the list above, a transaction pushed out of the list long ago is
   * never paid again.
   */
  launchPayoutDays: 7,
} as const;
