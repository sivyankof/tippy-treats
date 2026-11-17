import type * as Phaser from 'phaser';
import { Rng } from '../../../core/rng';
import { STREET_WEATHER, type StreetFallKind } from '../../../data/street-weather';
import type { WeatherId } from '../../../data/weather';
import { WEATHER_LOOK } from '../../../data/weather-look';
import { flightClearBand, hudFloor } from '../../camera-layout';
import { effectsMode } from '../../effects-mode';
import { inSky } from './layer-anchor';
import type { FrameCtx, Life } from './life';
import { WeatherFall } from './weather-fall';
import type { WeatherFrame } from './weather-frame';
import { WeatherBank } from './weather-sky';

const STREET_KINDS: readonly StreetFallKind[] = ['rain', 'storm', 'snow', 'leaves'];

function streetKind(weather: WeatherId): StreetFallKind | null {
  return (STREET_KINDS as readonly string[]).includes(weather) ? (weather as StreetFallKind) : null;
}

/**
 * The weather on the street behind the Showcase glass: in rain and storm the Roof's cloud bank over the houses
 * (lower and paler, a storm flashes in it without a bolt), and the rain, snow or leaves falling over the whole
 * width in front of the houses. It lives in the zone (right over the street layer, under the panes, the shop
 * front and the awning), so it fades in and out with the zone's cross-fade. The bank and the falling pictures
 * are frames of the shared atlas and lie next to each other: one draw batch, and one more while a flash (added
 * light) shows. Everything is made when the zone is built; a frame only moves it.
 */
export class StreetWeather implements Life {
  readonly anchor = inSky('weather');
  readonly objects: readonly Phaser.GameObjects.GameObject[];
  private readonly bank: WeatherBank | null;
  private readonly fall: WeatherFall;
  private readonly frame: WeatherFrame = {
    timeMs: 0,
    deltaMs: 0,
    width: 0,
    height: 0,
    band: { top: 0, bottom: 0 },
    hudFloor: 0,
    share: 1,
    level: 'full',
  };

  /** The street weather of a run's weather, or null when it has none on the street (clear, sunset, night). */
  static of(scene: Phaser.Scene, weather: WeatherId): StreetWeather | null {
    const kind = streetKind(weather);
    return kind ? new StreetWeather(scene, weather, kind) : null;
  }

  private constructor(scene: Phaser.Scene, weather: WeatherId, kind: StreetFallKind) {
    // A cosmetic stream of its own: the run's stream is never touched.
    const rng = new Rng(WEATHER_LOOK.skySeed).fork(`${weather}_street`);
    const look = STREET_WEATHER;
    this.bank =
      kind === 'rain' || kind === 'storm'
        ? new WeatherBank(scene, weather, rng.fork('bank'), look.bank)
        : null;
    this.fall = new WeatherFall(scene, kind, rng.fork('fall'), {
      count: look.count[kind],
      alpha: look.alpha,
      scale: look.scale,
    });
    // The bank, then the falling pictures (the same atlas, one batch), then what lights the bank.
    this.objects = [
      ...(this.bank ? [this.bank.body] : []),
      ...this.fall.objects,
      ...(this.bank?.lit ?? []),
    ];
  }

  update(ctx: FrameCtx): void {
    this.bank?.update(ctx);
    const f = this.frame;
    f.timeMs = ctx.timeMs;
    f.deltaMs = ctx.deltaMs;
    f.level = effectsMode.level;
    if (f.width !== ctx.width || f.height !== ctx.height) {
      f.width = ctx.width;
      f.height = ctx.height;
      const band = flightClearBand(ctx.height);
      f.band.top = band.top;
      f.band.bottom = band.bottom;
      f.hudFloor = hudFloor();
    }
    this.fall.update(f);
  }
}
