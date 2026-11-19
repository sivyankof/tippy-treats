import * as Phaser from 'phaser';
import { PALETTE } from '../../../data/common/palette';
import { cssColor } from '../../../util/color';
import { textPadding } from '../../../util/text-padding';
import { bakeTexture } from './bake-texture';
import { FONT_FAMILY, FONT_WEIGHT } from './fonts';
import { glyphBoxWidth, glyphChars, glyphKey, layoutGlyphs } from './glyph-layout';

/**
 * Text drawn from pictures of its glyphs on the shared atlas. A Phaser `Text` is a texture of its
 * own, so on a phone each one is a draw call of its own; the glyph pictures of a HUD text sit on the
 * same atlas page as the plates and icons around them and batch with them. The look is that of
 * `createStrokedText`: same font, fill and stroke, same box (`width` is the width of the Text it
 * replaces), and the origin is kept by placing the glyphs, so the container scales and rotates
 * around the same point.
 */

/** The look of a glyph text: the font size, the outline and the two colours. */
export interface GlyphStyle {
  fontSize: number;
  strokeWidth: number;
  color: number;
  strokeColor: number;
}

/** The style of a light HUD text with the dark outline (what `createStrokedText` makes). */
export function hudGlyphStyle(fontSize: number, strokeWidth: number): GlyphStyle {
  return { fontSize, strokeWidth, color: PALETTE.textLight, strokeColor: PALETTE.textDark };
}

function styleId(style: GlyphStyle): string {
  const { fontSize, strokeWidth, color, strokeColor } = style;
  return `${fontSize}_${strokeWidth}_${color.toString(16)}_${strokeColor.toString(16)}`;
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
  { style: GlyphStyle; chars: Set<string>; textures: Phaser.Textures.TextureManager }
>();
const live = new Set<GlyphText>();

/** Measures the font the way Phaser does: with a throwaway Text of the same style (nothing is added to the scene). */
function styleMetrics(scene: Phaser.Scene, style: GlyphStyle): StyleMetrics {
  const id = styleId(style);
  const known = metricsOf.get(id);
  if (known) return known;
  const pad = textPadding(style.strokeWidth, 0, 0);
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

function bakeGlyph(scene: Phaser.Scene, style: GlyphStyle, id: string, char: string): void {
  const m = styleMetrics(scene, style);
  const width = glyphBoxWidth(measureIn(style, char), style.strokeWidth, m.padX);
  const left = m.padX + style.strokeWidth / 2;
  const baseline = m.padY + style.strokeWidth / 2 + m.ascent;
  bakeTexture(
    scene,
    glyphKey(id, char),
    width,
    m.height,
    () => undefined,
    (context) => {
      context.font = fontOf(style);
      context.textBaseline = 'alphabetic';
      context.lineJoin = 'round';
      context.lineCap = 'round';
      context.lineWidth = style.strokeWidth;
      context.strokeStyle = cssColor(style.strokeColor);
      context.fillStyle = cssColor(style.color);
      context.strokeText(char, left, baseline);
      context.fillText(char, left, baseline);
    },
  );
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
  const baked = bakedOf.get(id) ?? { style, chars: new Set<string>(), textures: scene.textures };
  bakedOf.set(id, baked);
  for (const char of glyphChars(strings)) {
    if (!scene.textures.exists(glyphKey(id, char))) bakeGlyph(scene, style, id, char);
    baked.chars.add(char);
  }
}

/** The web font arrived after the first bake: the metrics and every glyph picture are made again. */
function rebakeAll(): void {
  const scene = [...live][0]?.scene;
  metricsOf.clear();
  for (const [id, { style, chars, textures }] of bakedOf) {
    for (const char of chars) {
      const key = glyphKey(id, char);
      if (textures.exists(key)) textures.remove(key);
    }
    // With no text on screen the next scene that needs the glyphs bakes them again.
    if (scene) prepareGlyphs(scene, style, [[...chars].join('')]);
    else bakedOf.delete(id);
  }
  for (const text of live) {
    text.render();
    text.onRefresh?.();
  }
}

if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.addEventListener('loadingdone', rebakeAll);
}

/** A string of glyph pictures: a container whose `width` is the width of the box of the same Text. */
export class GlyphText extends Phaser.GameObjects.Container {
  private readonly images: Phaser.GameObjects.Image[] = [];
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
    for (let i = 0; i < capacity; i++) this.glyphImage(i);
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
      this.glyphImage(i)
        .setTexture(glyphKey(this.id, glyph.char))
        .setPosition(left + glyph.x, top)
        .setVisible(true);
    });
    for (let i = layout.glyphs.length; i < this.images.length; i++)
      this.images[i]?.setVisible(false);
  }

  private glyphImage(index: number): Phaser.GameObjects.Image {
    let image = this.images[index];
    if (!image) {
      image = new Phaser.GameObjects.Image(this.scene, 0, 0, '__DEFAULT')
        .setOrigin(0, 0)
        .setVisible(false);
      this.images[index] = image;
      this.add(image);
    }
    return image;
  }

  override preDestroy(): void {
    live.delete(this);
    this.onRefresh = null;
    super.preDestroy();
  }
}
