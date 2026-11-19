/**
 * Creature mastery (docs/03-creatures.md, "Мастерство"): the level of the new look, the level of
 * the master effect and every number of the master effects. The ladder properties that grow by
 * level (rainbow score per protected layer, rainbow own layer, ghost centre mark) live in the
 * ability definitions of data/creatures/creatures.ts. Numbers marked "tuned" are set by the simulation.
 */
export const MASTERY = {
  /** From this creature level on the creature has its new look. */
  lookLevel: 3,
  /** Only an effect of a creature of this level runs its master effect. */
  masterLevel: 5,
  /** Honey trail: flat coins for every perfect drop under the sticky effect. */
  honey: { perfectCoins: 1 },
  /** Sugar dust: score per pixel the puff really widened the layer (tuned). */
  puff: { scorePerPx: 1 },
  /** Long bounce: one more layer springs with this share of the spring (P / 2). */
  jelly: { tailLayers: 1, tailShareMult: 0.5 },
  /** Gold vein: a normal drop on a golden layer pays its coins this many times (tuned). */
  caramel: { goldenCoinMult: 3 },
  /** Rime: the first layer after the freeze gets the base perfect tolerance plus this many px. */
  frosty: { tailLayers: 1, toleranceAdd: 5 },
  /** Change: coins when the shield saves a miss or a sneeze. */
  brownie: { shieldCoins: 5 },
  /** Volley: a perfect drop under the fireworks extends them, at most `maxExtend` per trigger. */
  sprinkle: { extendLayers: 1, maxExtend: 2 },
  /** Hoarder: a cut piece wider than this share of the flying width pays extra coins (tuned). */
  crumb: { pieceShare: 0.3, coins: 3 },
  /** Peace: a perfect twins layer pays these coins. */
  twins: { perfectCoins: 5 },
  /** Swagger: every layer of one lemon trigger perfect pays these coins on the last one. */
  lemon: { allPerfectCoins: 10 },
  /** After the rain: a perfect protected layer does not use the protection, this often per trigger. */
  rainbow: { returns: 1 },
} as const;

/**
 * New properties a level step brings that are not a changed number of the ability text
 * (docs/03-creatures.md, "Что даёт каждый шаг"); i18n `mastery.perk.<id>`.
 */
export type PerkId = 'ghost_centre_mark' | 'rainbow_protected_score' | 'rainbow_own_layer';
