import type * as Phaser from 'phaser';
import { GROWN_ACCENT_TEXTURES } from '../../../data/creatures/mastery-look';
import { PALETTE } from '../../../data/common/palette';
import { starPoints } from '../../objects/creatures/creature-art/rainbow-geometry';
import { FIELD_PAD } from '../../../data/common/picture-fields';
import { bakePadded, bakeTexture } from '../../ui/bake-texture';
import { fillPolygon } from '../common/plain-style';

/** Colours of the little bee and the spark (the bee is drawn in its own colours, the breath is white with a pale rim, the spark is pale yellow). */
const BEE = { body: 0xffcf3a, stripe: 0x5a3a12, wing: 0xe9f6ff, outline: 0x6b4a14 } as const;
const SPARK_COLOR = 0xfff3b0;
/** The rim of a breath puff: it leaves the white frosty layer, so a white puff alone would not show. */
const BREATH_RIM = 0x8fc3e6;
const BREATH_RIM_WIDTH = 0.05;
const SPARK_NOTCH = 0.26;
const BREATH_PUFFS: ReadonlyArray<readonly [number, number, number]> = [
  [0.34, 0.58, 0.26],
  [0.62, 0.5, 0.3],
  [0.5, 0.3, 0.22],
];

/** Bakes the pictures of the moving accents of the grown looks; they land on the shared atlas. */
export function bakeGrownAccentTextures(scene: Phaser.Scene): void {
  const { bee, breath, spark } = GROWN_ACCENT_TEXTURES;
  bakePadded(scene, bee.key, bee.w, bee.h, FIELD_PAD.grownBee, (g) => {
    const cx = bee.w / 2;
    const cy = bee.h * 0.62;
    g.fillStyle(BEE.wing, 0.85);
    g.fillEllipse(cx - 5, cy - 8, 11, 14);
    g.fillEllipse(cx + 5, cy - 8, 11, 14);
    g.lineStyle(1.5, BEE.outline, 0.7);
    g.strokeEllipse(cx - 5, cy - 8, 11, 14);
    g.strokeEllipse(cx + 5, cy - 8, 11, 14);
    g.fillStyle(BEE.outline, 1);
    g.fillEllipse(cx, cy, 22, 15);
    g.fillStyle(BEE.body, 1);
    g.fillEllipse(cx, cy, 18, 11);
    g.fillStyle(BEE.stripe, 1);
    g.fillRect(cx - 3, cy - 5, 3, 10);
    g.fillRect(cx + 3, cy - 4, 3, 8);
    g.fillStyle(PALETTE.textLight, 1);
    g.fillCircle(cx - 6, cy - 1, 1.6);
  });
  bakeTexture(scene, breath.key, breath.w, breath.h, (g) => {
    g.fillStyle(BREATH_RIM, 1);
    for (const [x, y, r] of BREATH_PUFFS) {
      g.fillCircle(x * breath.w, y * breath.h, (r + BREATH_RIM_WIDTH) * breath.w);
    }
    g.fillStyle(PALETTE.textLight, 1);
    for (const [x, y, r] of BREATH_PUFFS) g.fillCircle(x * breath.w, y * breath.h, r * breath.w);
  });
  bakeTexture(scene, spark.key, spark.w, spark.h, (g) => {
    g.fillStyle(SPARK_COLOR, 1);
    fillPolygon(g, starPoints(spark.w / 2, spark.h / 2, spark.w / 2 - 1, SPARK_NOTCH, 4));
    g.fillStyle(PALETTE.textLight, 1);
    g.fillCircle(spark.w / 2, spark.h / 2, spark.w * 0.11);
  });
}
