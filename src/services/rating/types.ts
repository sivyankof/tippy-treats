/**
 * The system's rating window (StoreKit on iOS, Play In-App Review on Android). The game has no
 * window of its own for it (docs/09-services-analytics.md, section 12).
 */
export interface RatingService {
  /**
   * Asks the system to show its rating window. The system decides whether it shows (it keeps its
   * own quotas and tells the app nothing); a failure never throws.
   */
  requestReview(): Promise<void>;
}
