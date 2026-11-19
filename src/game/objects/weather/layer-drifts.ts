import * as Phaser from 'phaser';
import { BALANCE } from '../../../data/tower/balance';
import { FIELD_PAD } from '../../../data/common/picture-fields';
import { TOWER_WEATHER } from '../../../data/weather/tower-weather';
import { WEATHER_TEX } from '../../../data/weather/weather-look';
import { paddedOrigin } from '../../../util/field-pad';
import { effectsMode } from '../../app/effects-mode';
import { driftPicture } from '../backdrop/weather/weather-art';
import {
  driftGrowStep,
  driftPictureIndex,
  driftShown,
  driftThickness,
  ledgeOf,
  type Ledge,
} from './drift-geometry';
import { towerWeather } from './tower-weather-state';

const DRIFT = TOWER_WEATHER.drift;
const SIDES = [-1, 1] as const;
/** The part of the width a drift has when it starts to build up (it widens to its full width as it grows). */
const START_WIDTH_SHARE = 0.4;

/**
 * The snow drifts on the open top of a layer (a ledge where the layer above is narrower), in the snow of the
 * Roof and the Clouds. They are children of the layer's `content`, on the shared atlas page like the marks, so they
 * move, sway and leave with the layer and add no draw call at rest. A drift builds up like the cap on the top
 * layer, squashes away in 0.2 s when a wider layer covers its ledge, and is there at once (grown) when a layer comes
 * back on screen or the effects are on the lite level; the minimal level shows none.
 */
export class LayerDrifts {
  readonly images: Phaser.GameObjects.Image[] = [];
  private readonly ledges: Ledge[] = [
    { width: 0, centerX: 0, span: 0 },
    { width: 0, centerX: 0, span: 0 },
  ];
  private readonly grow = [0, 0];
  /** The picture each side shows now (index into the baked widths), -1 for none. */
  private readonly shown = [-1, -1];
  /** Where the drift of each side lies on its ledge as of the last frame the ledge was open. */
  private readonly lastSpan = [0, 0];
  private readonly lastCenter = [0, 0];
  private allowed = false;
  /** The first tick after a reset shows the drifts grown at once. */
  private fresh = true;

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < SIDES.length; i++) {
      this.images.push(new Phaser.GameObjects.Image(scene, 0, 0, '__DEFAULT').setVisible(false));
    }
  }

  setAllowed(on: boolean): void {
    this.allowed = on;
    if (!on) this.reset();
  }

  reset(): void {
    this.fresh = true;
    for (let i = 0; i < SIDES.length; i++) {
      this.grow[i] = 0;
      this.shown[i] = -1;
      this.ledges[i]!.width = 0;
      this.images[i]!.setVisible(false);
    }
  }

  /** The layer is `width` wide; the one above it is `upperWidth` wide and `upperDx` to the right of it (`null`: nothing above). */
  setLedge(width: number, upperWidth: number | null, upperDx: number): void {
    for (let i = 0; i < SIDES.length; i++) {
      const out = this.ledges[i]!;
      if (upperWidth !== null) ledgeOf(width, upperWidth, upperDx, SIDES[i]!, out);
      else out.width = 0;
    }
  }

  /** Builds up, squashes and places the drifts; `alpha` follows the layer's art. */
  tick(dtMs: number, alpha: number): void {
    const level = effectsMode.level;
    const snow = this.allowed && level !== 'minimal' ? towerWeather.snow : 0;
    for (let i = 0; i < SIDES.length; i++) {
      const ledge = this.ledges[i]!;
      const present = snow > 0 && ledge.width > 0;
      const instant = this.fresh || level === 'lite';
      const grow = driftGrowStep(this.grow[i]!, present, dtMs, instant);
      this.grow[i] = grow;
      this.pose(i, ledge, driftShown(grow), snow * alpha);
    }
    this.fresh = false;
  }

  private pose(side: number, ledge: Ledge, shown: number, alpha: number): void {
    const image = this.images[side]!;
    if (shown <= 0 || alpha <= 0) {
      image.setVisible(false);
      return;
    }
    // A ledge that has just been covered keeps the picture it had while it squashes away.
    const index = ledge.width > 0 ? driftPictureIndex(ledge.span) : this.shown[side]!;
    if (index < 0) {
      image.setVisible(false);
      return;
    }
    if (index !== this.shown[side]) {
      const pic = driftPicture(index);
      this.shown[side] = index;
      image
        .setTexture(WEATHER_TEX.drift[index] ?? '')
        .setOrigin(
          ...paddedOrigin(
            [0.5, pic.baseline / pic.height],
            pic.width,
            pic.height,
            FIELD_PAD.snowDrift,
          ),
        );
    }
    if (ledge.width > 0) {
      this.lastSpan[side] = ledge.span;
      this.lastCenter[side] = ledge.centerX;
    }
    const pic = driftPicture(index);
    const span = this.lastSpan[side]!;
    // The heap stretches across; its thickness follows the width of the drift on its ledge.
    const widen = START_WIDTH_SHARE + (1 - START_WIDTH_SHARE) * shown;
    image
      .setPosition(this.lastCenter[side]!, -BALANCE.layer.height / 2 + DRIFT.sinkPx)
      .setScale(
        (span / pic.width) * widen,
        (driftThickness(span) / driftThickness(pic.width)) * shown,
      )
      .setAlpha(alpha)
      .setVisible(true);
  }
}
