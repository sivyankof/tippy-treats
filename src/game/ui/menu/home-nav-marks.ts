import * as Phaser from 'phaser';
import { isComplete } from '../../../core/missions';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { gameState } from '../../../state';

const { navDots: dots, navAlert: alert } = MENU.home;

/** The marks on a nav button: progress dots above it and a red dot in its corner. */
export class NavMarks {
  private readonly dotsLayer: Phaser.GameObjects.Graphics;
  private readonly alertLayer: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    private readonly size: number,
  ) {
    this.dotsLayer = scene.add.graphics();
    this.alertLayer = scene.add.graphics();
    parent.add([this.dotsLayer, this.alertLayer]);
  }

  /** One dot per entry, filled for `true`. */
  setDots(done: readonly boolean[]): void {
    const g = this.dotsLayer.clear();
    const step = dots.size + dots.gap;
    const y = -this.size / 2 - dots.offsetY;
    done.forEach((filled, i) => {
      const x = (i - (done.length - 1) / 2) * step;
      g.fillStyle(PALETTE.textDark, 1).fillCircle(x, y, dots.size / 2 + dots.outline);
      g.fillStyle(filled ? dots.on : dots.off, 1).fillCircle(x, y, dots.size / 2);
    });
  }

  setAlert(on: boolean): void {
    const g = this.alertLayer.clear();
    if (!on) return;
    const x = this.size / 2 - alert.offsetX;
    const y = -this.size / 2 + alert.offsetY;
    g.fillStyle(PALETTE.textLight, 1).fillCircle(x, y, alert.size / 2 + alert.outline);
    g.fillStyle(alert.fill, 1).fillCircle(x, y, alert.size / 2);
  }
}

/** True while something of the missions waits for the player: a reward or the chest. */
export function missionsWaiting(): boolean {
  const { items, chestClaimed } = gameState.missions;
  const allClaimed = items.length > 0 && items.every((item) => item.claimed);
  return gameState.claimableMissions > 0 || (allClaimed && !chestClaimed);
}

/** Done flags of the missions of the day, for the dots. */
export function missionDots(): boolean[] {
  return gameState.missions.items.map((item) => isComplete(item));
}

/** The daily tower is open and today's attempt is still unused. */
export function dailyWaiting(): boolean {
  const info = gameState.dailyInfo();
  return info.unlocked && info.attemptsLeft > 0;
}
