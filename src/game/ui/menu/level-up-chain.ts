import type * as Phaser from 'phaser';
import type { LevelUp } from '../../../state/game-state';
import { LevelUpPanel } from './level-up-panel';

/**
 * Opens the level-up window of every level in `levelUps`, one after another, over whatever the
 * scene shows (the missions window pays XP outside a run). `onDone` runs after the last one closes.
 */
export function showLevelUps(
  scene: Phaser.Scene,
  levelUps: readonly LevelUp[],
  onDone: () => void = () => {},
): void {
  let panel: LevelUpPanel | null = null;
  const onUpdate = (_time: number, delta: number): void => panel?.tick(delta);
  scene.events.on('update', onUpdate);
  const next = (index: number): void => {
    const levelUp = levelUps[index];
    if (!levelUp) {
      scene.events.off('update', onUpdate);
      onDone();
      return;
    }
    panel = new LevelUpPanel(scene, levelUp, () => {
      panel = null;
      next(index + 1);
    });
  };
  next(0);
}
