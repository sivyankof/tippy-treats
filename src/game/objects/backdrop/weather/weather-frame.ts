import type * as Phaser from 'phaser';
import type { EffectLevel } from '../../../../data/app/effect-levels';

/** What the weather pieces need of one frame (the object is reused). */
export interface WeatherFrame {
  timeMs: number;
  deltaMs: number;
  /** Logical screen size. */
  width: number;
  height: number;
  /** The stripe of the incoming layer (`flightClearBand`). */
  band: { top: number; bottom: number };
  /** How visible the weather is: the zone cross-fade (`Backdrop.weatherShare('full')`). */
  share: number;
  level: EffectLevel;
}

/** A piece of the falling weather that lives in the screen-space container. */
export interface WeatherPart {
  readonly objects: readonly Phaser.GameObjects.GameObject[];
  update(frame: WeatherFrame): void;
}
