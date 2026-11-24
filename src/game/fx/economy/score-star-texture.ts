import type * as Phaser from 'phaser';
import { SCORE_STAR } from '../../../data/economy/score-star-look';
import { bakeTexture } from '../../ui/common/bake-texture';
import {
  OUTLINE_SHARE,
  drawGlossMark,
  drawTwoToneBody,
  glossFromShares,
  type Pt,
} from '../common/plain-style';

/**
 * Key of the gold star of the score tile; not meant for tinting. It keeps a texture of its own
 * (no `tr_` prefix): it shows only on the results, and the shared atlas is kept for the run.
 */
export const SCORE_STAR_KEY = 'ui_score_star';

const ROUND_STEPS = 4;

/** Corners of a five-point star around (cx, cy), the top point first. */
function starCorners(cx: number, cy: number, r: number): Pt[] {
  const corners: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * SCORE_STAR.inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    corners.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
  }
  return corners;
}

/** The corners rounded: each one becomes a short curve between points `cut` along its two edges. */
function roundCorners(corners: readonly Pt[], cut: number): Pt[] {
  const out: Pt[] = [];
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const prev = corners[(i + n - 1) % n] as Pt;
    const at = corners[i] as Pt;
    const next = corners[(i + 1) % n] as Pt;
    const toward = (to: Pt): Pt => {
      const dx = to.x - at.x;
      const dy = to.y - at.y;
      const k = Math.min(0.45, cut / Math.hypot(dx, dy));
      return { x: at.x + dx * k, y: at.y + dy * k };
    };
    const a = toward(prev);
    const b = toward(next);
    for (let s = 0; s <= ROUND_STEPS; s++) {
      const t = s / ROUND_STEPS;
      // A quadratic curve from a to b with the corner as its control point.
      const u = 1 - t;
      out.push({
        x: u * u * a.x + 2 * u * t * at.x + t * t * b.x,
        y: u * u * a.y + 2 * u * t * at.y + t * t * b.y,
      });
    }
  }
  return out;
}

/** The star as a body shape of the manner (it ignores `ry`: the star is round). */
function starShape(cx: number, cy: number, rx: number): Pt[] {
  return roundCorners(starCorners(cx, cy, rx), rx * SCORE_STAR.round);
}

/** Bakes the gold star once: warm outline, two flat tones and a highlight (docs/06, «Манера картинок»). */
export function bakeScoreStar(scene: Phaser.Scene): void {
  const { size, pad } = SCORE_STAR;
  const c = size / 2;
  const outline = size * OUTLINE_SHARE;
  const r = c - pad - outline;
  // A five-point star sits a little high in its circle: its lowest points are at 0.81 of the radius.
  const cy = c + r * 0.08;
  bakeTexture(scene, SCORE_STAR_KEY, size, size, (g) => {
    drawTwoToneBody(g, (x, y, rx) => starShape(x, y, rx), c, cy, r, r, {
      base: SCORE_STAR.base,
      shadow: SCORE_STAR.shadow,
      grow: outline,
      band: SCORE_STAR.band,
    });
    drawGlossMark(
      g,
      glossFromShares(SCORE_STAR.shine, c, cy, r, SCORE_STAR.shineColor, SCORE_STAR.shineAlpha),
    );
  });
}

/** The star as an image, baked on first use. */
export function createScoreStar(scene: Phaser.Scene): Phaser.GameObjects.Image {
  bakeScoreStar(scene);
  return scene.add.image(0, 0, SCORE_STAR_KEY);
}
