import * as Phaser from 'phaser';
import { PALETTE } from '../../../data/common/palette';
import { cssColor } from '../../../util/color';
import { textPadding } from '../../../util/text-padding';
import { bakeTexture } from './bake-texture';
import { FONT_FAMILY, FONT_WEIGHT } from './fonts';
import { glyphBoxWidth, glyphChars, glyphKey, glyphStrokeKey, layoutGlyphs } from './glyph-layout';
import { VOLUME_TEXT } from '../../../data/common/volume-text-look';
import { paintVolumeBack, paintVolumeFace, volumeSpecId, type VolumeSpec } from './volume-text';

/**
 * Text drawn from pictures of its glyphs on the shared atlas. A Phaser `Text` is a texture of its
 * own, so on a phone each one is a draw call of its own; the glyph pictures of a HUD text sit on the
 * same atlas page as the plates and icons around them and batch with them. The look is that of
 * `createStrokedText`: same font, fill and stroke, same box (`width` is the width of the Text it
 * replaces), and the origin is kept by placing the glyphs, so the container scales and rotates
 * around the same point.
 *
 * Every glyph has two pictures, its outline and its fill, and a text draws all the outlines before
 * any fill (as a Text strokes the whole line and then fills it), so the outline of a glyph never
 * covers the fill of the one before it.
 *
 * A style with `volume` draws the glyphs in the volume look (`volume-text.ts`): the outline picture
 * is the contour with its step of shadow, the fill picture is the face with its band and gloss. The
 * box is that of `createOutlinedText` (the padding takes the step too).
 */

/** The look of a glyph text: the font size, the outline and the two colours. */
export interface GlyphStyle {
  fontSize: number;
  strokeWidth: number;
  color: number;
  strokeColor: number;
  /** Draws the volume look instead of a flat fill and outline (the colours above are then unused). */
  volume?: VolumeSpec;
  /**
   * The glyphs keep textures of their own instead of cells of the shared atlas: for big glyphs shown
   * alone (one tall shelf of the atlas page each), where one more draw does not matter.
   */
  ownTextures?: boolean;
}

/** The style of a light HUD text with the dark outline (what `createStrokedText` makes). */
export function hudGlyphStyle(fontSize: number, strokeWidth: number): GlyphStyle {
  return { fontSize, strokeWidth, color: PALETTE.textLight, strokeColor: PALETTE.textDark };
}

/** The style of a volume text of the run: the contour and step of `VOLUME_TEXT`, the face of `spec`. */
export function volumeGlyphStyle(fontSize: number, spec: VolumeSpec): GlyphStyle {
  return {
    fontSize,
    strokeWidth: VOLUME_TEXT.contour,
    color: VOLUME_TEXT.faces[spec.face].color,
    strokeColor: VOLUME_TEXT.contourColor,
    volume: spec,
  };
}

function styleId(style: GlyphStyle): string {
  const { fontSize, strokeWidth, color, strokeColor, volume } = style;
  const flat = `${fontSize}_${strokeWidth}_${color.toString(16)}_${strokeColor.toString(16)}`;
  const id = volume ? `${flat}_v${volumeSpecId(volume)}` : flat;
  return style.ownTextures ? `${id}_own` : id;
}

function fontOf(style: GlyphStyle): string {
  return `${FONT_WEIGHT.black} ${style.fontSize}px ${FONT_FAMILY}`;
}

/** What the glyph pictures of a style share: the room around the glyph and where its baseline is. */
interface StyleMetrics {
  padX: number;
  padY: number;
  /** Height of the Text box, as Phaser sizes it. */
  height: number;
  ascent: number;
}

const metricsOf = new Map<string, StyleMetrics>();
/** The glyph pictures baked per style (their keys), to bake them again when the font arrives. */
const bakedOf = new Map<
  string,
  {
    style: GlyphStyle;
    chars: Set<string>;
    textures: Phaser.Textures.TextureManager;
    /** Whether the font was there when the pictures were baked. */
    fontReady: boolean;
  }
>();
const live = new Set<GlyphText>();

/** Measures the font the way Phaser does: with a throwaway Text of the same style (nothing is added to the scene). */
function styleMetrics(scene: Phaser.Scene, style: GlyphStyle): StyleMetrics {
  const id = styleId(style);
  const known = metricsOf.get(id);
  if (known) return known;
  const pad = textPadding(style.strokeWidth, 0, style.volume ? VOLUME_TEXT.step : 0);
  const probe = scene.make.text({
    x: 0,
    y: 0,
    text: '0',
    add: false,
    style: {
      fontFamily: FONT_FAMILY,
      fontStyle: FONT_WEIGHT.black,
      fontSize: style.fontSize,
      padding: { left: pad.x, right: pad.x, top: pad.y, bottom: pad.y },
      stroke: '#000',
      strokeThickness: style.strokeWidth,
    },
  });
  const metrics = {
    padX: pad.x,
    padY: pad.y,
    height: probe.height,
    ascent: probe.style.getTextMetrics().ascent,
  };
  probe.destroy();
  metricsOf.set(id, metrics);
  return metrics;
}

let measureContext: CanvasRenderingContext2D | null = null;

/** Width of `text` in the font of `style`. */
function measureIn(style: GlyphStyle, text: string): number {
  measureContext ??= document.createElement('canvas').getContext('2d');
  if (!measureContext) return text.length * style.fontSize;
  measureContext.font = fontOf(style);
  return measureContext.measureText(text).width;
}

function bakeGlyphLayer(
  scene: Phaser.Scene,
  style: GlyphStyle,
  key: string,
  char: string,
  layer: 'stroke' | 'fill',
): void {
  const m = styleMetrics(scene, style);
  const width = glyphBoxWidth(measureIn(style, char), style.strokeWidth, m.padX);
  const left = m.padX + style.strokeWidth / 2;
  const baseline = m.padY + style.strokeWidth / 2 + m.ascent;
  bakeTexture(
    scene,
    key,
    width,
    m.height,
    () => undefined,
    (context) => {
      if (style.volume) {
        const canvas = { context, width, height: m.height, font: fontOf(style) };
        const pen = { x: left, baseline };
        if (layer === 'stroke') paintVolumeBack(canvas, char, pen);
        else paintVolumeFace(canvas, char, pen, style.volume);
        return;
      }
      context.font = fontOf(style);
      context.textBaseline = 'alphabetic';
      context.lineJoin = 'round';
      context.lineCap = 'round';
      context.lineWidth = style.strokeWidth;
      if (layer === 'stroke') {
        context.strokeStyle = cssColor(style.strokeColor);
        context.strokeText(char, left, baseline);
      } else {
        context.fillStyle = cssColor(style.color);
        context.fillText(char, left, baseline);
      }
    },
  );
}

function fontAvailable(style: GlyphStyle): boolean {
  return typeof document === 'undefined' || !document.fonts || document.fonts.check(fontOf(style));
}

/**
 * Bakes the glyphs of every character in `strings` that has no picture yet. Call it while a scene
 * loads, so no frame of a run bakes anything.
 */
export function prepareGlyphs(
  scene: Phaser.Scene,
  style: GlyphStyle,
  strings: readonly string[],
): void {
  const id = styleId(style);
  const baked = bakedOf.get(id) ?? {
    style,
    chars: new Set<string>(),
    textures: scene.textures,
    fontReady: fontAvailable(style),
  };
  bakedOf.set(id, baked);
  for (const char of glyphChars(strings)) {
    const shared = !style.ownTextures;
    bakeGlyphLayer(scene, style, glyphStrokeKey(id, char, shared), char, 'stroke');
    bakeGlyphLayer(scene, style, glyphKey(id, char, shared), char, 'fill');
    baked.chars.add(char);
  }
}

/**
 * Called when fonts finish loading (from `refreshTextsOnFontLoad`). The glyph pictures are baked
 * again only for a style whose font was missing at its bake and is there now; the other styles stay.
 */
export function rebakeGlyphsOnFontLoad(): void {
  const stale = [...bakedOf].filter(([, baked]) => !baked.fontReady && fontAvailable(baked.style));
  if (stale.length === 0) return;
  const scene = [...live][0]?.scene;
  metricsOf.clear();
  for (const [id, { style, chars, textures }] of stale) {
    for (const char of chars) {
      const shared = !style.ownTextures;
      for (const key of [glyphKey(id, char, shared), glyphStrokeKey(id, char, shared)]) {
        if (textures.exists(key)) textures.remove(key);
      }
    }
    // With no text on screen the next scene that needs the glyphs bakes them again.
    bakedOf.delete(id);
    if (scene) prepareGlyphs(scene, style, [[...chars].join('')]);
  }
  for (const text of live) {
    text.render();
    text.onRefresh?.();
  }
}

/** A string of glyph pictures: a container whose `width` is the width of the box of the same Text. */
export class GlyphText extends Phaser.GameObjects.Container {
  private readonly strokes: Phaser.GameObjects.Image[] = [];
  private readonly fills: Phaser.GameObjects.Image[] = [];
  private readonly id: string;
  private current = '';
  /** Called after the glyphs were made again for a new font (the box may have changed size). */
  onRefresh: (() => void) | null = null;

  /**
   * `originX` / `originY` work as the origin of a Text. `capacity` glyph pictures are made up front, so
   * a text change in a run creates no objects (a longer text grows the pool).
   */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly style: GlyphStyle,
    private readonly anchorX = 0.5,
    private readonly anchorY = 0.5,
    capacity = 0,
  ) {
    super(scene, x, y);
    this.id = styleId(style);
    for (let i = 0; i < capacity; i++) this.glyphImages(i);
    live.add(this);
    scene.add.existing(this);
  }

  get text(): string {
    return this.current;
  }

  setText(text: string): this {
    if (text === this.current) return this;
    this.current = text;
    this.render();
    return this;
  }

  /** Lays the glyphs out again (the text changed, or the font did). */
  render(): void {
    const { style } = this;
    prepareGlyphs(this.scene, style, [this.current]);
    const m = styleMetrics(this.scene, style);
    const layout = layoutGlyphs(this.current, (s) => measureIn(style, s));
    const width = glyphBoxWidth(layout.advance, style.strokeWidth, m.padX);
    const left = Math.round(-this.anchorX * width);
    const top = Math.round(-this.anchorY * m.height);
    this.setSize(width, m.height);
    layout.glyphs.forEach((glyph, i) => {
      const [stroke, fill] = this.glyphImages(i);
      const shared = !style.ownTextures;
      stroke
        .setTexture(glyphStrokeKey(this.id, glyph.char, shared))
        .setPosition(left + glyph.x, top);
      fill.setTexture(glyphKey(this.id, glyph.char, shared)).setPosition(left + glyph.x, top);
      stroke.setVisible(true);
      fill.setVisible(true);
    });
    for (let i = layout.glyphs.length; i < this.fills.length; i++) {
      this.strokes[i]?.setVisible(false);
      this.fills[i]?.setVisible(false);
    }
  }

  /** The outline and the fill picture of glyph `index`; every outline sits before every fill in the container. */
  private glyphImages(index: number): [Phaser.GameObjects.Image, Phaser.GameObjects.Image] {
    let stroke = this.strokes[index];
    let fill = this.fills[index];
    if (!stroke || !fill) {
      stroke = this.newImage();
      fill = this.newImage();
      this.addAt(stroke, this.strokes.length);
      this.add(fill);
      this.strokes[index] = stroke;
      this.fills[index] = fill;
    }
    return [stroke, fill];
  }

  private newImage(): Phaser.GameObjects.Image {
    return new Phaser.GameObjects.Image(this.scene, 0, 0, '__DEFAULT')
      .setOrigin(0, 0)
      .setVisible(false);
  }

  override preDestroy(): void {
    live.delete(this);
    this.onRefresh = null;
    super.preDestroy();
  }
}
