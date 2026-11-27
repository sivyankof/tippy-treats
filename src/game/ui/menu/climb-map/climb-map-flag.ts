import * as Phaser from 'phaser';
import { CLIMB_MAP } from '../../../../data/progression/climb-map';
import { CLIMB_KNOB_KEY, CLIMB_POLE_KEY } from '../../../fx/zones/climb-map-textures';
import { createOutlinedText } from '../../common/outlined-text';
import { faceOffsetY, VolumePlate } from '../../style/volume';
import { fitText } from '../widgets/fit-text';

const cfg = CLIMB_MAP.flag;

export type FlagKind = keyof typeof cfg.fills;

/** A flag on its pole: `holder` stands where the pole's foot is, `inner` is what the animations scale, `cloth` is what sways. */
export interface Flag {
  holder: Phaser.GameObjects.Container;
  inner: Phaser.GameObjects.Container;
  cloth: Phaser.GameObjects.Container;
  /** Strip y of the foot and of the top of the knob: the extent that fades at the edges of the ribbon. */
  foot: number;
  top: number;
}

/** The pole stands this far above the middle of the cloth (half a cloth and half a knob). */
const KNOB_ABOVE = cfg.clothHeight / 2 + cfg.knob / 2 - 4;

/**
 * A flag: a wooden pole with a gold knob, a glossy cloth (a plate of the menu kit with a rim) and
 * its label. The pole stands at (`x`, `footY`) of the strip; the middle of the cloth is at `clothY`
 * (higher than the foot, or moved up so two flags do not overlap). `side` is 1 for a cloth to the
 * right of the pole, -1 for the left. `maxWidth` limits the cloth.
 */
export function createFlag(
  scene: Phaser.Scene,
  kind: FlagKind,
  label: string,
  side: 1 | -1,
  x: number,
  footY: number,
  clothY: number,
  font: number,
  maxWidth: number,
): Flag {
  const look = cfg.fills[kind];
  const text = createOutlinedText(scene, 0, 0, label, font);
  fitText(text, maxWidth - cfg.clothPadX * 2);
  const clothWidth = Math.min(
    maxWidth,
    Math.max(cfg.checkpointWidth, text.displayWidth + cfg.clothPadX * 2),
  );
  const plate = new VolumePlate(scene, 'chip', cfg.clothHeight, look).setBodyWidth(clothWidth);
  const reach = cfg.poleWidth / 2 + clothWidth / 2 - 2;
  text.setY(faceOffsetY('chip'));
  const attachY = clothY - footY;
  // The cloth container sits on the pole at the height of the cloth middle, so it sways about the pole.
  const cloth = scene.add.container(0, attachY, [
    scene.add.container(side * reach, 0, [plate, text]),
  ]);
  const poleTop = attachY - KNOB_ABOVE;
  const pole = scene.add
    .image(0, 0, CLIMB_POLE_KEY)
    .setOrigin(0.5, 1)
    .setScale(1, Math.abs(poleTop) / scene.textures.getFrame(CLIMB_POLE_KEY).height);
  const knob = scene.add.image(0, poleTop, CLIMB_KNOB_KEY).setScale(cfg.knob / (cfg.knob * 2));
  const foot = scene.add
    .image(0, 0, CLIMB_KNOB_KEY)
    .setScale(cfg.footRadius / cfg.knob)
    .setTint(cfg.footColor);
  const inner = scene.add.container(0, 0, [pole, foot, cloth, knob]);
  const holder = scene.add.container(x, footY, [inner]);
  return {
    holder,
    inner,
    cloth,
    foot: footY + cfg.footRadius,
    top: footY + poleTop - cfg.knob / 2,
  };
}

/** The cloth sways about the pole: swings by `deg` and back, forever; returns the tween. */
export function swayFlag(
  scene: Phaser.Scene,
  flag: Flag,
  side: 1 | -1,
  anim: { deg: number; ms: number; ease: string },
): Phaser.Tweens.Tween {
  flag.cloth.setAngle(-anim.deg * side);
  return scene.tweens.add({
    targets: flag.cloth,
    angle: anim.deg * side,
    duration: anim.ms,
    ease: anim.ease,
    yoyo: true,
    repeat: -1,
  });
}
