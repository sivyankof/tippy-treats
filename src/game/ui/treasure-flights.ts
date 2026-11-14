import * as Phaser from 'phaser';
import { TREASURE } from '../../data/treasure-anim';
import { PALETTE } from '../../data/palette';
import { smoothstep, TWO_PI } from '../../util/math';
import { effectsMode } from '../effects-mode';
import {
  arcPoint,
  sampleFlight,
  spinScale,
  splitAmount,
  type FlightFrame,
  type FlightPlan,
  type Point,
} from '../fx/coin-flight-math';
import { easeFn } from '../fx/ease';
import { FX_TEXTURES } from '../fx/fx-textures';
import { createTreasureTextures, TREASURE_TEXTURES } from '../fx/treasure-textures';
import { TREASURE_EVENTS, type CoinFlyPayload } from '../treasure-events';
import type { ResourceCounter } from './resource-counter';

const flight = TREASURE.flight;
const berryCfg = TREASURE.berry;
const popEase = easeFn(berryCfg.popEase);

interface CoinFlight {
  image: Phaser.GameObjects.Image;
  plan: FlightPlan;
  from: Point;
  /** What the counter gains when this coin arrives. */
  amount: number;
  ageMs: number;
}

interface BerryFlight {
  image: Phaser.GameObjects.Image;
  stars: Phaser.GameObjects.Image[];
  ageMs: number;
}

/**
 * Coins and berries flying into the counters of the HUD scene. The run scene asks for them
 * with game-level events (see `treasure-events.ts`); the counters hold their numbers back
 * until each picture arrives, so a counter always ends on the run total.
 */
export class TreasureFlights {
  private readonly layer: Phaser.GameObjects.Container;
  private readonly coins: CoinFlight[] = [];
  private readonly berries: BerryFlight[] = [];
  private readonly free: Phaser.GameObjects.Image[] = [];
  private readonly frame: FlightFrame = { x: 0, y: 0, scale: 1, visible: false, done: false };
  private readonly scratch: Point = { x: 0, y: 0 };
  private readonly centre: Point = { x: 0, y: 0 };
  private readonly onCoins = (payload: CoinFlyPayload): void => this.flyCoins(payload);
  private readonly onBerry = (): void => this.popBerry();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly coinCounter: ResourceCounter,
    private readonly berryCounter: ResourceCounter,
  ) {
    createTreasureTextures(scene);
    // One layer made now keeps every flight under the screens that are created after it.
    this.layer = scene.add.container(0, 0);
    scene.game.events.on(TREASURE_EVENTS.coinFly, this.onCoins);
    scene.game.events.on(TREASURE_EVENTS.berryPop, this.onBerry);
  }

  /** Stops listening; the pictures go with the scene. */
  destroy(): void {
    this.scene.game.events.off(TREASURE_EVENTS.coinFly, this.onCoins);
    this.scene.game.events.off(TREASURE_EVENTS.berryPop, this.onBerry);
  }

  /** The pause window covers the screen: the flights hide and stand still. */
  setPaused(paused: boolean): void {
    this.layer.setVisible(!paused);
  }

  update(dtMs: number): void {
    this.updateCoins(dtMs);
    this.updateBerries(dtMs);
  }

  private flyCoins(payload: CoinFlyPayload): void {
    const amounts = payload.hop
      ? [Math.round(payload.amount)]
      : splitAmount(payload.amount, Math.max(1, effectsMode.particleCount(flight.maxCoins)));
    amounts.forEach((amount, i) => {
      const image = this.take(TREASURE_TEXTURES.coin).setVisible(false);
      const spread =
        payload.hop || amounts.length === 1 ? 0 : (Math.random() - 0.5) * flight.spreadPx * 2;
      this.coins.push({
        image,
        amount,
        ageMs: 0,
        from: { x: payload.x + spread, y: payload.y },
        plan: {
          delayMs: payload.hop ? 0 : i * flight.staggerMs,
          hopMs: payload.hop ? flight.hopMs : 0,
          hopPx: flight.hopPx,
          flightMs: flight.flightMs,
          arcPx: flight.arcPx,
          startScale: 1,
          endScale: flight.endScale,
        },
      });
      this.coinCounter.addPending(amount);
    });
  }

  private updateCoins(dtMs: number): void {
    const target = this.coinCounter.anchor;
    const size = flight.size / TREASURE.textures.coin;
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];
      if (!coin) continue;
      coin.ageMs += dtMs;
      const f = sampleFlight(coin.plan, coin.from, target, coin.ageMs, this.frame, this.scratch);
      if (f.done) {
        this.coinCounter.arrive(coin.amount);
        this.give(coin.image);
        this.coins.splice(i, 1);
        continue;
      }
      const spin = spinScale(coin.ageMs, flight.spinPeriodMs, flight.spinMinScale);
      coin.image
        .setVisible(f.visible)
        .setPosition(f.x, f.y)
        .setScale(size * f.scale * spin, size * f.scale);
    }
  }

  private popBerry(): void {
    const stars = Array.from({ length: effectsMode.particleCount(berryCfg.sparkles) }, () =>
      this.take(FX_TEXTURES.star).setTint(PALETTE.gold).setAlpha(0),
    );
    const image = this.take(TREASURE_TEXTURES.berry).setScale(0);
    this.berries.push({ image, stars, ageMs: 0 });
    this.berryCounter.addPending(1);
  }

  private updateBerries(dtMs: number): void {
    const { popMs, holdMs, flightMs } = berryCfg;
    const { width, height } = this.scene.scale.gameSize;
    const centre = this.centre;
    centre.x = width / 2;
    centre.y = height * berryCfg.centerY;
    const target = this.berryCounter.anchor;
    for (let i = this.berries.length - 1; i >= 0; i--) {
      const berry = this.berries[i];
      if (!berry) continue;
      berry.ageMs += dtMs;
      const age = berry.ageMs;
      if (age >= popMs + holdMs + flightMs) {
        this.berryCounter.arrive(1);
        this.give(berry.image);
        berry.stars.forEach((star) => this.give(star));
        this.berries.splice(i, 1);
        continue;
      }
      const popT = Math.min(1, age / popMs);
      let size = berryCfg.popSize * popEase(popT);
      const at = this.scratch;
      at.x = centre.x;
      at.y = centre.y + Math.sin((TWO_PI * age) / berryCfg.holdBobPeriodMs) * berryCfg.holdBobPx;
      if (age > popMs + holdMs) {
        const t = smoothstep((age - popMs - holdMs) / flightMs);
        arcPoint(centre, target, t, berryCfg.arcPx, at);
        size += (berryCfg.endSize - berryCfg.popSize) * t;
      }
      berry.image.setPosition(at.x, at.y).setScale(size / berry.image.width);
      this.placeStars(berry, centre, popT);
    }
  }

  /** The stars burst out of the berry while it pops. */
  private placeStars(berry: BerryFlight, centre: Point, popT: number): void {
    const count = berry.stars.length;
    berry.stars.forEach((star, i) => {
      const angle = (i / count) * TWO_PI;
      const reach = berryCfg.sparkleReach * popEase(popT);
      star
        .setPosition(centre.x + Math.cos(angle) * reach, centre.y + Math.sin(angle) * reach)
        .setAlpha(1 - popT)
        .setAngle(popT * berryCfg.sparkleSpinDeg)
        .setScale(1 + popT);
    });
  }

  private take(texture: string): Phaser.GameObjects.Image {
    const image = this.free.pop() ?? this.scene.add.image(0, 0, texture);
    image.setTexture(texture).clearTint().setAlpha(1).setAngle(0).setVisible(true);
    this.layer.add(image);
    return image;
  }

  private give(image: Phaser.GameObjects.Image): void {
    this.layer.remove(image);
    image.setVisible(false);
    this.free.push(image);
  }
}
