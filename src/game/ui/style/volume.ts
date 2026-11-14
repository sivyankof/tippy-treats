/**
 * The volumetric look of the menu screens: the same glossy candy style as the run.
 *
 * What to use (numbers live in `MENU.style` of src/data/menu-layout.ts):
 * - Background of a menu screen: `new MenuScenery(scene, 'home' | 'list')` (menu-scenery.ts);
 *   call `resize` on layout and `update(delta)` every frame.
 * - A window, a block of text, a list area: `new VolumePlate(scene, 'window', height)`, then
 *   `setBodyWidth(width)` and `setPosition(cx, cy)`; (cx, cy) is the centre of the body.
 * - A card: `new VolumePlate(scene, 'card', height, { rim: RARITY_COLOR })` for a rarity rim.
 * - A small plate under a number or a label: `new VolumePlate(scene, 'chip', height, { fill })`.
 * - A bar along a screen edge: `new VolumePlate(scene, 'bar', height)`.
 * - A screen title: `ScreenHeader` draws it on a `TitleRibbon` (title-ribbon.ts) by itself.
 * - A button: `createTextButton` / `createIconButton` give the volumetric look by default;
 *   `new Button(...)` and `createLabelButton(...)` take `look: 'volume'` (the run keeps 'flat').
 * - Custom art in one baked texture (a speech bubble, a sign): `drawVolume(g, ...)` inside
 *   `bakeTexture`, with `MENU.style.looks.<kind>` or a look of your own.
 * Plates are baked once per kind, height and colours and stretched sideways (a 3-slice), so a
 * plate may change its width at any time without redrawing.
 */
import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { shade } from '../../../util/color';
import { fillGradient } from '../../objects/layer-draw';
import { bakeTexture } from '../bake-texture';

const S = MENU.style;

/** The body kinds of the kit; their numbers are in `MENU.style.looks`. */
export type VolumeKind = keyof typeof S.looks;

/** How a body is shaded. */
export interface VolumeLook {
  radius: number;
  /** Width of the dark outline. */
  outline: number;
  /** Width of the coloured rim inside the outline, drawn only when a rim colour is given. */
  rimWidth: number;
  /** Height of the darker bevel along the bottom; part of the body height. */
  bevel: number;
  /** The soft shadow: how far down it is moved (negative: up), how far it spreads, how dark it is. */
  shadowOffset: number;
  shadowBlur: number;
  shadowAlpha: number;
  /** The gradient runs from the fill lightened by `lift` (top) to the fill darkened by `drop`. */
  lift: number;
  drop: number;
  gloss: { insetX: number; insetY: number; height: number; share: number; alpha: number };
}

export interface VolumeColors {
  /** Colour of the body; the cream panel colour when left out. */
  fill?: number;
  /** A coloured band inside the outline, such as the rarity of a card. */
  rim?: number;
}

/** Room the soft shadow takes around a body, in pixels. */
export interface ShadowMargin {
  side: number;
  top: number;
  bottom: number;
}

export function shadowMargin(look: VolumeLook): ShadowMargin {
  return {
    side: look.shadowBlur,
    top: Math.max(0, look.shadowBlur - look.shadowOffset),
    bottom: Math.max(0, look.shadowBlur + look.shadowOffset),
  };
}

/** The look of a kind with another corner radius and bevel (buttons take theirs from the layout). */
export function lookOf(kind: VolumeKind, radius?: number, bevel?: number): VolumeLook {
  const base: VolumeLook = S.looks[kind];
  return { ...base, radius: radius ?? base.radius, bevel: bevel ?? base.bevel };
}

/** Where the middle of the face lies from the middle of a body of `kind`: the bevel lifts it. */
export function faceOffsetY(kind: VolumeKind): number {
  return -S.looks[kind].bevel / 2;
}

/**
 * Draws a body with its top-left corner at (x, y), `width` x `height` with the bevel: soft
 * shadow, dark outline, rim, bevel, gradient face and gloss band.
 */
export function drawVolume(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  look: VolumeLook,
  colors: VolumeColors = {},
): void {
  const fill = colors.fill ?? PALETTE.panel;
  const radius = Math.min(look.radius, width / 2, height / 2);
  const steps = S.shadowSteps;
  g.fillStyle(S.shadowColor, look.shadowAlpha / steps);
  for (let i = 0; i < steps; i++) {
    const grow = (look.shadowBlur * (steps - i)) / steps;
    g.fillRoundedRect(
      x - grow,
      y + look.shadowOffset - grow,
      width + grow * 2,
      height + grow * 2,
      radius + grow,
    );
  }

  const edge = colors.rim ?? fill;
  g.fillStyle(shade(edge, S.outlineShade), 1).fillRoundedRect(x, y, width, height, radius);
  let inset = look.outline;
  if (colors.rim !== undefined && look.rimWidth > 0) {
    const box = insetBox(x, y, width, height, radius, inset);
    g.fillStyle(colors.rim, 1).fillRoundedRect(box.x, box.y, box.width, box.height, box.radius);
    shadeFace(g, box, colors.rim, look, S.gradientBands / 2);
    inset += look.rimWidth;
  }

  const inner = insetBox(x, y, width, height, radius, inset);
  g.fillStyle(shade(fill, S.bevelShade), 1);
  g.fillRoundedRect(inner.x, inner.y, inner.width, inner.height, inner.radius);
  const faceHeight = Math.max(0, inner.height - look.bevel);
  const face = { ...inner, height: faceHeight, radius: Math.min(inner.radius, faceHeight / 2) };
  g.fillStyle(shade(fill, -look.drop), 1);
  g.fillRoundedRect(face.x, face.y, face.width, face.height, face.radius);
  shadeFace(g, face, fill, look, S.gradientBands);
  drawGloss(g, face, look);
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

function insetBox(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  inset: number,
): Box {
  return {
    x: x + inset,
    y: y + inset,
    width: Math.max(0, width - inset * 2),
    height: Math.max(0, height - inset * 2),
    radius: Math.max(0, radius - inset),
  };
}

/** The gradient over a rounded box; its square band ends stay above the lower corners. */
function shadeFace(
  g: Phaser.GameObjects.Graphics,
  box: Box,
  fill: number,
  look: VolumeLook,
  bands: number,
): void {
  if (box.height <= 0 || box.width <= 0) return;
  fillGradient(
    g,
    { x: box.x, y: box.y, width: box.width, height: Math.max(box.radius, box.height - box.radius) },
    box.radius,
    shade(fill, -look.drop),
    shade(fill, look.lift),
    Math.max(1, Math.round(bands)),
  );
}

/** A white pill in the upper part of the face, brighter along its top. */
function drawGloss(g: Phaser.GameObjects.Graphics, face: Box, look: VolumeLook): void {
  const { insetX, insetY, height, share, alpha } = look.gloss;
  const h = Math.min(height, face.height * share);
  const side = Math.max(insetX, face.radius * S.glossCorner);
  const w = face.width - side * 2;
  if (h < 2 || w <= h) return;
  const top = face.y + insetY;
  g.fillStyle(S.glossColor, alpha).fillRoundedRect(face.x + side, top, w, h, h / 2);
  g.fillStyle(S.glossColor, alpha / 2);
  g.fillRoundedRect(face.x + side + h / 4, top, w - h / 2, h / 2, h / 4);
}

/** A baked body: its texture and where the body sits inside it. */
export interface VolumeArt {
  key: string;
  textureWidth: number;
  textureHeight: number;
  /** Top-left corner of the body in the texture. */
  left: number;
  top: number;
}

/**
 * Bakes a body `width` x `height` (bevel included) with its shadow under `key`, once.
 * `decorate` draws over it with (0, 0) at the top-left corner of the body.
 */
export function bakeVolume(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  look: VolumeLook,
  colors: VolumeColors = {},
  decorate?: (g: Phaser.GameObjects.Graphics) => void,
): VolumeArt {
  const m = shadowMargin(look);
  const art: VolumeArt = {
    key,
    textureWidth: width + m.side * 2,
    textureHeight: height + m.top + m.bottom,
    left: m.side,
    top: m.top,
  };
  bakeTexture(scene, key, art.textureWidth, art.textureHeight, (g) => {
    drawVolume(g, m.side, m.top, width, height, look, colors);
    if (decorate) {
      g.translateCanvas(m.side, m.top);
      decorate(g);
    }
  });
  return art;
}

/** Texture key part of a colour set. */
function colorsKey(colors: VolumeColors): string {
  const fill = (colors.fill ?? PALETTE.panel).toString(16);
  return colors.rim === undefined ? fill : `${fill}_${colors.rim.toString(16)}`;
}

/** Width of the stretched middle of a plate texture. */
const PLATE_CORE = 4;

/**
 * A plate of the kit: one baked picture per kind, height and colours, stretched sideways to any
 * width (a 3-slice), so it never redraws. Its position is the centre of the body (the shadow
 * hangs around it). Works in containers and with the screen transitions like any image.
 */
export class VolumePlate extends Phaser.GameObjects.NineSlice {
  private readonly margin: ShadowMargin;
  private currentWidth: number;

  constructor(
    scene: Phaser.Scene,
    readonly kind: VolumeKind,
    readonly bodyHeight: number,
    colors: VolumeColors = {},
  ) {
    const look = lookOf(kind);
    const m = shadowMargin(look);
    const cap = Math.ceil(
      Math.max(look.radius, look.gloss.insetX + look.gloss.height) + look.outline + look.rimWidth,
    );
    const width = cap * 2 + PLATE_CORE;
    const height = Math.round(bodyHeight);
    const key = `ui_plate_${kind}_${height}_${colorsKey(colors)}`;
    const art = bakeVolume(scene, key, width, height, look, colors);
    super(
      scene,
      0,
      0,
      key,
      undefined,
      art.textureWidth,
      art.textureHeight,
      m.side + cap,
      m.side + cap,
    );
    this.margin = m;
    this.currentWidth = width;
    this.setOrigin(0.5, (m.top + height / 2) / art.textureHeight);
    scene.add.existing(this);
  }

  /** Width of the body without its shadow. */
  get bodyWidth(): number {
    return this.currentWidth;
  }

  /** Stretches the body to `width` (never narrower than its two rounded ends). */
  setBodyWidth(width: number): this {
    this.currentWidth = width;
    this.setSize(width + this.margin.side * 2, this.height);
    return this;
  }
}

/** A plate of `kind`, `width` x `height`, centred on (x, y). */
export function createPlate(
  scene: Phaser.Scene,
  kind: VolumeKind,
  x: number,
  y: number,
  width: number,
  height: number,
  colors: VolumeColors = {},
): VolumePlate {
  return new VolumePlate(scene, kind, height, colors).setBodyWidth(width).setPosition(x, y);
}
