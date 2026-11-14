import { ANIM } from '../../data/anim';
import { RULE_ANIM } from '../../data/rule-anim';
import { clamp01, oscillate01, smoothstep } from '../../util/math';

const cfg = RULE_ANIM.cloud.shadow;

/** How the shadow of the flying layer is drawn this frame. */
export interface ShadowLook {
  /** Fill opacity of the shadow. */
  fillAlpha: number;
  /** Opacity of the light outline; 0 for none. */
  outlineAlpha: number;
}

/**
 * The shadow under a cloud: `density` (0..1, how much the cloud covers the layer) turns the
 * shadow from its normal strength to the clear one and brings a light outline and a gentle
 * pulse. Every part is a continuous function of the density and the clock. With `reduced` only
 * the stronger fill stays. Pure.
 */
export function shadowLook(density: number, nowMs: number, reduced: boolean): ShadowLook {
  const k = smoothstep(clamp01(density));
  const base = ANIM.flying.hintShadowAlpha;
  const fill = base + (cfg.shadowAlpha - base) * k;
  if (reduced) return { fillAlpha: fill, outlineAlpha: 0 };
  const pulse = 1 - cfg.pulse * k * oscillate01(nowMs, cfg.pulsePeriodMs);
  return { fillAlpha: fill * pulse, outlineAlpha: cfg.outlineAlpha * k };
}
