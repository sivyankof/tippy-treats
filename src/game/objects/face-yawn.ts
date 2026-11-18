import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { TOWER_WEATHER } from '../../data/tower-weather';
import { smoothstep } from '../../util/math';

const YAWN = TOWER_WEATHER.sleepy.yawn;

/** Whole length of a yawn, ms: the draw-up, the gape, the close. */
export const YAWN_TOTAL_MS = YAWN.prepMs + YAWN.gapeMs + YAWN.closeMs;

/** How the face looks at one moment of a yawn. */
export interface YawnPose {
  /** The mouth gapes this much (0 shut, 1 as wide as it goes). */
  open: number;
  /** The face is taller by this share of its height (negative: squashed). */
  stretch: number;
  /** The face rides this many px up. */
  lift: number;
}

/** Share of the close in which the mouth shuts; the smack follows in the rest. */
const SHUT_SHARE = 0.4;
/** The small second opening of the smack. */
const SMACK = { at: 0.68, width: 0.2, open: 0.16 };

/**
 * The yawn `ms` after it began: the face draws itself up (eyes shut, a little taller and higher) over `prepMs`, the
 * mouth opens wide and holds over `gapeMs` with the face stretched a bit more, then over `closeMs` the mouth shuts, smacks
 * once, and the face springs back through a small squash. `null` once it is over. Fills and returns `out`.
 */
export function yawnPose(ms: number, out: YawnPose): YawnPose | null {
  if (ms < 0 || ms >= YAWN_TOTAL_MS) return null;
  if (ms < YAWN.prepMs) {
    const k = smoothstep(ms / YAWN.prepMs);
    out.open = 0;
    out.stretch = YAWN.stretchPrep * k;
    out.lift = YAWN.liftPx * k;
    return out;
  }
  const gapeAt = ms - YAWN.prepMs;
  if (gapeAt < YAWN.gapeMs) {
    const k = smoothstep(gapeAt / YAWN.gapeMs);
    // The mouth opens over the first fifth, then breathes a little while it is held.
    const opening = smoothstep(Math.min(1, gapeAt / (YAWN.gapeMs * 0.2)));
    out.open = opening * (1 - 0.06 * Math.sin((gapeAt / YAWN.gapeMs) * Math.PI * 2));
    out.stretch = YAWN.stretchPrep + (YAWN.stretchGape - YAWN.stretchPrep) * k;
    out.lift = YAWN.liftPx;
    return out;
  }
  const u = (gapeAt - YAWN.gapeMs) / YAWN.closeMs;
  const shut = smoothstep(Math.min(1, u / SHUT_SHARE));
  const smack = Math.max(0, 1 - Math.abs(u - SMACK.at) / SMACK.width) * SMACK.open;
  out.open = 1 - shut + smack * shut;
  // Down from the stretch, past the rest shape (the squash) and back: a damped spring.
  const spring = Math.sin(Math.PI * Math.max(0, Math.min(1, (u - SHUT_SHARE) / (1 - SHUT_SHARE))));
  out.stretch = YAWN.stretchGape * (1 - smoothstep(u)) - YAWN.squashClose * spring;
  out.lift = YAWN.liftPx * (1 - smoothstep(u));
  return out;
}

/** Where the yawning mouth is placed and how big it is (face px; the picture's origin is at `mouthOriginY`). */
export interface YawnMouth {
  y: number;
  scale: number;
}

/**
 * Fits the mouth of the yawn into the body of the layer: its top hangs just under the shut eyes and its bottom, with the
 * face stretch, lift and the face scale taken into account, stays `bottomMarginPx` above the inner edge of the bottom
 * outline of the layer. A narrow layer (a small face) or a stretched one gets a smaller mouth, never one past the body.
 * `faceY` is the face centre from the layer centre, `faceScale` the face's scale on this layer. Fills and returns `out`.
 */
export function fitYawnMouth(
  open: number,
  stretch: number,
  lift: number,
  faceY: number,
  faceScale: number,
  out: YawnMouth,
): YawnMouth {
  const Y = YAWN;
  const limit = BALANCE.layer.height / 2 - ANIM.layer.outline - Y.bottomMarginPx;
  const bottomMax = ((limit - faceY) / faceScale + lift) / (1 + stretch);
  const room = Math.max(0, bottomMax - Y.mouthTopPx);
  const shown = Math.max(open, 0.01);
  out.scale = Math.min(Y.mouthScale, room / (Y.mouthPicturePx * shown));
  out.y = Y.mouthTopPx + Y.mouthOriginY * Y.mouthPicturePx * out.scale * shown;
  return out;
}
