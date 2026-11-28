/** The windows of the day that Home may open by itself, in the order of their priority. */
export type DayWindow = 'streak' | 'oven' | 'offer';

/** What is waiting on this Home entry and what already happened on it. */
export interface DayWindowInput {
  /** The first Home entry of the player's life: nothing opens by itself. */
  firstHome: boolean;
  /** A question (cloud, consent, notifications) already put a window up on this entry. */
  askShown: boolean;
  /** The threat window or today's calendar reward is waiting. */
  streakPending: boolean;
  /** The oven explainer has not been shown yet. */
  ovenPending: boolean;
  /** The "No ads" offer is due. */
  offerPending: boolean;
}

/**
 * The one window of the day for this Home entry, or null. The streak (a daily reward) goes first,
 * the oven explainer second, the offer last. What is not picked stays pending for the next entry.
 */
export function pickDayWindow(input: DayWindowInput): DayWindow | null {
  if (input.firstHome || input.askShown) return null;
  if (input.streakPending) return 'streak';
  if (input.ovenPending) return 'oven';
  if (input.offerPending) return 'offer';
  return null;
}
