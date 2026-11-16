/**
 * The shared atlas: small baked pictures that are drawn many times per frame (layer pictures,
 * face parts, shades, glaze drips, toppers, effect sprites, HUD plates) live as frames of a few
 * big textures, so a phone that batches one texture per draw call draws a whole layer in one
 * call (docs/08-architecture.md, section 12).
 */
export const SHARED_ATLAS = {
  /**
   * Size of one atlas page, in pixels; a new page is opened only when the last one is full. One
   * 4096 x 4096 page holds every picture of a run, so the pictures of one frame never sit on two
   * textures (docs/08-architecture.md, section 12, the journal entry of the page size).
   */
  pageWidth: 4096,
  pageHeight: 4096,
  /** Height of the pages on a device whose GPU cannot make a `pageHeight` page (too small a maximum texture size, or the page failed). */
  fallbackPageHeight: 2048,
  /** A WebGL context lost within this many ms after the big page was made counts against it: the pages are rebuilt at the fallback height. */
  bigPageStrikeMs: 5000,
  /** Shelf heights are rounded up to this many pixels, so pictures of close heights share a shelf. */
  shelfStep: 8,
  /** The edge pixels of every picture are repeated this far outwards, so a scaled or cropped picture samples like a texture of its own. */
  extrude: 2,
  /** A picture larger than this on either side keeps a texture of its own. */
  maxSide: 1024,
  /** Texture keys starting with one of these go to the atlas. */
  keyPrefixes: [
    'layer_',
    'shade_',
    'glaze_drip_',
    'face_',
    'fx_',
    'tr_',
    'topper_',
    'tray',
    'tempo_',
    'ui_hud_',
    'ui_bar_',
    'ui_plate_chip',
    'ui_icon_',
    'ui_mastery_',
    'bd_mountains',
  ],
  /** Keys under those prefixes that must keep their own texture (repeated by a TileSprite). */
  ownTexture: ['fx_dash'],
} as const;
