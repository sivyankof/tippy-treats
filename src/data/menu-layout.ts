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
  /** The popup window of the menus (missions, streak, gift). */
  popup: {
    depth: 700,
    dimAlpha: 0.62,
    /** Width of the window body. */
    width: 900,
    /** Room above the content: the ribbon title sits on the top edge. */
    titleSpace: 150,
    padX: 48,
    padBottom: 56,
    /** The window never gets lower than this. */
    minContentHeight: 120,
    /** Keep this much air between the window and the screen edges. */
    screenMargin: 40,
    close: { size: 88, inset: 14 },
    /** How long the window takes to shrink and fade when it closes. */
    closeMs: 160,
    closeScale: 0.85,
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
    record: { y: 396, extraShare: 0.25, font: 50, height: 96, padX: 48, fill: 0x7c5cff },
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
    /** Progress dots of the Missions button and the red dots that say "something is waiting". */
    navDots: { size: 20, gap: 12, offsetY: 18, off: 0xe9d5c3, on: 0x3ddc97, outline: 4 },
    navAlert: { size: 40, offsetX: 6, offsetY: 6, fill: 0xe8334a, outline: 6 },
    /** The streak and the gift plates in a row under the level plate and the wallet. */
    badges: {
      y: 268,
      height: 100,
      edge: 24,
      streak: { fill: 0xff7a2f, font: 46, padX: 36, flame: 74, gap: 10 },
      gift: { fill: 0x7c5cff, width: 400, font: 36, box: 0.3, boxInset: 52, padRight: 28 },
      /** The flame stretches and sways all the time. */
      flicker: { ms: 380, scaleY: 1.1, scaleX: 0.94, swayDeg: 4 },
      /** A ready gift box shakes for `shakeMs` every `everyMs`. */
      shake: { everyMs: 2600, shakeMs: 90, repeat: 5, deg: 9 },
      /** The timer text is redrawn when the whole second changes. */
      readyColor: 0xffc93c,
    },
  },
  /** Coins and berries of a menu reward flying from where they were won into the wallet counters. */
  rewardFlight: {
    depth: 800,
    /** At most this many pictures per reward; a reward of 100 coins is split between them. */
    maxIcons: 8,
    iconSize: 64,
    /** The pictures first pop out of the source by up to `scatter` pixels, then fly away. */
    scatter: 160,
    scatterMs: 260,
    flyMs: 620,
    staggerMs: 70,
    arc: 160,
    /** Without a wallet to fly into the pictures just float up and fade. */
    floatUp: 140,
  },
  /** The streak windows: the calendar and the threat window. */
  streak: {
    cellGap: 16,
    columns: 4,
    cellHeight: 250,
    /** Today's cell: rim colour and the pulse. */
    todayRim: 0xffc93c,
    todayPulse: { scale: 1.06, ms: 520 },
    doneFill: 0xcdeedd,
    dayFont: 34,
    amountFont: 44,
    nameFont: 36,
    iconSize: 96,
    /** The tick of a passed day: a green disc on the cell corner. */
    tick: { size: 56, color: 0x3ddc97, offset: -22, halo: 4 },
    /** A passed day: the cell art fades to this alpha. */
    doneAlpha: 0.55,
    /** The reward picture sits this much above the middle; the amount this far above the bottom edge. */
    iconLift: 3,
    amountInset: 48,
    infoFont: 38,
    infoGap: 28,
    /** The flame beside the info line, the shift of the text from the middle and the side margins of the line. */
    infoFlame: 61,
    infoShift: 30,
    infoMargin: 76,
    buttonGap: 36,
    /** The window stays this long after the claim, so the tick and the flying reward are seen. */
    closeDelayMs: 700,
    button: { width: 520, height: 120, radius: 44, shadowOffset: 10, font: 56 },
    /** Reward of day 7 of the first round is a creature: its icon is shown this big. */
    creatureIcon: 150,
    threat: {
      textFont: 44,
      textGap: 40,
      flame: 200,
      buttonWidth: 760,
      buttonHeight: 120,
      buttonRadius: 44,
      buttonShadow: 10,
      buttonFont: 46,
      buttonGap: 28,
      declineFont: 40,
      declineGap: 40,
      /** The decline text takes taps in a zone this tall. */
      declineHit: 88,
      disabledAlpha: 0.6,
      /** Fill of the berries button when the berries are short. */
      shortFill: 0x9a8fa8,
    },
  },
  /** The free gift window. */
  gift: {
    /** The box on the window, by its centre from the top of the content, and its scale. */
    boxY: 190,
    boxScale: 1,
    /** The coins line ("+30 coins") and the "next gift in" line, centred at this y. */
    coinsY: 440,
    coinsFont: 96,
    textY: 440,
    textFont: 50,
    buttonY: 570,
    button: { width: 640, height: 124, radius: 44, shadowOffset: 10, font: 52 },
    contentHeight: 640,
    /** Shaking before the opening: how long, the waves and the swing. */
    shakeMs: 700,
    shakeWaves: 28,
    shakeDeg: 9,
    /** The coins line pops in at this scale and settles. */
    pop: { scale: 1.3, ms: 280 },
    /** The "next gift in" timer is redrawn this often. */
    tickMs: 250,
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
  /** Rewards flying from a window to the counters of the screen. */
  /** The progress bar of missions (window and results); the look follows `xpBar`. */
  progressBar: { radius: 18, border: 3 },
  /** The missions window (docs/07-ui-screens.md, section 11). Positions are relative to a card centre. */
  missions: {
    cardHeight: 210,
    cardGap: 18,
    sectionGap: 26,
    padX: 30,
    textFont: 40,
    textY: -54,
    barY: 38,
    barWidth: 400,
    barHeight: 46,
    barFont: 30,
    /** Colour of the card rim and of the bar by group. */
    groupColors: { easy: 0x3ddc97, medium: 0xffc93c, hard: 0xff5c8a },
    rewardFont: 40,
    rewardX: 100,
    actionX: 272,
    actionY: 38,
    actionButton: { width: 200, height: 88, radius: 30, shadowOffset: 7, font: 38 },
    actionTextPadding: 28,
    noteFont: 28,
    chestHeight: 260,
    chestTitleFont: 44,
    chestTitleY: -84,
    chestBarY: -12,
    chestBarFont: 32,
    chestButtonY: 68,
    chestButton: { width: 560, height: 88, radius: 32, shadowOffset: 8, font: 42 },
    chestButtonPadding: 40,
    disabledAlpha: 0.5,
    timerFont: 36,
    timerHeight: 48,
    timerTickMs: 1000,
    tickFont: 36,
  },
  results: {
    /** Free space above the first block. */
    top: 40,
    /** The blocks keep at least this much air between them; on a taller screen they spread out. */
    sectionGap: 16,
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
    /** The missions block: a title and compact rows of the missions this run moved. */
    missions: {
      /** At most this many rows are shown. */
      maxRows: 3,
      titleFont: 40,
      rowHeight: 64,
      rowGap: 8,
      textFont: 34,
      textWidth: 540,
      barWidth: 360,
      barHeight: 44,
      barFont: 28,
      width: 940,
      fillMs: 900,
      delayMs: 500,
      doneScale: 1.18,
      doneMs: 220,
    },
    /** The daily tiers paid by a daily run: one compact row each. */
    tiers: { rowHeight: 56, rowGap: 6, font: 36, width: 940, rewardFont: 40 },
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
  /** The daily tower screen: a stack of blocks that spreads out on a taller screen. */
  daily: {
    /** Free space under the last block. */
    bottom: 70,
    /** Gap between blocks: at least `minGap`, grows with the spare height up to `maxGap`. */
    minGap: 24,
    maxGap: 64,
    /** Section captions ("Team of the day"): font, height of the row, and the right-hand text. */
    caption: { font: 42, height: 70, sideFont: 36, width: 960, color: 0xffffff },
    /** Date and timer on one plate. */
    date: {
      width: 960,
      height: 150,
      fill: 0x7c5cff,
      font: 50,
      timerFont: 38,
      dateY: 52,
      timerY: 108,
      timerColor: 0xffc93c,
      /** The timer text is rebuilt this often. */
      tickMs: 250,
    },
    /** Team cards use `MENU.card`; the creatures are drawn at this level. */
    team: { gapX: 28 },
    /** Zone chips: a grid of `cols` columns. */
    rules: {
      cols: 3,
      width: 960,
      chipHeight: 124,
      gap: 20,
      zoneFont: 36,
      ruleFont: 30,
      zoneY: 42,
      ruleY: 86,
      padX: 16,
      ruleColor: 0xfff6ec,
      fills: {
        kitchen: 0xe8964a,
        showcase: 0xe85a9a,
        roof: 0x7c5cff,
        clouds: 0x4aa3e8,
        stars: 0x3a3a8c,
        space: 0x5a3a8c,
      },
    },
    /** Reward tiers: five cells in a row. */
    rewards: {
      width: 960,
      cellHeight: 230,
      gap: 14,
      heightFont: 54,
      heightY: 54,
      priceFont: 34,
      priceFirstY: 120,
      priceStep: 48,
      /** Tinted fills: reached, not reached yet. */
      reachedFill: 0x2fb97f,
      openFill: 0x7c5cff,
      bestRim: 0xffc93c,
      tick: { size: 52, inset: 10 },
      sideFont: 36,
    },
    /** Attempts: icons on the left, the ad button on the right. */
    attempts: {
      width: 960,
      rowHeight: 104,
      iconSize: 84,
      iconGap: 16,
      freeColor: 0x3ddc97,
      usedColor: 0xb9a9c6,
      ad: { width: 560, height: 104, radius: 36, shadowOffset: 8, font: 38 },
      adPadding: 40,
      adDisabledAlpha: 0.55,
    },
    play: { width: 760, height: 150, radius: 48, shadowOffset: 10, font: 64 },
    playPadding: 60,
    playDisabledAlpha: 0.6,
    /** The padlock panel that replaces the attempts and the Play button before level 5. */
    lock: {
      width: 960,
      height: 330,
      fill: 0x7c5cff,
      font: 46,
      padlockSize: 130,
      padlockY: 100,
      textY: 238,
      textPadding: 60,
      color: 0xffc93c,
    },
  },
} as const;
