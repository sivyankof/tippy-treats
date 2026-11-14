import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { createOutlinedText } from '../outlined-text';

const cfg = MENU.home;

/**
 * A speech bubble pointing down at Play ("Add a creature to your team!"), bobbing gently.
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
  const width = Math.min(wrap, label.width) + padX * 2;
  const height = label.height + padY * 2;
  const total = height + tail;
  const bodyY = -total / 2 + height / 2;
  label.setY(bodyY);
  const g = scene.add.graphics();
  g.fillStyle(PALETTE.textDark, 1).fillRoundedRect(
    -width / 2,
    bodyY - height / 2 + 6,
    width,
    height,
    radius,
  );
  g.fillStyle(fill, 1).fillRoundedRect(-width / 2, bodyY - height / 2, width, height, radius);
  g.fillTriangle(-tail, bodyY + height / 2 - 2, tail, bodyY + height / 2 - 2, 0, total / 2);

  const inner = scene.add.container(0, 0, [g, label]);
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
