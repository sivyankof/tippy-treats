import type * as Phaser from 'phaser';
import { BALANCE } from '../../../data/tower/balance';
import { hudTopShift } from '../../run/camera-layout';
import type { RunCamera } from '../../run/run-camera';
import type { TutorialDirector } from '../../tutorial/tutorial-director';
import type { RunFx } from './run-fx';

/**
 * Tells the director where the tower top and the creature layer are, so hints can be placed. The hints
 * live in the HUD scene, which is laid out below the top inset: the places are in its coordinates.
 */
export function placeTutorialTarget(
  tutorial: TutorialDirector,
  fx: RunFx,
  runCamera: RunCamera,
  camera: Phaser.Cameras.Scene2D.Camera,
): void {
  // Where the top of the tower settles on the screen: hints keep out of the flying row above it.
  const shift = hudTopShift();
  tutorial.towerTopY = fx.tower.topY() - runCamera.targetScrollY() - shift;
  const span = fx.tower.topSpan();
  tutorial.towerSpan.left = span.left - camera.scrollX;
  tutorial.towerSpan.right = span.right - camera.scrollX;
  const shadow = fx.shadowAnchor();
  tutorial.shadow.valid = shadow.visible;
  if (shadow.visible) {
    tutorial.shadow.x = shadow.x - camera.scrollX;
    tutorial.shadow.y = shadow.y - camera.scrollY - shift;
  }
  if (!tutorial.holding) return;
  const pose = fx.tower.layerPose(tutorial.introLayerIndex);
  if (!pose) return;
  tutorial.setTarget(
    pose.x - camera.scrollX,
    pose.y - BALANCE.layer.height / 2 - camera.scrollY - shift,
  );
}
