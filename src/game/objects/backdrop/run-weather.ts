import * as Phaser from 'phaser';
import { Rng } from '../../../core/rng';
import type { TowerState } from '../../../core/tower-sim';
import type { WeatherId } from '../../../data/weather';
import { DEPTH } from '../../depth';
import { effectsMode } from '../../effects-mode';
import { flightClearBand, hudFloor } from '../../camera-layout';
import { markPerfPart } from '../../perf/perf-marks';
import { bakeWeatherArt } from './weather-art';
import { WeatherFall, type FallKind } from './weather-fall';
import type { WeatherFrame, WeatherPart } from './weather-frame';
import { strikeLightningNow } from './weather-sky';
import type { TowerView } from '../tower-view';
import type { Backdrop } from './backdrop';
import { WeatherTop, type TowerTop } from './weather-top';

/** Depth of the screen-space weather: over every zone of the backdrop, under the worktop and the tower. */
const WEATHER_DEPTH = DEPTH.counter - 1;
const FALL_KINDS: Partial<Record<WeatherId, FallKind>> = {
  rain: 'rain',
  storm: 'storm',
  snow: 'snow',
  leaves: 'leaves',
};

/**
 * The weather of a run that falls or lies on the tower: the particles of rain, snow and leaves in one
 * screen-space container behind the tower (all frames of the shared atlas, so one draw batch), plus
 * the snow cap and the splashes on the top layer. Sunset, night and clear have none of it: they are
 * a palette and, at night, the stars and the moon of the zone's sky (`weather-sky.ts`).
 * Created only for a weather that has pieces; only the pictures of this weather are baked.
 */
export class RunWeather {
  private readonly root: Phaser.GameObjects.Container;
  private readonly parts: WeatherPart[] = [];
  private readonly top: WeatherTop;
  private readonly frame: WeatherFrame = {
    timeMs: 0,
    deltaMs: 0,
    width: 0,
    height: 0,
    band: { top: 0, bottom: 0 },
    hudFloor: 0,
    share: 0,
    level: 'full',
  };
  private readonly topState: TowerTop = { count: 0, topY: 0, left: 0, right: 0, over: false };
  private laidOut = false;

  static needed(weather: WeatherId): boolean {
    return weather in FALL_KINDS;
  }

  constructor(
    scene: Phaser.Scene,
    weather: WeatherId,
    seed: number,
    private readonly backdrop: Backdrop,
    private readonly tower: TowerView,
  ) {
    bakeWeatherArt(scene, weather);
    const rng = new Rng(seed).fork(`weather_${weather}`);
    const fall = FALL_KINDS[weather];
    if (fall) this.parts.push(new WeatherFall(scene, fall, rng.fork('fall')));
    this.top = new WeatherTop(
      scene,
      weather === 'snow',
      fall === 'rain' || fall === 'storm',
      rng.fork('top'),
    );
    const objects = this.parts.flatMap((part) => [...part.objects]);
    for (const object of objects) markPerfPart(object, 'bg');
    this.root = new Phaser.GameObjects.Container(scene, 0, 0, objects);
    this.root.setScrollFactor(0).setDepth(WEATHER_DEPTH);
    scene.add.existing(this.root);
    if (import.meta.env.DEV) {
      const win = window as Window & { tippyLightning?: () => void };
      // window.tippyLightning(): the next bolt of a storm strikes right away.
      win.tippyLightning = strikeLightningNow;
    }
  }

  /** Call every frame; `width` and `height` are the logical screen size. */
  update(
    timeMs: number,
    deltaMs: number,
    width: number,
    height: number,
    state: Readonly<TowerState>,
  ): void {
    const f = this.frame;
    f.timeMs = timeMs;
    f.deltaMs = deltaMs;
    f.share = this.backdrop.weatherShare('full');
    f.level = effectsMode.level;
    if (!this.laidOut || f.width !== width || f.height !== height) {
      f.width = width;
      f.height = height;
      const band = flightClearBand(height);
      f.band.top = band.top;
      f.band.bottom = band.bottom;
      f.hudFloor = hudFloor();
      this.laidOut = true;
    }
    this.root.setVisible(f.share > 0);
    if (f.share > 0) for (const part of this.parts) part.update(f);
    const top = this.topState;
    const span = this.tower.topSpan();
    top.count = state.layers.length;
    top.topY = this.tower.topY();
    top.left = span.left;
    top.right = span.right;
    top.over = state.phase === 'over';
    this.top.update(top, timeMs, deltaMs, f.level, f.share);
  }

  destroy(): void {
    this.top.destroy();
    this.root.destroy(true);
  }
}
