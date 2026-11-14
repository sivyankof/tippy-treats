import type * as Phaser from 'phaser';
import type { SimEvent, TowerState } from '../../core/tower-sim';
import { BALANCE } from '../../data/balance';
import { FloatingCoin } from '../objects/floating-coin';
import type { TowerView } from '../objects/tower-view';
import { TREASURE_EVENTS, type CoinFlyPayload } from '../treasure-events';
import { payoutFromEvents } from './payout';
import type { Particles } from './particles';

const HALF_LAYER = BALANCE.layer.height / 2;

/** The part of the camera the coin effects need. */
interface Camera {
  scrollY: number;
  width: number;
  height: number;
}

/**
 * Coins and berries of the run: the coin that hangs where the layer lands, and the hand-over
 * of every payout to the HUD scene, which flies the coins into its counter.
 */
export class CoinFx {
  private readonly coin: FloatingCoin;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tower: TowerView,
    particles: Particles,
  ) {
    this.coin = new FloatingCoin(scene, particles);
  }

  /** Call before `update` of the step: the coin still hangs where it was when the layer landed. */
  handleEvents(events: readonly SimEvent[], state: Readonly<TowerState>, cam: Camera): void {
    const pay = payoutFromEvents(events);
    const bus = this.scene.game.events;
    let other = pay.other;

    const at = this.coin.position();
    if (pay.floating > 0 && at) {
      const payload: CoinFlyPayload = {
        x: at.x,
        y: at.y - cam.scrollY,
        amount: pay.floating,
        hop: true,
      };
      this.coin.take();
      bus.emit(TREASURE_EVENTS.coinFly, payload);
    } else {
      other += pay.floating;
      if (pay.resolved) this.coin.popAway();
    }

    if (other > 0) {
      const top = this.tower.layerPose(state.layers.length - 1);
      const payload: CoinFlyPayload = {
        x: top?.x ?? BALANCE.tray.centerX,
        y: top ? top.y - cam.scrollY : cam.height / 2,
        amount: other,
        hop: false,
      };
      bus.emit(TREASURE_EVENTS.coinFly, payload);
    }
    if (pay.berry) bus.emit(TREASURE_EVENTS.berryPop);
  }

  update(dtMs: number, timeMs: number, state: Readonly<TowerState>): void {
    if (state.floatingCoinX !== null) {
      this.coin.hang(state.floatingCoinX, this.tower.topY() - HALF_LAYER);
    } else if (this.coin.position()) {
      // The coin is gone from the sim without a landing or a miss (a retried layer).
      this.coin.popAway();
    }
    this.coin.update(dtMs, timeMs);
  }
}
