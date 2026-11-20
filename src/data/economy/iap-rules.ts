/** Numbers of the real-money purchases (docs/09-services-analytics.md, section 5). */
export const IAP_RULES = {
  /**
   * Store transactions already paid out that the save remembers, newest last. A consumable whose
   * transaction is on the list is never paid again.
   */
  processedTxKeep: 50,
} as const;
