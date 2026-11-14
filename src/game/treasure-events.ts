/**
 * Game-level events (`game.events`) between the run scene and the HUD scene: the run scene
 * knows where a coin or berry is earned, the HUD scene draws its flight to the counter.
 * Coordinates are screen pixels (the HUD scene has no camera scroll).
 */
export const TREASURE_EVENTS = {
  coinFly: 'treasure:coin-fly',
  berryPop: 'treasure:berry-pop',
} as const;

/** Coins to fly from (x, y) into the coin counter. */
export interface CoinFlyPayload {
  x: number;
  y: number;
  /** Coins this payout is worth; the counter rises by it when the coins arrive. */
  amount: number;
  /** One caught coin that hops before it flies (the floating coin). Otherwise a few small coins fly. */
  hop: boolean;
}
