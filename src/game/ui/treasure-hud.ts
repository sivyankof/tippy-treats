import type * as Phaser from 'phaser';
import { TREASURE_TEXTURES } from '../fx/treasure-textures';
import { ResourceCounter } from './resource-counter';
import { TreasureFlights } from './treasure-flights';

/** What the treasure HUD reads of the run. */
export interface TreasureInfo {
  coins: number;
  berries: number;
  paused: boolean;
}

/**
 * The coin counter in the top right corner, the berry counter under it (it shows up with the
 * first berry of the run) and the coins and berries flying into them.
 */
export class TreasureHud {
  private readonly coins: ResourceCounter;
  private readonly berries: ResourceCounter;
  private readonly flights: TreasureFlights;

  constructor(scene: Phaser.Scene) {
    this.coins = new ResourceCounter(scene, {
      texture: TREASURE_TEXTURES.coin,
      row: 0,
      hiddenUntilFirst: false,
    });
    this.berries = new ResourceCounter(scene, {
      texture: TREASURE_TEXTURES.berry,
      row: 1,
      hiddenUntilFirst: true,
    });
    this.flights = new TreasureFlights(scene, this.coins, this.berries);
  }

  /** The parts that slide in with the screen. */
  get parts(): Phaser.GameObjects.Container[] {
    return [this.coins.root];
  }

  layout(screenWidth: number): void {
    this.coins.layout(screenWidth);
    this.berries.layout(screenWidth);
  }

  /** `covered`: a window (pause, "Continue?") is over the run; the flights hide and wait. */
  update(info: Readonly<TreasureInfo>, timeMs: number, dtMs: number, covered = false): void {
    // A covered run stands still: coins in flight wait for it.
    const still = info.paused || covered;
    this.flights.setPaused(still);
    this.flights.update(still ? 0 : dtMs);
    this.coins.update(info.coins, timeMs, dtMs);
    this.berries.update(info.berries, timeMs, dtMs);
  }

  destroy(): void {
    this.flights.destroy();
  }
}
