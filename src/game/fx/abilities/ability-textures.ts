import type * as Phaser from 'phaser';
import { ABILITY_ANIM } from '../../../data/ability-anim';
import { ANIM } from '../../../data/anim';
import { BALANCE } from '../../../data/balance';
import { PALETTE } from '../../../data/palette';
import { DEG_TO_RAD } from '../../../util/math';
import { bakeTexture } from '../../ui/bake-texture';

/** Keys of the textures the ability effects share. All but the bubble are white and meant to be tinted. */
export const ABILITY_TEXTURES = {
  /** A rounded bar: a honey thread. */
  strand: 'fx_strand',
  /** The body of a layer without its outline: a tinted overlay on a layer. */
  coat: 'fx_coat',
  /** A vertical line of dashes. */
  dash: 'fx_dash',
  /** A frame of soft light along the edges of a picture. */
  vignette: 'fx_vignette',
  /** The translucent chocolate and the lower arc of the brownie's bubble: drawn behind the tower (not meant for tinting). */
  bubbleFill: 'fx_bubble_fill',
  /** The upper arc and the highlight of the bubble: drawn in front of the tower (not meant for tinting). */
  bubbleRim: 'fx_bubble_rim',
} as const;

const { strand, coatWidth, dash, vignette, bubble } = ABILITY_ANIM.textures;

export const STRAND_SIZE = strand;
/** Size of the coat texture: the layer body inside its outline, in a standard width. */
export const COAT_SIZE = {
  width: coatWidth,
  height: BALANCE.layer.height - ANIM.layer.outline * 2,
} as const;
export const DASH_SIZE = dash;

/** Bakes the ability textures. Safe to call again: existing keys are kept. */
export function createAbilityTextures(scene: Phaser.Scene): void {
  const white = PALETTE.textLight;

  bakeTexture(scene, ABILITY_TEXTURES.strand, strand.width, strand.height, (g) => {
    g.fillStyle(white, 1).fillRoundedRect(0, 0, strand.width, strand.height, strand.width / 2);
  });

  bakeTexture(scene, ABILITY_TEXTURES.coat, COAT_SIZE.width, COAT_SIZE.height, (g) => {
    const radius = ANIM.layer.cornerRadius - ANIM.layer.outline;
    g.fillStyle(white, 1).fillRoundedRect(0, 0, COAT_SIZE.width, COAT_SIZE.height, radius);
  });

  bakeTexture(scene, ABILITY_TEXTURES.dash, dash.width, dash.height, (g) => {
    g.fillStyle(white, 1);
    for (let y = 0; y < dash.height; y += dash.period) {
      g.fillRoundedRect(0, y, dash.width, dash.length, dash.width / 2);
    }
  });

  // Concentric frames, fading cubically towards the middle.
  bakeTexture(scene, ABILITY_TEXTURES.vignette, vignette.width, vignette.height, (g) => {
    for (let i = 0; i < vignette.steps; i++) {
      const inset = i * vignette.stepPx;
      g.lineStyle(vignette.stepPx, white, vignette.alpha * Math.pow(1 - i / vignette.steps, 3));
      g.strokeRect(
        inset + vignette.stepPx / 2,
        inset + vignette.stepPx / 2,
        vignette.width - inset * 2 - vignette.stepPx,
        vignette.height - inset * 2 - vignette.stepPx,
      );
    }
  });

  // The back half lies behind the tower: the faint fill, the edge glow and the lower rim.
  // The front half is the upper rim, the film and the highlight, so no line cuts across the layers.
  const half = bubble.size / 2;
  const radius = half - bubble.rimWidth / 2;
  bakeTexture(scene, ABILITY_TEXTURES.bubbleFill, bubble.size, bubble.size, (g) => {
    g.fillStyle(bubble.fill, bubble.fillAlpha).fillCircle(half, half, radius);
    const glowDepth = radius * bubble.glowShare;
    const step = glowDepth / bubble.glowSteps;
    for (let i = 0; i < bubble.glowSteps; i++) {
      // Rings nearer the edge are stronger.
      const share = (i + 1) / bubble.glowSteps;
      g.lineStyle(step, bubble.glow, (bubble.glowAlpha * share * share) / 2);
      g.strokeCircle(half, half, radius - glowDepth + step * (i + 0.5));
    }
    strokeRim(g, half, radius, 0, Math.PI);
  });
  bakeTexture(scene, ABILITY_TEXTURES.bubbleRim, bubble.size, bubble.size, (g) => {
    strokeRim(g, half, radius, Math.PI, Math.PI * 2);
    g.lineStyle(bubble.shineWidth, bubble.shine, bubble.shineAlpha);
    g.beginPath();
    g.arc(
      half,
      half,
      radius - bubble.shineInset,
      bubble.shineFromDeg * DEG_TO_RAD,
      bubble.shineToDeg * DEG_TO_RAD,
    );
    g.strokePath();
    g.fillStyle(bubble.shine, bubble.sparkAlpha);
    g.fillCircle(
      bubble.size * bubble.sparkX,
      bubble.size * bubble.sparkY,
      bubble.size * bubble.sparkR,
    );
  });
}

/** The light rim of the bubble and the rainbow film just inside it, between two angles (radians). */
function strokeRim(
  g: Phaser.GameObjects.Graphics,
  half: number,
  radius: number,
  from: number,
  to: number,
): void {
  const { bubble } = ABILITY_ANIM.textures;
  bubble.film.forEach((color, i) => {
    g.lineStyle(bubble.filmWidth, color, bubble.filmAlpha);
    g.beginPath();
    g.arc(half, half, radius - bubble.filmGap * (i + 1), from, to);
    g.strokePath();
  });
  g.lineStyle(bubble.rimWidth, bubble.rim, bubble.rimAlpha);
  g.beginPath();
  g.arc(half, half, radius, from, to);
  g.strokePath();
}
