import * as Phaser from 'phaser';
import type { PerfPart } from '../../data/perf';
import { LayerView } from '../objects/layer-view';
import { SCENES } from '../scene-keys';
import { perfPartOf } from './perf-marks';

interface Showable {
  readonly visible: boolean;
  setVisible(value: boolean): unknown;
}

/**
 * `&nobg`, `&nofar`, `&nohud`, `&notower`: the parts are hidden only while the frame is drawn and
 * shown again right after it, so the game logic (and its own visibility switches) never sees it.
 * Backdrop and far plane are the marked children of the zone containers, the tower is every layer
 * view of the run scene (the flying and falling layers too), the HUD is its whole scene.
 */
export function hidePartsWhileDrawing(game: Phaser.Game, parts: readonly PerfPart[]): void {
  if (parts.length === 0) return;
  const hidden: Showable[] = [];
  let hudHidden = false;
  const hide = (object: Showable): void => {
    if (!object.visible) return;
    object.setVisible(false);
    hidden.push(object);
  };
  const hideRunParts = (list: readonly Phaser.GameObjects.GameObject[]): void => {
    for (const object of list) {
      if (object instanceof LayerView) {
        if (parts.includes('tower')) hide(object);
      } else if (object instanceof Phaser.GameObjects.Container) {
        for (const child of object.list) {
          const part = perfPartOf(child);
          if (part && parts.includes(part)) hide(child as unknown as Showable);
        }
      }
    }
  };
  game.events.on(Phaser.Core.Events.PRE_RENDER, () => {
    const run = game.scene.getScene(SCENES.game) as Phaser.Scene | null;
    if (run?.sys.isActive()) hideRunParts(run.sys.displayList.list);
    const hud = game.scene.getScene(SCENES.hud) as Phaser.Scene | null;
    if (parts.includes('hud') && hud?.sys.settings.visible) {
      hud.sys.settings.visible = false;
      hudHidden = true;
    }
  });
  game.events.on(Phaser.Core.Events.POST_RENDER, () => {
    for (const object of hidden) object.setVisible(true);
    hidden.length = 0;
    const hud = game.scene.getScene(SCENES.hud) as Phaser.Scene | null;
    if (hudHidden && hud) hud.sys.settings.visible = true;
    hudHidden = false;
  });
}
