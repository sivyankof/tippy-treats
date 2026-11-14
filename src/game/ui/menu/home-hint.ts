import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { shade } from '../../../util/color';
import { bakeTexture } from '../bake-texture';
import { createOutlinedText } from '../outlined-text';
import { drawVolume, faceOffsetY, lookOf, shadowMargin } from '../style/volume';

const cfg = MENU.home;
const S = MENU.style;

/**
 * A glossy speech bubble pointing down at Play ("Add a creature to your team!"), bobbing gently.
 * `root` is placed at the middle of the bubble with its tail; tapping it calls `onTap`.
 */
export function createHintBubble(
  scene: Phaser.Scene,
  text: string,
  onTap: () => void,
): { root: Phaser.GameObjects.Container; setEnabled: (enabled: boolean) => void } {
  const { wrap, padX, padY, radius, tail, bobPx, bobMs, fill } = cfg.bubble;
  const label = createOutlinedText(scene, 0, 0, text, cfg.hintFont).setWordWrapWidth(wrap);
  label.setAlign('center');
  const width = Math.round(Math.min(wrap, label.width) + padX * 2);
  const height = Math.round(label.height + padY * 2);
  const total = height + tail;
  label.setY(-total / 2 + height / 2 + faceOffsetY('chip'));

  const look = lookOf('chip', radius);
  const m = shadowMargin(look);
  const key = `ui_home_hint_${width}x${height}`;
  const textureWidth = width + m.side * 2;
  const textureHeight = total + m.top + m.bottom;
  bakeTexture(scene, key, textureWidth, textureHeight, (g) => {
    const cx = textureWidth / 2;
    const base = m.top + height - look.outline * 2;
    const tip = m.top + total;
    const triangle = (grow: number, dy: number): void => {
      g.fillTriangle(cx - tail - grow, base + dy, cx + tail + grow, base + dy, cx, tip + grow + dy);
    };
    g.fillStyle(S.shadowColor, look.shadowAlpha);
    triangle(0, look.shadowOffset);
    g.fillStyle(shade(fill, S.outlineShade), 1);
    triangle(look.outline, 0);
    drawVolume(g, m.side, m.top, width, height, look, { fill });
    g.fillStyle(shade(fill, S.bevelShade), 1);
    triangle(0, 0);
  });
  const bubble = scene.add.image(0, -total / 2 - m.top, key).setOrigin(0.5, 0);

  const inner = scene.add.container(0, 0, [bubble, label]);
  const root = scene.add.container(0, 0, [inner]);
  root.setSize(width, total);
  const hit = new Phaser.Geom.Rectangle(0, 0, width, total);
  // The container hit area starts at the top-left corner of its size, which is centred on (0, 0).
  root.setInteractive(hit, Phaser.Geom.Rectangle.Contains);
  root.on(Phaser.Input.Events.POINTER_UP, onTap);
  scene.tweens.add({
    targets: inner,
    y: bobPx,
    duration: bobMs,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1,
  });
  return {
    root,
    setEnabled: (enabled) => {
      if (enabled) root.setInteractive(hit, Phaser.Geom.Rectangle.Contains);
      else root.disableInteractive();
    },
  };
}
