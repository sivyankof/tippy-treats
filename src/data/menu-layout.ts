/** Layout and look of the menu screens (Home, Team, Collection, creature card, results, rewards). */
export const MENU = {
  /** Labels longer than their room shrink to this share of their size at most. */
  text: { minFitScale: 0.8 },
  /**
   * The volumetric look of the menus (src/game/ui/style/). Every panel, card, chip and button
   * is a body with a soft shadow under it, a dark outline, a vertical gradient (lighter at the
   * top), a gloss band in its upper part and a darker bevel along the bottom.
   */
  style: {
    /** The outline is the fill (or the rim colour) darkened by this much. */
    outlineShade: -0.38,
    /** The bevel along the bottom of a body: the fill darkened by this much. */
    bevelShade: -0.24,
    /** Steps of the vertical gradient and of the soft shadow. */
    gradientBands: 14,
    shadowSteps: 7,
    shadowColor: 0x3b2a4a,
    glossColor: 0xffffff,
    /** The gloss band keeps at least this share of the corner radius from the sides. */
    glossCorner: 0.62,
    /**
     * Looks of the body kinds. `lift` lightens the top of the gradient and `drop` darkens its
     * bottom; `rimWidth` is the coloured band inside the outline when a rim colour is given;
     * `bevel` is part of the body height; `gloss.height` is capped at `gloss.share` of the face.
     */
    looks: {
      window: {
        radius: 56,
        outline: 7,
        rimWidth: 12,
        bevel: 14,
        shadowOffset: 14,
        shadowBlur: 24,
        shadowAlpha: 0.32,
        lift: 0.45,
        drop: 0.05,
        gloss: { insetX: 30, insetY: 10, height: 44, share: 0.2, alpha: 0.55 },
      },
      card: {
        radius: 40,
        outline: 6,
        rimWidth: 10,
        bevel: 10,
        shadowOffset: 10,
        shadowBlur: 16,
        shadowAlpha: 0.3,
        lift: 0.45,
        drop: 0.07,
        gloss: { insetX: 22, insetY: 8, height: 30, share: 0.16, alpha: 0.55 },
      },
      chip: {
        radius: 30,
        outline: 5,
        rimWidth: 6,
        bevel: 7,
        shadowOffset: 6,
        shadowBlur: 10,
        shadowAlpha: 0.3,
        lift: 0.3,
        drop: 0.08,
        gloss: { insetX: 16, insetY: 6, height: 16, share: 0.3, alpha: 0.42 },
      },
      bar: {
        radius: 52,
        outline: 6,
        rimWidth: 0,
        bevel: 12,
        shadowOffset: -6,
        shadowBlur: 26,
        shadowAlpha: 0.3,
        lift: 0.45,
        drop: 0.06,
        gloss: { insetX: 40, insetY: 10, height: 26, share: 0.14, alpha: 0.5 },
      },
      button: {
        radius: 40,
        outline: 5,
        rimWidth: 0,
        bevel: 10,
        shadowOffset: 6,
        shadowBlur: 12,
        shadowAlpha: 0.32,
        lift: 0.3,
        drop: 0.06,
        gloss: { insetX: 18, insetY: 8, height: 40, share: 0.3, alpha: 0.42 },
      },
    },
    /** The ribbon of a screen title: a plate with folded tails at both ends. */
    ribbon: {
      y: 72,
      height: 116,
      font: 64,
      padX: 56,
      minWidth: 340,
      maxWidth: 520,
      /** The ribbon never gets narrower than this when the wallet squeezes it. */
      capMinWidth: 160,
      /** Free space kept between the ribbon and the wallet plates or the back button. */
      walletGap: 16,
      /** Plate widths are rounded up to this step, so similar titles share one texture. */
      widthStep: 20,
      tail: 66,
      tailHeight: 82,
      tailDrop: 28,
      notch: 28,
      /** How far a tail reaches in under the plate. */
      tuck: 34,
      tailShade: -0.28,
      radius: 40,
      fill: 0xff5c8a,
      /** The whole ribbon breathes a little. */
      breathe: { scale: 1.025, ms: 2400 },
    },
    /** The plates under the coin and berry counters of a screen header. */
    wallet: { height: 84, padLeft: 26, padRight: 12, fill: 0x5b4372 },
    /** The kitchen of the run behind the menus, under a veil and a darker top and bottom. */
    scenery: {
      depth: -100,
      veils: {
        /** Home: the kitchen stays bright. */
        home: { color: 0xfff6ec, alpha: 0.16 },
        /** Lists and cards: the kitchen steps back behind the panels. */
        list: { color: 0xfff6ec, alpha: 0.5 },
      },
      shade: {
        color: 0x3b2a4a,
        top: 0.22,
        topShare: 0.18,
        bottom: 0.3,
        bottomShare: 0.3,
        bands: 32,
      },
    },
  },
  header: {
    /** Round back button in the top-left corner, the same size as the pause button. */
    backSize: 96,
    margin: 24,
    radius: 28,
    shadow: 6,
    /** Content of a screen starts this far from the top. */
    contentTop: 230,
  },
  /** Small text buttons of the menus (in team, buy, try). */
  smallButton: { width: 420, height: 104, radius: 36, shadowOffset: 8, font: 44 },
  /** The wide main buttons of a card (buy, upgrade). */
  wideButton: { width: 760, height: 120, radius: 42, shadowOffset: 10, font: 52 },
  /** A creature card of the collection and the team grids. */
  card: {
    width: 312,
    height: 300,
    radius: 36,
    gapX: 28,
    gapY: 28,
    frame: 8,
    /** The creature layer on the card, as wide as this, drawn at this scale. */
    layerWidth: 360,
    layerScale: 0.66,
    layerY: -30,
    nameFont: 36,
    nameY: 74,
    starsY: 116,
    hintFont: 32,
    /** Locked cards show the icon as a dark silhouette. */
    silhouetteSize: 150,
    silhouetteColor: 0x3b2a4a,
    silhouetteAlpha: 0.55,
    /** In-team cards of the team grid get a veil of this alpha over the opaque card and carry a tick. */
    inTeamVeil: 0.45,
    /** A locked silhouette floats up and down by this much (a tilt breaks the flat-tint draw). */
    bobPx: 8,
    swayMs: 1800,
    /** Locked cards have a duller body: the panel colour darkened by this much. */
    lockedShade: -0.1,
    /** A lighter window behind the creature (height 0: none), tinted like the card rim. */
    stageHeight: 0,
    stageInset: 30,
    stageShade: 0.72,
    /** Scale of the level stars on the card. */
    starsScale: 1,
  },
  stars: { size: 26, gap: 6, on: 0xffc93c, off: 0xe9d5c3 },
  portrait: {
    /** Tap: a hop this high, a squeak and a happy face. */
    hopHeight: 60,
    hopMs: 360,
    joyMs: 700,
    /** Squeak pitch: the first creature `base`, every next one `step` higher. */
    squeakBase: 0.85,
    squeakStep: 0.05,
    /** At rest a creature breathes a little. */
    breatheScale: 0.025,
    breathePeriodMs: 2200,
  },
  /** Baker level and XP bar. */
  xpBar: {
    width: 640,
    height: 44,
    radius: 22,
    font: 40,
    labelGap: 18,
    back: 0xe9d5c3,
    border: 4,
    numbersScale: 0.8,
    /** The upper half of the empty bar is darkened by this much, like a groove. */
    groove: -0.12,
    /** A gloss strip along the top of the filled part. */
    gloss: { alpha: 0.42, inset: 7, share: 0.26 },
  },
  home: {
    /** The design height the layout numbers are made for. */
    baseHeight: 1920,
    /** On a taller screen the shelf block moves down by this share of the extra height. */
    extraShare: 0.5,
    /** Baker level and XP on a plate in the top-left corner; the bar is placed from the plate centre. */
    levelPlate: { left: 24, y: 100, width: 600, height: 140, barWidth: 340, barX: 74, barY: -20 },
    /** The record line on a plate under the top bar; it moves down by `extraShare` of the extra height. */
    record: { y: 330, extraShare: 0.25, font: 50, height: 96, padX: 48, fill: 0x7c5cff },
    /** The team shelf: a thick plank on two brackets, with up to three creatures standing on it. */
    shelf: {
      /** Top of the plank. */
      y: 1000,
      width: 1040,
      plankHeight: 66,
      wood: 0xc98b4a,
      /** The plank is drawn as a volume body of this look. */
      look: {
        radius: 18,
        outline: 6,
        rimWidth: 0,
        bevel: 14,
        shadowOffset: 22,
        shadowBlur: 26,
        shadowAlpha: 0.34,
        lift: 0.3,
        drop: 0.08,
        gloss: { insetX: 30, insetY: 6, height: 10, share: 0.3, alpha: 0.3 },
      },
      /** Grain lines on the front of the plank: share of the face height, length share, alpha. */
      grain: [
        { y: 0.48, from: 0.06, to: 0.38, alpha: 0.28 },
        { y: 0.66, from: 0.44, to: 0.9, alpha: 0.24 },
        { y: 0.36, from: 0.62, to: 0.82, alpha: 0.2 },
      ],
      grainWidth: 5,
      grainShade: -0.3,
      /** Two brackets under the plank, `inset` from its ends; `ball` is the round end, a share of the width. */
      bracket: { inset: 150, width: 34, height: 140, radius: 12, shade: -0.12, ball: 0.75 },
      /** The creatures: their layer width and scale, and the distance between their centres. */
      layerWidth: 220,
      layerScale: 1.5,
      spacing: 345,
      /** Gap between the plank top and the bottom edge of a creature standing on it. */
      creatureGap: 4,
      /** The tappable area over the shelf and the team. */
      tap: { width: 1060, height: 340 },
      /** A warm light on the wall behind the team, breathing slowly. */
      glow: { width: 1200, height: 640, y: -170, color: 0xffd68a, alpha: [0.35, 0.6], ms: 3400 },
      /** A brass plaque with the word "Team" on the front of the plank. */
      plaque: { height: 58, font: 34, padX: 34, fill: 0xffc93c },
    },
    /** The Play button sits this far above the bottom bar. */
    playAboveNav: 64,
    playWidth: 720,
    playHeight: 186,
    playFont: 96,
    playRadius: 66,
    playShadow: 16,
    /** The hint bubble about a free team slot, above Play. */
    hintAbovePlay: 220,
    hintFont: 36,
    /** Bottom navigation: five buttons on a bar along the bottom edge. */
    navSize: 132,
    navPlaySize: 172,
    navFont: 30,
    /** Line height of a nav caption, as a share of its font size. */
    navLineHeight: 1.4,
    navSlotWidth: 200,
    navDisabledAlpha: 0.45,
    /** The bar: its visible height, the room above the buttons, and how far it runs past the screen edges. */
    navBar: { height: 252, padTop: 26, overhang: 60 },
    /** After the tutorial Play pulses with a ring. */
    highlightRing: { width: 10, grow: 1.35, ms: 1100, pad: 18 },
    /** A dashed outline marks a free open slot. */
    slotOutline: { dash: 0.22, dashCount: 16, lineWidth: 6, alpha: 0.5 },
    /** A creature does something every random time in this range. */
    idleMinMs: 1600,
    idleMaxMs: 4000,
    idleLookMs: 1400,
    /** Share of idle moments that are a hop; the rest are looking at a neighbour. */
    idleHopChance: 0.5,
    lookDistance: 240,
    /** The speech bubble above Play. */
    bubble: {
      wrap: 560,
      padX: 40,
      padY: 26,
      radius: 40,
      tail: 28,
      bobPx: 12,
      bobMs: 900,
      fill: 0x7c5cff,
    },
    navCaptionGap: 16,
    navBadge: { width: 110, height: 44, font: 24, offsetY: 12, fill: 0x7c5cff },
  },
  team: {
    /** The design height the layout numbers are made for; a taller screen shifts the blocks down by these shares of the extra height. */
    baseHeight: 1920,
    slotsExtra: 0.2,
    orderExtra: 0.4,
    gridExtra: 0.35,
    slotsY: 470,
    slotWidth: 318,
    slotHeight: 370,
    /** Name of a creature under it in its slot. */
    slotNameFont: 36,
    slotNameLift: 44,
    slotGap: 30,
    slotLayerWidth: 330,
    slotLayerScale: 0.86,
    /** The order line and the help on one plate. */
    orderY: 850,
    orderFont: 40,
    orderPlate: { height: 210, sideMargin: 36, padX: 40, orderDy: -34, helpDy: 40 },
    gridTop: 1010,
    /** Up to this many creatures the grid has fewer, bigger cards. */
    fewCount: 4,
    fewColumns: 2,
    /** Largest scale of a card when there are few of them. */
    maxCardScale: 1.8,
    /** Holding a card this long opens its creature card. */
    longPressMs: 450,
    /** A drag starts once the pointer moved this far. */
    dragStartPx: 24,
    lockFont: 34,
    helpFont: 34,
    /** Space kept free under the grid, and the share of spare height put above it. */
    gridBottom: 90,
    gridSpareShare: 0.3,
    slotBorder: 10,
    slotDash: 26,
    slotDashGap: 16,
    slotEmptyColor: 0xc9ad94,
    /** Fills of an empty and of a locked slot plate, and the plus of an empty one. */
    slotEmptyFill: 0xf1e2d2,
    slotLockedFill: 0x9c8bb0,
    plus: { arm: 46, line: 16, y: -34 },
    /** The dashes of an empty slot sit this far inside its body. */
    slotDashInset: 26,
    /** Room taken off the slot width for its inner texts, and the lift of the locked text from the bottom edge. */
    slotTextPad: 40,
    lockTextLift: 48,
    /** Alpha of a slot whose creature is being dragged away. */
    slotDimAlpha: 0.45,
    columns: 3,
    gridSideMargin: 20,
    slotLayerY: -34,
    /** Pop-in of a slot that changed. */
    popMs: 280,
    popFrom: 0.6,
    popEase: 'Back.easeOut',
    /** Fade of a card that goes in or out of the team. */
    fadeMs: 180,
    /** The refusal shake of a card. */
    shakePx: 14,
    shakeMs: 55,
    shakeRepeat: 2,
    /** The ghost that follows the finger during a drag. */
    ghostScale: 0.9,
    ghostAlpha: 0.9,
    ghostDepth: 100,
    /** The tick on a card that is in the team. */
    tick: {
      x: 112,
      y: -92,
      radius: 34,
      line: 9,
      fill: 0x2ecc71,
      /** Corner points of the checkmark as shares of the radius. */
      check: {
        points: [
          { x: -0.45, y: 0 },
          { x: -0.1, y: 0.38 },
          { x: 0.5, y: -0.34 },
        ],
      },
    },
    lockBody: { width: 84, height: 64, radius: 14, shackleRadius: 26, line: 12, y: -34 },
  },
  collection: {
    /** The counter plate under the title ribbon. */
    countFont: 48,
    countY: 214,
    countPlate: { height: 76, padX: 48, minWidth: 220, fill: 0x5b4372 },
    gridTop: 290,
    columns: 3,
    /** Space kept free below the grid. */
    bottomMargin: 56,
    /** A tap counts while the pointer moved less than this between press and release. */
    tapTolerancePx: 24,
    /** One owned creature pokes itself every random time in this range. */
    pokeEveryMs: [2000, 5000],
    /** The cards of the grid: tall, with a big creature; laid over `MENU.card`. */
    card: {
      width: 330,
      height: 460,
      gapX: 24,
      gapY: 24,
      layerWidth: 360,
      layerScale: 0.8,
      layerY: -90,
      nameFont: 42,
      nameY: 134,
      starsY: 184,
      starsScale: 1.5,
      hintFont: 36,
      silhouetteSize: 170,
      stageHeight: 200,
      stageInset: 20,
    },
  },
  detail: {
    portraitWidth: 600,
    traitFont: 40,
    abilityFont: 40,
    /** Centre of the name ribbon; it sits on the upper edge of the hero plate. */
    ribbonY: 320,
    /** Keeps the ribbon above the hero plate that is rebuilt after an upgrade. */
    ribbonDepth: 5,
    /** Top of the hero plate and the gap between the blocks. */
    stageTop: 330,
    blockGap: 40,
    /** The hero block: plate, glow, pedestal, creature, stars. Numbers are relative to its middle. */
    stage: {
      width: 920,
      height: 470,
      portraitY: 20,
      starsY: 180,
      glowRadius: 320,
      glowSteps: 8,
      glowAlpha: 0.7,
      pedestal: {
        y: 100,
        width: 560,
        height: 90,
        rim: 20,
        shade: -0.1,
        baseShade: -0.35,
        glossAlpha: 0.35,
      },
    },
    /** The text block under the hero plate. */
    info: {
      width: 920,
      wrap: 820,
      padY: 36,
      gap: 18,
      nextGap: 16,
      minHeight: 200,
      rarityFont: 40,
      chipHeight: 64,
      chipMinWidth: 220,
      chipPadX: 44,
    },
    /** Buttons from the bottom up. */
    buttonsBottom: 200,
    buttonGap: 30,
    shortFont: 34,
    /** The free height above the buttons is split into this many gaps: above, between and below the blocks. */
    spreadGaps: 3,
    /** Hit area of the creature as a share of its width. */
    portraitHit: 0.6,
    /** A creature the player does not own is shown faded. */
    lockedAlpha: 0.55,
    /** Outline of the body texts, in the colour of the background. */
    bodyStroke: 4,
    /** Space kept free on both sides inside a button, for the label. */
    buttonPadding: 40,
    disabledFill: 0xb8a9a0,
    /** The stars pop when the level goes up. */
    starsPop: 1.5,
    popMs: 260,
    /** Sparkles flying out of the creature after an upgrade. */
    burst: {
      count: 14,
      /** Shape of `ParticleStyle` (game/fx/particle-motion.ts): stars fly out in all directions. */
      style: {
        speed: [380, 620],
        gravity: 0,
        drag: 2.2,
        spin: [-180, 180],
        scale: [0.6, 1.2],
        scaleTo: 0.3,
        alpha: 1,
        holdShare: 0.3,
        lifeMs: [600, 900],
        spreadDeg: 360,
        tiltDeg: 0,
      },
    },
    /** Scale of the level stars under the creature. */
    starsScale: 1.4,
  },
  newCreature: {
    boxY: 0.42,
    boxSize: 300,
    shakeMs: 900,
    shakeDeg: 8,
    jumpHeight: 280,
    jumpMs: 520,
    raysCount: 12,
    raysRadius: 520,
    raysAlpha: 0.35,
    raysSpinDegPerSec: 24,
    layerWidth: 520,
    nameFont: 96,
    rarityFont: 44,
    /** Name and rarity appear letter by letter. */
    letterMs: 55,
    buttonY: 0.82,
    box: 0xff9ecf,
    boxLid: 0xff5c8a,
    ribbon: 0xffc93c,
    titleY: 0.14,
    /** The box falls in from this far above its place. */
    dropFrom: 700,
    dropMs: 520,
    /** Pause after the title before the box drops, and after it landed before the shaking. */
    startDelayMs: 350,
    shakeDelayMs: 250,
    shakeWaves: 36,
    /** With reduced effects the shaking is this share as long. */
    reducedShakeShare: 0.4,
    boxRadius: 36,
    lidHeight: 90,
    lidOverhang: 18,
    ribbonWidth: 54,
    bowSize: 64,
    /** The lid flies up and away, spinning. */
    lidFlight: { rise: 420, drift: 220, spinDeg: 200, ms: 520 },
    /** The creature starts this small in the box and grows while it jumps. */
    startScale: 0.3,
    squash: { x: 1.22, y: 0.8, ms: 160 },
    raysFadeMs: 500,
    /** Name and rarity sit below the creature: from the centre of the creature layer. */
    nameGap: 90,
    rarityGap: 100,
    /** Share of the layer width that reacts to a poke, so the hit area stays above the name. */
    portraitHit: 0.4,
    /** Side margin of the title and the name, and the label padding inside the button. */
    sideMargin: 80,
    buttonLabelPad: 80,
    /** Gift box drawing: thickness of the lower edge, shade of the edges, bow proportions. */
    boxDepth: 10,
    lidDepth: 8,
    shade: -0.2,
    bowLift: 1 / 3,
    bowKnotLift: 1 / 4,
    bowKnot: 1 / 3,
    /** Direction of the confetti burst: straight up. */
    burstAngleDeg: -90,
    /** The button appears and the creature may be poked after the reveal. */
    buttonPopMs: 260,
    /** Particle burst out of the opened box. */
    burst: {
      count: 70,
      depth: 20,
      style: {
        speed: [500, 1100],
        gravity: 900,
        drag: 0.4,
        spin: [-540, 540],
        scale: [0.7, 1.3],
        scaleTo: 1,
        alpha: 1,
        holdShare: 0.6,
        lifeMs: [1100, 1700],
        spreadDeg: 150,
        tiltDeg: 0,
      },
    },
  },
  results: {
    /** Free space above the first block. */
    top: 40,
    /** The blocks keep at least this much air between them; on a taller screen they spread out. */
    sectionGap: 30,
    titleFont: 60,
    heightFont: 200,
    recordFont: 48,
    /** Line height of a text, as a share of its font size. */
    lineHeight: 1.3,
    rowGap: 8,
    labelFont: 34,
    statFont: 56,
    statColumns: 3,
    /** Width a stat label may take before it shrinks. */
    statWidth: 320,
    coinTotalFont: 84,
    /** The coin icon beside the total: its size as a share of the font, and the gap to the number. */
    coinIconScale: 1,
    coinIconGap: 16,
    breakdownFont: 36,
    breakdownColumns: 2,
    breakdownColumnWidth: 470,
    breakdownRowHeight: 56,
    adButton: { width: 580, height: 104, radius: 36, shadowOffset: 8, font: 44 },
    adTextPadding: 40,
    unavailableColor: 0xb9a9c6,
    xpFont: 52,
    nearMissFont: 40,
    nearMissWidth: 960,
    /** Room kept for the mission progress block (session 3). */
    missionsHeight: 0,
    /** The XP bar fills this long per whole level, at least `xpMinMs` per piece. */
    xpFillMs: 1400,
    xpMinMs: 350,
    xpStartDelayMs: 350,
    levelFlash: { scale: 1.12, ms: 160, holdMs: 250 },
    /** Big and small buttons at the bottom; they stand `buttonsBottom` above the bottom edge. */
    playButton: { width: 760, height: 150, radius: 48, shadowOffset: 10, font: 64 },
    homeButton: { width: 520, height: 104, radius: 36, shadowOffset: 8, font: 44 },
    buttonTextPadding: 50,
    buttonsBottom: 170,
    buttonGap: 28,
    /** Level-up window. */
    levelUp: {
      width: 880,
      titleFont: 84,
      /** Line height of the title, as a share of its font size. */
      lineHeight: 1.2,
      lineFont: 44,
      padding: 56,
      fill: 0x7c5cff,
      gap: 26,
      rowHeight: 76,
      creatureRowHeight: 150,
      duplicateRowHeight: 78,
      portraitWidth: 150,
      portraitGap: 24,
      okButton: { width: 520, height: 112, radius: 40, shadowOffset: 8, font: 52 },
      depth: 600,
      dimAlpha: 0.62,
    },
  },
} as const;
