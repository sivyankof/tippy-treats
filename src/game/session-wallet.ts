/**
 * Berries of this browser session, kept in memory (saving arrives with the save system, M6).
 * Berries earned in a run are added when the run ends; a continue spends them.
 */
export class SessionWallet {
  private amount = 0;

  get berries(): number {
    return this.amount;
  }

  /** Adds whole berries; zero, negative and NaN amounts are ignored, fractions are floored. */
  add(berries: number): void {
    const whole = Math.floor(berries);
    if (whole > 0) this.amount += whole;
  }

  canAfford(cost: number): boolean {
    return cost >= 0 && this.amount >= cost;
  }

  /** Takes `cost` berries; false (and nothing taken) when there are not enough. */
  spend(cost: number): boolean {
    if (!this.canAfford(cost)) return false;
    this.amount -= cost;
    return true;
  }
}

/** The wallet of the running session. */
export const sessionWallet = new SessionWallet();
