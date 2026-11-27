import * as Phaser from 'phaser';
import type { ClimbBand, ClimbMap } from '../../../../core/progression/climb-map';
import { CLIMB_MAP } from '../../../../data/progression/climb-map';
import { formatNumber, t } from '../../../../i18n';
import { effectsMode } from '../../../app/effects-mode';
import { checkpointZoneTexture } from '../../../fx/zones/checkpoint-textures';
import {
  CLIMB_BAR_KEY,
  CLIMB_STAR_KEY,
  CLIMB_TOP_KEY,
  CLIMB_TOWER_KEY,
  climbTopSize,
  bakeClimbFrame,
  climbSkyKey,
  climbTowerSize,
} from '../../../fx/zones/climb-map-textures';
import { createOutlinedText } from '../../common/outlined-text';
import { ScrollPhysics } from '../../style/scroll-physics';
import { onFontRefresh } from '../widgets/fit-text';
import { bandName } from './climb-map-text';
import { createFlag, swayFlag, type Flag, type FlagKind } from './climb-map-flag';
import {
  LAYER_PX,
  edgeAlpha,
  heightToY,
  layersInBand,
  offsetForCentre,
  roomScale,
  spreadMarks,
  visibleSlice,
  type Span,
} from './climb-map-layout';

const cfg = CLIMB_MAP;

/**
 * Shrinks a one-line text to fit `room`, with no lower bound (the shared `fitText` stops at 0.8 and
 * lets a long English name run into the tower); it fits again after a late font load.
 */
function fitInRoom<T extends Phaser.GameObjects.Text>(text: T, room: number): T {
  onFontRefresh(text, () => fitInRoom(text, room));
  text.setScale(roomScale(text.setScale(1).width, room));
  return text;
}

/** An object that fades near the edges of the ribbon: it stands on the strip over `span`. */
interface Fading {
  holder: Phaser.GameObjects.Container;
  span: Span;
}

interface BandView {
  band: ClimbBand;
  span: Span;
  sky: Phaser.GameObjects.Image;
  /** The column of the tower in this band; null above the record. */
  tower: Phaser.GameObjects.Image | null;
}

interface PlacedFlag {
  flag: Flag;
  kind: FlagKind;
  side: 1 | -1;
  height: number;
  shown: boolean;
}

/**
 * The ribbon of the climb map (docs/07-ui-screens.md, section 2.3): the bands of the zones and
 * laps one over another with the tower column and the flags on them, scrolled by a finger, the
 * wheel or the opening animation. It is built once. Scrolling only moves the strip and sets
 * what shows: the part of a band outside the ribbon is cropped, small things fade out at the
 * edges, bands out of sight are hidden. `root` is placed by the window, x = 0 in the middle.
 */
export class ClimbMapRibbon {
  readonly root: Phaser.GameObjects.Container;
  private readonly strip: Phaser.GameObjects.Container;
  private readonly physics: ScrollPhysics;
  private readonly bands: BandView[] = [];
  private readonly fadings: Fading[] = [];
  private readonly flags: PlacedFlag[] = [];
  private readonly thumb: Phaser.GameObjects.NineSlice;
  /** The cake with a face on top of the tower; null for a newcomer. */
  private top: Phaser.GameObjects.Image | null = null;
  private readonly stripWidth: number;
  private readonly viewHeight: number;
  private readonly stripHeight: number;
  private readonly record: number;
  private readonly level = effectsMode.level;
  private towerTop: number;
  private readonly startOffset: number;
  private readonly endOffset: number;
  private nextFlagAt = 0;
  private swaying: Phaser.Tweens.Tween | null = null;
  private running: { state: { p: number }; tween: Phaser.Tweens.Tween } | null = null;
  private timer: Phaser.Time.TimerEvent | null = null;
  private stopped = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly size: { width: number; height: number },
    private readonly map: ClimbMap,
  ) {
    const f = cfg.frame;
    this.stripWidth = size.width - f.thick * 2;
    this.viewHeight = size.height - f.thick * 2;
    this.stripHeight = map.bands.length * cfg.bandHeight;
    this.record = map.anchor;
    this.strip = scene.add.container(0, f.thick);
    this.root = scene.add.container(0, 0, [this.strip]);
    this.physics = new ScrollPhysics(
      () => Math.max(0, this.stripHeight - this.viewHeight),
      () => scene.time.now,
    );
    this.startOffset = Math.max(0, this.stripHeight - this.viewHeight);
    this.endOffset = offsetForCentre(
      heightToY(this.record, map.totalLayers),
      this.viewHeight,
      this.stripHeight,
    );
    // The opening animation grows the tower from nothing; without it the tower stands whole at once.
    const animated = this.level !== 'minimal' && this.record > 0;
    this.towerTop = animated ? 0 : this.record;
    this.physics.jump(animated ? this.startOffset : this.endOffset);

    this.buildBands();
    this.buildTop();
    this.buildFlags(animated);
    const frame = scene.add.image(
      0,
      size.height / 2,
      bakeClimbFrame(scene, size.width, size.height),
    );
    this.thumb = this.buildBar();
    const zone = scene.add.zone(0, size.height / 2, size.width, size.height).setInteractive();
    zone.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.root.add([
      frame,
      this.thumb.getData('track') as Phaser.GameObjects.NineSlice,
      this.thumb,
      zone,
    ]);
    const input = scene.input;
    input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    input.on(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    this.refresh();
    if (!animated) this.startSway();
  }

  /** Starts the opening animation (call when the window is fully open). */
  start(): void {
    if (this.stopped || this.towerTop >= this.record) return;
    this.timer = this.scene.time.delayedCall(cfg.anim.startDelayMs, () => {
      this.timer = null;
      this.run();
    });
  }

  /** Stops every tween and listener of the ribbon (the window is closing or gone). */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    const input = this.scene.input;
    input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    input.off(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    this.timer?.remove();
    this.running?.tween.remove();
    this.running = null;
    this.swaying?.remove();
    this.swaying = null;
    for (const placed of this.flags) this.scene.tweens.killTweensOf(placed.flag.inner);
  }

  // --- Building ---

  private buildBands(): void {
    const { map, stripWidth } = this;
    const count = map.bands.length;
    const bestLap = map.marks.find((m) => m.kind === 'bestLap');
    const tower = climbTowerSize();
    map.bands.forEach((band, i) => {
      const top = (count - 1 - i) * cfg.bandHeight;
      const span = { top, bottom: top + cfg.bandHeight };
      const sky = this.scene.add
        .image(0, top, climbSkyKey(band.open ? band.zone : 'locked'))
        .setOrigin(0.5, 0)
        .setDisplaySize(stripWidth, cfg.bandHeight);
      this.strip.add(sky);
      this.buildLabel(band, top + cfg.bandHeight / 2, bestLap?.band === i ? bestLap.value : 0);
      let column: Phaser.GameObjects.Image | null = null;
      if (band.from <= this.record) {
        column = this.scene.add
          .image(cfg.tower.x, span.bottom + tower.pad / cfg.tower.texScale, CLIMB_TOWER_KEY)
          .setOrigin(0.5, 1)
          .setScale(1 / cfg.tower.texScale);
        this.strip.add(column);
      }
      this.bands.push({ band, span, sky, tower: column });
    });
    // The labels were added before the towers: put the towers under them, over the skies.
    for (const view of this.bands) if (view.tower) this.strip.sendToBack(view.tower);
    for (const view of this.bands) this.strip.sendToBack(view.sky);
  }

  /** The top cake with its face, above the columns. */
  private buildTop(): void {
    if (this.record <= 0) return;
    this.top = this.scene.add
      .image(cfg.tower.x, 0, CLIMB_TOP_KEY)
      .setOrigin(0.5, 1)
      .setScale(1 / cfg.tower.texScale);
    this.strip.add(this.top);
  }

  /** The picture of the zone, its name and layers (or the shut band's "? ? ?"), and the star of the best lap. */
  private buildLabel(band: ClimbBand, centreY: number, bestLap: number): void {
    const { picture, text } = cfg;
    const scene = this.scene;
    const left = -this.stripWidth / 2 + picture.left;
    const textX = left + picture.size + text.gap;
    const room = cfg.tower.x - cfg.tower.width / 2 - text.towerGap - textX;
    const rows = bestLap > 0 ? text.rows.lap : text.rows.plain;
    const holder = scene.add.container(0, centreY);
    const art = scene.add
      .image(left + picture.size / 2, 0, checkpointZoneTexture(band.zone))
      .setDisplaySize(picture.size, picture.size);
    holder.add(art);
    const row = (y: number, label: string, font: number, color?: number): void => {
      const item = createOutlinedText(scene, textX, y, label, font, color).setOrigin(0, 0.5);
      holder.add(fitInRoom(item, room));
    };
    if (band.open) {
      // A name too wide for the room wraps to two lines at full size (the lines then push apart); only a word wider than the room shrinks.
      const name = createOutlinedText(scene, textX, 0, bandName(band), text.nameFont);
      name.setOrigin(0, 0.5).setWordWrapWidth(room);
      const extra = name.height - text.nameFont * text.lineHeight;
      name.setY((rows[0] ?? 0) - Math.max(0, extra) / 2);
      holder.add(fitInRoom(name, room));
      row(
        (rows[1] ?? 0) + Math.max(0, extra) / 2,
        t('climbMap.range', { from: formatNumber(band.from), to: formatNumber(band.to) }),
        text.rangeFont,
      );
    } else {
      art.setTint(cfg.locked.tint).setAlpha(cfg.locked.pictureAlpha);
      row(0, t('climbMap.locked'), text.lockedFont, text.lockedColor);
    }
    if (bestLap > 0) {
      const star = scene.add
        .image(textX + text.bestLap.star / 2, rows[2] ?? 0, CLIMB_STAR_KEY)
        .setDisplaySize(text.bestLap.star, text.bestLap.star);
      const label = createOutlinedText(
        scene,
        textX + text.bestLap.star + text.bestLap.gap,
        rows[2] ?? 0,
        t('climbMap.bestLap'),
        text.bestLap.font,
      ).setOrigin(0, 0.5);
      const labelRoom = room - text.bestLap.star - text.bestLap.gap;
      label.setWordWrapWidth(labelRoom);
      holder.add([star, fitInRoom(label, labelRoom)]);
    }
    this.strip.add(holder);
    const half = Math.max(picture.size / 2, ...rows.map((y) => Math.abs(y) + text.nameFont * 0.6));
    this.fadings.push({ holder, span: { top: centreY - half, bottom: centreY + half } });
  }

  private buildFlags(animated: boolean): void {
    const f = cfg.flag;
    const rise = f.rise + f.clothHeight / 2;
    const towerLeft = cfg.tower.x - cfg.tower.width / 2;
    const towerRight = cfg.tower.x + cfg.tower.width / 2;
    const sides: Array<{ side: 1 | -1; kinds: readonly string[]; x: number }> = [
      { side: 1, kinds: ['record', 'today'], x: towerRight + f.towerGap + f.poleWidth / 2 },
      { side: -1, kinds: ['checkpoint'], x: towerLeft - f.towerGap - f.poleWidth / 2 },
    ];
    for (const { side, kinds, x } of sides) {
      const marks = this.map.marks.filter((m) => kinds.includes(m.kind));
      const feet = marks.map((m) => heightToY(m.height, this.map.totalLayers));
      const cloths = spreadMarks(
        feet.map((y) => y - rise),
        f.markGap,
      );
      marks.forEach((mark, i) => {
        const kind = mark.kind as FlagKind;
        const label =
          kind === 'checkpoint'
            ? formatNumber(mark.value)
            : t(kind === 'record' ? 'climbMap.record' : 'climbMap.today', {
                n: formatNumber(mark.value),
              });
        const room =
          side === 1
            ? this.stripWidth / 2 - cfg.bar.inset - cfg.bar.width - 6 - (x + f.poleWidth / 2)
            : f.checkpointWidth;
        const flag = createFlag(
          this.scene,
          kind,
          label,
          side,
          x,
          feet[i] ?? 0,
          cloths[i] ?? 0,
          kind === 'checkpoint' ? f.checkpointFont : f.font,
          Math.min(f.clothMaxWidth, room),
        );
        this.strip.add(flag.holder);
        this.fadings.push({ holder: flag.holder, span: { top: flag.top, bottom: flag.foot } });
        const placed: PlacedFlag = { flag, kind, side, height: mark.height, shown: !animated };
        if (animated) this.hideFlag(placed);
        this.flags.push(placed);
      });
    }
  }

  /** The scroll bar: a dark track and a light thumb on the right edge; the thumb carries its track in its data. */
  private buildBar(): Phaser.GameObjects.NineSlice {
    const { bar, frame } = cfg;
    const w = bar.width + 8;
    const slice = bar.width * 1.5;
    const x = this.size.width / 2 - frame.thick - bar.inset - bar.width / 2;
    const trackHeight = this.viewHeight - bar.inset * 2;
    const make = (height: number): Phaser.GameObjects.NineSlice =>
      this.scene.add.nineslice(x, 0, CLIMB_BAR_KEY, undefined, w, height, 0, 0, slice, slice);
    const track = make(trackHeight)
      .setTint(bar.track)
      .setAlpha(bar.trackAlpha)
      .setPosition(x, frame.thick + bar.inset + trackHeight / 2);
    const thumb = make(bar.minThumb).setTint(bar.thumb).setAlpha(bar.thumbAlpha);
    thumb.setData('track', track);
    return thumb;
  }

  // --- Showing ---

  /** Puts everything where the scroll offset and the height of the tower say. */
  private refresh(): void {
    const { thick } = cfg.frame;
    const offset = this.physics.offset;
    this.strip.setY(thick - offset);
    const view: Span = { top: offset, bottom: offset + this.viewHeight };
    const tower = climbTowerSize();
    const ts = cfg.tower.texScale;
    const padDisp = tower.pad / ts;
    for (const { band, span, sky, tower: column } of this.bands) {
      const slice = visibleSlice(span, view);
      sky.setVisible(slice !== null);
      if (slice)
        sky.setCrop(0, slice.top - span.top, cfg.sky.textureWidth, slice.bottom - slice.top);
      if (!column) continue;
      const filled = layersInBand(band, this.towerTop - cfg.tower.topOverlap) * LAYER_PX;
      const grown: Span = {
        top: span.bottom - filled - (filled > 0 ? padDisp : 0),
        bottom: span.bottom + padDisp,
      };
      const shown = filled > 0 ? visibleSlice(grown, view) : null;
      column.setVisible(shown !== null);
      if (shown) {
        const imageTop = span.bottom + padDisp - tower.height / ts;
        column.setCrop(
          0,
          (shown.top - imageTop) * ts,
          tower.width,
          (shown.bottom - shown.top) * ts,
        );
      }
    }
    this.placeTop(view);
    for (const { holder, span } of this.fadings) {
      const alpha = edgeAlpha(span, view, cfg.anim.edgeFade);
      holder.setAlpha(alpha).setVisible(alpha > 0);
    }
    this.placeThumb();
  }

  /** The top cake stands on the tower, the height of one drawn layer under its top, cropped at the edges of the view. */
  private placeTop(view: Span): void {
    const { top } = this;
    if (!top) return;
    const ts = cfg.tower.texScale;
    const size = climbTopSize();
    const padDisp = climbTowerSize().pad / ts;
    const bottom =
      heightToY(this.towerTop - cfg.tower.perLayer * cfg.tower.topHeight, this.map.totalLayers) +
      padDisp;
    const imageTop = bottom - size.height / ts;
    const shown = this.towerTop > 0 ? visibleSlice({ top: imageTop, bottom }, view) : null;
    top.setVisible(shown !== null).setY(bottom);
    if (!shown) return;
    const whole = shown.top <= imageTop && shown.bottom >= bottom;
    if (whole) top.setCrop();
    else top.setCrop(0, (shown.top - imageTop) * ts, size.width, (shown.bottom - shown.top) * ts);
  }

  private placeThumb(): void {
    const { bar, frame } = cfg;
    const track = this.thumb.getData('track') as Phaser.GameObjects.NineSlice;
    const range = Math.max(0, this.stripHeight - this.viewHeight);
    track.setVisible(range > 0);
    this.thumb.setVisible(range > 0);
    if (range <= 0) return;
    const room = track.height;
    const height = Math.max(bar.minThumb, (room * this.viewHeight) / this.stripHeight);
    this.thumb.setSize(this.thumb.width, height);
    const top = frame.thick + bar.inset + ((room - height) * this.physics.offset) / range;
    this.thumb.setY(top + height / 2);
  }

  // --- Flags and the opening ---

  private hideFlag(placed: PlacedFlag): void {
    if (this.level === 'full') placed.flag.inner.setScale(0);
    else placed.flag.inner.setAlpha(0);
  }

  /** A flag stands up: with the spring on full, a plain fade on lite; the record flag then starts to sway. */
  private reveal(placed: PlacedFlag, instant: boolean): void {
    if (placed.shown) return;
    placed.shown = true;
    const { inner } = placed.flag;
    const { flag } = cfg.anim;
    const afterwards = (): void => {
      if (placed.kind === 'record') this.startSway();
    };
    if (instant) {
      this.scene.tweens.killTweensOf(inner);
      inner.setScale(1).setAlpha(1);
      afterwards();
      return;
    }
    const now = this.scene.time.now;
    const at = Math.max(now, this.nextFlagAt);
    this.nextFlagAt = at + flag.staggerMs;
    const full = this.level === 'full';
    this.scene.tweens.add({
      targets: inner,
      ...(full ? { scale: 1 } : { alpha: 1 }),
      delay: at - now,
      duration: full ? flag.spring.ms : flag.fadeMs,
      ease: full ? flag.spring.ease : 'Sine.easeOut',
      onComplete: afterwards,
    });
  }

  private startSway(): void {
    if (this.level !== 'full' || this.swaying || this.stopped) return;
    const record = this.flags.find((placed) => placed.kind === 'record');
    if (record) this.swaying = swayFlag(this.scene, record.flag, record.side, cfg.anim.sway);
  }

  private run(): void {
    const state = { p: 0 };
    const { scroll } = cfg.anim;
    const tween = this.scene.tweens.add({
      targets: state,
      p: 1,
      duration: scroll.ms,
      ease: scroll.ease,
      onUpdate: () => this.apply(state.p),
      onComplete: () => {
        this.running = null;
      },
    });
    this.running = { state, tween };
  }

  /** One step of the opening: the scroll and the tower at the share `p` of the way. */
  private apply(p: number): void {
    this.towerTop = this.record * p;
    this.physics.jump(this.startOffset + (this.endOffset - this.startOffset) * p);
    for (const placed of this.flags) if (placed.height <= this.towerTop) this.reveal(placed, false);
    this.refresh();
  }

  /** A finger on the ribbon ends the opening at once: the tower is whole, every flag stands. */
  private finishNow(): void {
    if (this.towerTop >= this.record && !this.running && !this.timer) return;
    this.timer?.remove();
    this.timer = null;
    this.running?.tween.remove();
    this.running = null;
    this.towerTop = this.record;
    for (const placed of this.flags) this.reveal(placed, true);
    this.refresh();
  }

  // --- Input ---

  /** Canvas pixels per screen pixel of the ribbon (the window may be scaled down on a short screen). */
  private get unit(): number {
    return Math.abs(this.root.getWorldTransformMatrix().scaleY) || 1;
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    this.finishNow();
    this.physics.down(pointer.y, true);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (this.physics.move(pointer.y, pointer.isDown, this.unit)) this.refresh();
  }

  private onUp(): void {
    this.physics.up(this.unit);
  }

  private onWheel(_pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number): void {
    this.finishNow();
    this.physics.wheel(dy);
    this.refresh();
  }

  private onUpdate(_time: number, delta: number): void {
    if (!this.root.active) return;
    if (this.physics.tick(delta)) this.refresh();
  }
}
