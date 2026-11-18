import * as Phaser from 'phaser';
import { ANIM } from '../../../data/anim';
import { BACKDROP_FAR } from '../../../data/backdrop-far';
import { BACKDROP } from '../../../data/backdrop';
import { LOGICAL_SIZE } from '../../../data/screen';
import { type GradientStop } from '../../../data/backdrop-colors';
import type { StartPlaceId } from '../../../data/start-places';
import type { WeatherId } from '../../../data/weather';
import type { ZoneId } from '../../../data/zones';
import { mixColor } from '../../../util/color';
import { MS_PER_SECOND, oscillate01, sineWave } from '../../../util/math';
import { markPerfPart } from '../../perf/perf-marks';
import { bakeTexture, deferStep } from '../../ui/bake-texture';
import { bakeFarArt, FarPlane } from './far-plane';
import { fillLayerFrame, layerSwayAt } from './layer-anchor';
import type { GuestSource } from './guest-source';
import type { FrameCtx, Life } from './life';
import { fillDitheredRows, gradientBands } from './sky-gradient';
import { layerTintsOf, skyStops, skySuffix } from './weather-palette';

/** Pictures of the four parallax layers (back to front) and the living elements between them. */
export interface SceneryDef {
  layers: readonly string[];
  /** Pieces of the weather's sky (the cloud bank with its lightning, the stars and the moon); they stand over the four layers, so no house shows through a cloud, and fade with the zone. */
  weatherSky?: readonly Life[];
  /** `slot` is the parallax layer the element is drawn right above (0..3). */
  lives: readonly { slot: number; life: Life }[];
  /** The creature of the zone that may leave for the tower, when there is one. */
  guest?: GuestSource;
  /** Key of a sky picture the art baked for this run's weather (see `bakeStopsSky`); the zone's own sky when absent. */
  sky?: string;
  /** Tint of the far plane, for a zone whose sky colour follows the weather (the plane is baked in the clear sky's tones). */
  farTint?: number;
  /** The parallax layer the far plane sits above, when this run's art wants another than `BACKDROP_FAR.slot` (-1: behind them all). */
  farSlot?: number;
  /** Alpha of the four parallax layers when the art needs other values than the zone's (an opaque night awning). */
  layerAlpha?: readonly number[];
}

/** What a zone's art may depend on besides the zone itself: the lap of Space and the look of the run. */
export interface SceneryLook {
  /** 1-based lap of Space; 1 outside Space. */
  lap: number;
  weather: WeatherId;
  /** Start place of zone 1; only the first zone reads it (through `PLACE_ART`). */
  place: StartPlaceId;
  /** The run's planet stream (`planetOfLap`); only Space reads it. */
  planetSeed: number;
}

/** One zone's art: baking is separate so the next zone can be prepared ahead of the change. */
export interface ZoneArt {
  bake(scene: Phaser.Scene, look: SceneryLook): void;
  /** True when, in this weather, the art bakes and names its own sky (`SceneryDef.sky`), so the zone's plain sky is not baked. */
  ownSky?(weather: WeatherId): boolean;
  /** Bakes what only one lap of the zone shows (the planet of a lap of Space); `lap` is 1-based. */
  bakeLap?(scene: Phaser.Scene, lap: number, planetSeed: number): void;
  /** Only Space reads `look.lap`; a zone ignores what it does not show. */
  build(scene: Phaser.Scene, look: SceneryLook): SceneryDef;
}

const skyKey = (zone: ZoneId, weather: WeatherId): string =>
  `bd_sky_${zone}${skySuffix(zone, weather)}`;

/** The dark sky as a small picture with light noise, so the gradient shows no steps (baked once, in row slices over several frames). */
function bakeDitheredSky(scene: Phaser.Scene, zone: ZoneId): void {
  if (scene.textures.exists(skyKey(zone, 'clear'))) return;
  const { skyDither, skyOverscan } = BACKDROP;
  const width = Math.ceil((LOGICAL_SIZE.width * skyOverscan) / skyDither.scale);
  const height = Math.ceil((LOGICAL_SIZE.maxHeight * skyOverscan) / skyDither.scale);
  const pixels = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));
  for (let from = 0; from < height; from += skyDither.rowsPerStep) {
    const to = Math.min(from + skyDither.rowsPerStep, height);
    deferStep(() =>
      fillDitheredRows(pixels, skyStops(zone, 'clear'), width, height, skyDither.levels, from, to),
    );
  }
  bakeTexture(
    scene,
    skyKey(zone, 'clear'),
    width,
    height,
    () => undefined,
    (context) => context.putImageData(new ImageData(pixels, width, height), 0, 0),
  );
}

/** Bakes a sky picture of `key` from gradient stops: the sky of a zone that shows the weather of the run through glass. */
export function bakeStopsSky(
  scene: Phaser.Scene,
  key: string,
  stops: readonly GradientStop[],
): void {
  const { skyBands, skyBandHeight, skyWidth } = BACKDROP;
  const colors = gradientBands(stops, skyBands);
  bakeTexture(scene, key, skyWidth, skyBands * skyBandHeight, (g) => {
    colors.forEach((color, i) => {
      g.fillStyle(color, 1);
      g.fillRect(0, i * skyBandHeight, skyWidth, skyBandHeight);
    });
  });
}

/** Bakes the sky picture of a zone (once; the scenery also calls it, so a zone built without the run backdrop has its sky). */
export function bakeSky(scene: Phaser.Scene, zone: ZoneId, weather: WeatherId = 'clear'): void {
  if ((BACKDROP.skyDither.zones as readonly ZoneId[]).includes(zone)) {
    bakeDitheredSky(scene, zone);
    return;
  }
  bakeStopsSky(scene, skyKey(zone, weather), skyStops(zone, weather));
}

/**
 * One zone's backdrop: a sky gradient, the far plane, four parallax layers and the living elements,
 * all in screen space under one container so the whole zone can fade as one.
 */
export class ZoneScenery {
  readonly root: Phaser.GameObjects.Container;
  /** The creature that may leave for the tower. */
  readonly guest: GuestSource | null;
  private readonly sky: Phaser.GameObjects.Image;
  private readonly far: FarPlane;
  private readonly layers: Phaser.GameObjects.TileSprite[];
  private readonly lives: Life[];
  private readonly skyLives: readonly Life[];
  private readonly drift: readonly number[];
  private readonly zone: ZoneId;
  /** Camera scroll at the zone's start view: the things on the layers stand at their spots there and scroll away from it. */
  private originScrollY = 0;
  private readonly tints: NonNullable<(typeof BACKDROP.layerTint)[ZoneId]> | null;
  private readonly breathePhase: number;

  constructor(
    scene: Phaser.Scene,
    zone: ZoneId,
    depth: number,
    def: SceneryDef,
    width: number,
    height: number,
    weather: WeatherId = 'clear',
  ) {
    if (!def.sky) bakeSky(scene, zone, weather);
    // Menu screens build the kitchen without the run backdrop, so the far plane bakes here too.
    bakeFarArt(scene, zone, weather);
    this.drift = BACKDROP.drift[zone];
    this.zone = zone;
    this.tints = BACKDROP.layerTint[zone] ?? null;
    this.breathePhase = depth;
    this.sky = new Phaser.GameObjects.Image(
      scene,
      width / 2,
      height / 2,
      def.sky ?? skyKey(zone, weather),
    );
    this.far = new FarPlane(scene, zone, width, height, weather);
    this.layers = def.layers.map((key, i) =>
      new Phaser.GameObjects.TileSprite(scene, 0, 0, width, height, key)
        .setOrigin(0)
        .setAlpha(def.layerAlpha?.[i] ?? BACKDROP.layerAlpha[zone][i] ?? 1),
    );
    // A weather tints the layers (multiply) once; a layer that colour-shifts by itself keeps its own tint.
    const weatherTints = layerTintsOf(zone, weather);
    if (weatherTints) {
      this.layers.forEach((layer, i) => {
        const tint = weatherTints[i];
        if (tint !== undefined && !this.tints?.[i]) layer.setTint(tint);
      });
    }
    if (def.farTint !== undefined) {
      for (const object of this.far.objects) {
        if (object instanceof Phaser.GameObjects.TileSprite) object.setTint(def.farTint);
      }
    }
    this.skyLives = def.weatherSky ?? [];
    this.lives = def.lives.map(({ life }) => life);
    this.guest = def.guest ?? null;
    const children: Phaser.GameObjects.GameObject[] = [this.sky];
    const farSlot = def.farSlot ?? BACKDROP_FAR.slot[zone];
    if (farSlot < 0) children.push(...this.far.objects);
    this.layers.forEach((layer, i) => {
      children.push(layer);
      if (i === farSlot) children.push(...this.far.objects);
      for (const { slot, life } of def.lives) {
        if (slot === i) children.push(...life.objects);
      }
    });
    for (const life of this.skyLives) children.push(...life.objects);
    for (const child of children)
      markPerfPart(child, this.far.objects.includes(child) ? 'far' : 'bg');
    this.root = new Phaser.GameObjects.Container(scene, 0, 0, children);
    this.root.setScrollFactor(0).setDepth(depth);
    scene.add.existing(this.root);
    this.fitSky(width, height, 0);
  }

  /** Sets the camera scroll of the zone's start view (the zone is built there). */
  startAt(scrollY: number): void {
    this.originScrollY = scrollY;
  }

  /** Call when the logical screen size changes. */
  resize(width: number, height: number): void {
    for (const layer of this.layers) layer.setSize(width, height);
    this.sky.setPosition(width / 2, height / 2);
    this.far.resize(width, height);
  }

  /** Sets how visible the whole zone is; a zone that is fully faded out is not drawn at all. */
  setAlpha(alpha: number): void {
    this.root.setAlpha(alpha);
    this.root.setVisible(alpha > 0);
  }

  update(ctx: FrameCtx, scrollY: number): void {
    this.fitSky(ctx.width, ctx.height, ctx.timeMs);
    this.far.update(ctx, scrollY);
    fillLayerFrame(ctx, this.zone, scrollY, this.originScrollY, ctx.timeMs);
    this.layers.forEach((layer, i) => {
      layer.tilePositionY = scrollY * (ANIM.parallax[i] ?? 1);
      // A layer that carries things sways to and fro and they sway with it (layer-anchor.ts); the rest drifts on.
      layer.tilePositionX =
        layerSwayAt(this.zone, i, ctx.timeMs) ??
        ((this.drift[i] ?? 0) * ctx.timeMs) / MS_PER_SECOND;
      const tint = this.tints?.[i];
      if (tint) layer.setTint(mixColor(tint.from, tint.to, oscillate01(ctx.timeMs, tint.ms)));
    });
    for (const life of this.skyLives) life.update(ctx);
    for (const life of this.lives) life.update(ctx);
  }

  /** The sky is slightly larger than the screen and breathes, so the gradient is never still. */
  private fitSky(width: number, height: number, timeMs: number): void {
    const { skyOverscan, skyBreathe } = BACKDROP;
    const breathe =
      1 + skyBreathe.amount * sineWave(timeMs, skyBreathe.periodMs, this.breathePhase);
    this.sky.setScale(
      ((width * skyOverscan) / this.sky.width) * breathe,
      ((height * skyOverscan) / this.sky.height) * breathe,
    );
  }

  destroy(): void {
    this.root.destroy(true);
  }
}
