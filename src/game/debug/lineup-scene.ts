import * as Phaser from 'phaser';
import type { CutSide } from '../../core/drop';
import { BALANCE } from '../../data/balance';
import { CREATURE_IDS, type CreatureId } from '../../data/creatures';
import { LINEUP } from '../../data/lineup';
import { DEPTH } from '../depth';
import { LayerView } from '../objects/layer-view';
import { SCENES } from '../scene-keys';

/**
 * Temporary art-review screen (`?lineup=1`, dev build): all 12 creature layers as a tower with
 * different widths and cut sides on the left, and as separate whole layers on the right.
 */
export class LineupScene extends Phaser.Scene {
  private readonly views: LayerView[] = [];

  constructor() {
    super(SCENES.lineup);
  }

  create(): void {
    const { height } = this.scale.gameSize;
    const stackBottom = height - LINEUP.margin;
    CREATURE_IDS.forEach((id, i) => {
      const cut = LINEUP.stackCuts[i % LINEUP.stackCuts.length] ?? null;
      const width = LINEUP.stackWidths[i % LINEUP.stackWidths.length] ?? LINEUP.rowWidth;
      const y = stackBottom - (i + 0.5) * BALANCE.layer.height;
      this.place(id, i, LINEUP.stackX, y, width, cut, DEPTH.tower + i * DEPTH.towerLayerStep);
    });
    const step = Math.min(LINEUP.rowStep, (height - LINEUP.margin * 2) / CREATURE_IDS.length);
    CREATURE_IDS.forEach((id, i) => {
      const y = LINEUP.margin + step * (i + 0.5);
      this.place(
        id,
        i,
        LINEUP.rowX,
        y,
        LINEUP.rowWidth,
        null,
        DEPTH.tower + i * DEPTH.towerLayerStep,
      );
    });
  }

  override update(_time: number, delta: number): void {
    for (const view of this.views) view.tick(delta);
  }

  private place(
    id: CreatureId,
    index: number,
    x: number,
    y: number,
    width: number,
    cut: CutSide | null,
    depth: number,
  ): void {
    const view = new LayerView(this)
      .setLook({ kind: 'creature', creature: id, level: LINEUP.level })
      .setLayer(index + 1, width, cut)
      .setPosition(x, y)
      .setDepth(depth);
    this.views.push(view);
  }
}
