import type { RatingService } from './types';

/** The browser has no rating window: a line in the console where the debug tools are, nothing in a player's build. */
export class WebRating implements RatingService {
  constructor(private readonly log: ((line: string) => void) | null) {}

  requestReview(): Promise<void> {
    this.log?.('[rating] the system rating window would show here');
    return Promise.resolve();
  }
}
