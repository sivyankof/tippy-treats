import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { services } from '../../../services';
import { arcPoint, burstSpot, splitAmount, type Point } from '../../fx/coin-flight-math';
import { createTreasureTextures, TREASURE_TEXTURES } from '../../fx/treasure-textures';
import type { ResourceCounter } from '../resource-tally';

const cfg = MENU.rewardFlight;

/** The wallet counters of a screen: where a reward lands. */
export interface WalletTargets {
  coins: ResourceCounter;
  berries: ResourceCounter;
}

export interface RewardFlight {
  currency: 'coins' | 'berries';
  amount: number;
  /** Screen position the pictures start from. */
  from: Point;
  /** Without a wallet the pictures float up and fade. */
  wallet?: WalletTargets;
  /** The pictures pour out of an opening (a box) in an upward fan instead of scattering all around. */
  pour?: boolean;
  /** Runs when the last picture has arrived. */
  onDone?: () => void;
}

/**
 * Coins or berries pop out of `from` and fly into their counter; the counter holds its number
 * back (`addPending`) and rises as each picture arrives. Call it right after the save changed.
 */
export function flyReward(scene: Phaser.Scene, flight: RewardFlight): void {
  createTreasureTextures(scene);
  const shares = splitAmount(flight.amount, cfg.maxIcons);
  const counter = flight.wallet?.[flight.currency];
  const texture =
    flight.currency === 'coins' ? TREASURE_TEXTURES.coin : TREASURE_TEXTURES.berryFace;
  if (shares.length === 0) {
    flight.onDone?.();
    return;
  }
  counter?.addPending(shares.reduce((sum, share) => sum + share, 0));
  let left = shares.length;
  shares.forEach((share, i) => {
    const image = scene.add
      .image(flight.from.x, flight.from.y, texture)
      .setDisplaySize(cfg.iconSize, cfg.iconSize)
      .setDepth(cfg.depth)
      .setScale(0);
    const landing = (): void => {
      image.destroy();
      if (counter) {
        counter.arrive(share);
        services.audio.coin();
      }
      left -= 1;
      if (left === 0) flight.onDone?.();
    };
    const spot = burstSpot(
      flight.from,
      i,
      shares.length,
      {
        pour: flight.pour === true,
        fanDeg: cfg.pour.fanDeg,
        reach: flight.pour ? cfg.pour.reach : cfg.scatter,
      },
      { x: 0, y: 0 },
    );
    scene.tweens.add({
      targets: image,
      x: spot.x,
      y: spot.y,
      scale: 1,
      duration: flight.pour ? cfg.pour.riseMs : cfg.scatterMs,
      ease: 'Back.easeOut',
      delay: i * (flight.pour ? cfg.pour.staggerMs : cfg.staggerMs),

      onComplete: () => {
        if (!counter) {
          scene.tweens.add({
            targets: image,
            y: spot.y - cfg.floatUp,
            alpha: 0,
            duration: cfg.flyMs,
            onComplete: landing,
          });
          return;
        }
        const to = counter.anchor;
        const target: Point = { x: to.x, y: to.y };
        const progress = { p: 0 };
        const point: Point = { x: 0, y: 0 };
        scene.tweens.add({
          targets: progress,
          p: 1,
          duration: cfg.flyMs,
          delay: flight.pour ? cfg.pour.holdMs : 0,
          ease: 'Sine.easeIn',
          onUpdate: () => {
            arcPoint(spot, target, progress.p, cfg.arc, point);
            image.setPosition(point.x, point.y);
          },
          onComplete: landing,
        });
      },
    });
  });
}
