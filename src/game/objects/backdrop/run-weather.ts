import { strikeWindowFlashNow } from './panorama-flash';
import * as Phaser from 'phaser';
import { Rng } from '../../../core/rng';
import type { TowerState } from '../../../core/tower-sim';
import type { WeatherId } from '../../../data/weather';
import { DEPTH } from '../../depth';
import { effectsMode } from '../../effects-mode';
import { flightClearBand } from '../../camera-layout';
import { markPerfPart } from '../../perf/perf-marks';
import { bakeWeatherArt } from './weather-art';
import { WeatherFall, type FallKind } from './weather-fall';
import type { WeatherFrame, WeatherPart } from './weather-frame';
import { strikeLightningNow } from './weather-sky';
import { onLightningFlash } from './lightning-flash';
import { SnowDust } from './snow-dust';
import { playFx } from '../../fx-sound';
import { bedWanted } from '../../weather-bed';
import { services } from '../../../services';
import type { BedKind } from '../../../data/weather-bed';
import { TOWER_WEATHER } from '../../../data/tower-weather';
import { fxGuard } from '../../fx-guard';
import { towerWeather } from '../tower-weather-state';
import type { TowerView } from '../tower-view';
import type { Backdrop } from './backdrop';
import { WeatherTop, type TowerTop } from './weather-top';
import { BALANCE } from '../../../data/balance';
import type { EffectLevel } from '../../../data/effect-levels';

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
 * a palette and, at night, the stars and the moon of the zone's sky (`weather-sky.ts`). It also hands the
 * weather on to the layers of the tower (`towerWeather`: the snow for the drifts, the night for the sleepy faces), throws
 * the snow dust of a landing and turns a flash of lightning into the startle of the layers. Only the pictures of
 * this weather are baked.
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
    share: 0,
    level: 'full',
  };
  private readonly topState: TowerTop = { count: 0, topY: 0, left: 0, right: 0, over: false };
  private readonly weather: WeatherId;
  private laidOut = false;
  private readonly dust: SnowDust | null;
  /** The weather bed now asked of the audio (off unless the owner switched the beds on). */
  private bed: BedKind | null = null;

  constructor(
    scene: Phaser.Scene,
    weather: WeatherId,
    seed: number,
    private readonly backdrop: Backdrop,
    private readonly tower: TowerView,
  ) {
    this.weather = weather;
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
    this.dust = weather === 'snow' ? new SnowDust(scene, rng.fork('dust')) : null;
    const objects = this.parts.flatMap((part) => [...part.objects]);
    for (const object of objects) markPerfPart(object, 'bg');
    this.root = new Phaser.GameObjects.Container(scene, 0, 0, objects);
    this.root.setScrollFactor(0).setDepth(WEATHER_DEPTH);
    scene.add.existing(this.root);
    const stopFlash = onLightningFlash((kind) => tower.startle(kind));
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      stopFlash();
      towerWeather.snow = 0;
      towerWeather.sleepy = false;
      services.audio.setBed(null);
    });
    if (import.meta.env.DEV) {
      const win = window as Window & { tippyLightning?: () => void; tippyYawn?: () => boolean };
      // window.tippyLightning(): the next bolt of a storm strikes right away (the sky and the panoramic window);
      // without a storm in the sky, only the startle of the layers.
      win.tippyLightning = () => {
        // A flash in the window of the Kitchen scares nobody; with no storm anywhere only the layers startle.
        const struck = strikeLightningNow() + strikeWindowFlashNow();
        if (struck === 0) tower.startle('sky');
      };
      // window.tippyYawn(): the first free layer from the top yawns right away, in any weather; true when one did.
      win.tippyYawn = () => tower.yawnNow();
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
    const landed = this.top.update(top, timeMs, deltaMs, f.level, f.share);
    towerWeather.snow = this.weather === 'snow' ? f.share : 0;
    towerWeather.sleepy =
      this.weather === 'night' &&
      this.backdrop.weatherShare('full') + this.backdrop.weatherShare('window') >
        TOWER_WEATHER.sleepy.nightShare;
    this.updateBed(f.share, f.level);
    this.updateDust(landed, top, deltaMs, f.level, f.share);
  }

  /** Asks the audio for the weather bed only when what is wanted changes. */
  private updateBed(share: number, level: EffectLevel): void {
    const wanted = bedWanted(this.weather, share, level);
    if (wanted === this.bed) return;
    this.bed = wanted;
    fxGuard.run('weather bed', () => services.audio.setBed(wanted));
  }

  /** The dust of a layer landing on the cap: out of both ends of the seam, under the next layer. */
  private updateDust(
    landed: boolean,
    top: TowerTop,
    deltaMs: number,
    level: EffectLevel,
    share: number,
  ): void {
    const dust = this.dust;
    if (!dust) return;
    if (top.over) dust.clear();
    if (landed) {
      const lower = this.tower.layerPose(top.count - 2);
      if (lower) {
        const left = Math.max(top.left, lower.x - lower.width / 2);
        const right = Math.min(top.right, lower.x + lower.width / 2);
        const depth = this.top.topDepth;
        if (level !== 'minimal') playFx('snowPuff');
        fxGuard.run('snow dust', () =>
          dust.burst(left, right, top.topY + BALANCE.layer.height, depth, level),
        );
      }
    }
    dust.update(deltaMs, share);
  }
}
