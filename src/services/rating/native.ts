import type { RatingService } from './types';

/** What the game needs of `@capacitor-community/in-app-review` (injected, so tests run without the app). */
export interface InAppReviewPlugin {
  requestReview(): Promise<void>;
}

/** The iOS and Android app: the system rating window through the in-app review plugin. */
export class NativeRating implements RatingService {
  constructor(private readonly plugin: InAppReviewPlugin) {}

  async requestReview(): Promise<void> {
    try {
      await this.plugin.requestReview();
    } catch {
      // The system may refuse (its own quota, no store); the game goes on.
    }
  }
}
