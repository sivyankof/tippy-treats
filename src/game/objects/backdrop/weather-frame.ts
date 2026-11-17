import type * as Phaser from 'phaser';
import type { EffectLevel } from '../../../data/effect-levels';

/** What the weather pieces need of one frame (the object is reused). */
export interface WeatherFrame {
  timeMs: number;
  deltaMs: number;
  /** Logical screen size. */
  width: number;
  height: number;
  /** The stripe of the incoming layer (`flightClearBand`). */
  band: { top: number; bottom: number };
  /** Lowest y a background picture may take under the HUD plates (`hudFloor`). */
  hudFloor: number;
  /** How visible the weather is: the zone cross-fade (`Backdrop.weatherShare('full')`). */
  share: number;
  level: EffectLevel;
}

/** A piece of the weather that lives in the screen-space container. */
export interface WeatherPart {
  readonly objects: readonly Phaser.GameObjects.GameObject[];
  /** Called when the screen size changes (and once at the start). */
  layout(frame: WeatherFrame): void;
  update(frame: WeatherFrame): void;
}
