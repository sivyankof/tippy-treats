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
    /** A short notice on a plate (`ui/style/toast.ts`): it slides up, waits and fades. */
    toast: {
      width: 760,
      height: 120,
      font: 44,
      /** Distance from the bottom edge of the screen to the plate centre. */
      bottom: 80,
      textPadding: 50,
      inMs: 220,
      holdMs: 1800,
      outMs: 300,
      depth: 1000,
    },
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
    /** The one grey of a price button the player cannot pay yet ("Not enough N"). */
    shortFill: 0x9a8fa8,
    /** A list that scrolls by dragging a finger or the wheel (`ScrollList`). */
    scroll: {
      /** A press that moves farther than this is a drag, not a tap. */
      dragPx: 18,
      /** Share of the speed kept every 16 ms after the finger is lifted, and the speed below which it stops (px/ms). */
      friction: 0.95,
      /** The span of time `friction` is counted over, in ms. */
      frictionFrameMs: 16,
      stopSpeed: 0.02,
      /** Speed is taken from the last moves of the finger, in ms. */
      speedWindowMs: 90,
      /** Wheel notch to pixels. */
      wheelScale: 1,
      /** The list leaves this much room under its last block. */
      endPad: 140,
    },
    wallet: { height: 84, padLeft: 26, padRight: 12, fill: 0x5b4372 },
    /**
     * Plates of the run HUD: chips of the kit, see-through so the tower shows under them
     * (docs/07 section 4). The alpha is set on the plate only, never on its text.
     */
    hud: {
      alpha: 0.8,
      /** HUD plates are baked per size; widths are rounded up to this step to share pictures. */
      widthStep: 8,
    },
    /** An on/off switch: the label on the left, a track with a sliding knob on the right. */
    toggle: {
      height: 104,
      font: 48,
      trackWidth: 156,
      trackHeight: 80,
      /** Room between the knob and the ends of the track. */
      knobInset: 10,
      labelGap: 28,
      onFill: 0x3ddc97,
      offFill: 0xb9a9c6,
      knobFill: 0xfff6ec,
      /** Space between two switches of a column (`createToggleRows`). */
      gap: 6,
      slideMs: 180,
      slideEase: 'Back.easeOut',
    },
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
    /**
     * A plate behind the header of a screen whose list scrolls under it: its lower edge, and how
     * far it runs past the top and the sides of the screen.
     */
    band: { bottom: 214, overhang: 80 },
  },
  /** The popup window of the menus (missions, streak, gift). */
  popup: {
    depth: 700,
    /** Depth added per stacking layer, so a window opened over another one sits above it (and its veil blocks it). */
    layerStep: 10,
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
    /** A locked card with several ways to get the creature stacks one smaller line per way. */
    hintFontMulti: 28,
    hintLineGap: 38,
    /** Side room kept free around a hint line. */
    hintPad: 24,
    /** In-team cards of the team grid get a veil of this alpha over the opaque card and carry a tick. */
    inTeamVeil: 0.45,
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
    /** Twinkling stars around a creature with sparkles: at most `maxLive` at once, each lives `lifeMs`, `size` is the star's scale and `spinDeg` how far it turns. */
    sparkle: { maxLive: 3, lifeMs: 520, size: 1.3, spinDeg: 70 },
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
    /**
     * The "fresh oven" plate under the record plate (no room above): the character on the left, the lines
     * and the scale of the bonus layers on the right. It moves down by `extraShare` of the extra height.
     */
    ovenPlate: {
      y: 580,
      extraShare: 0.25,
      width: 960,
      height: 210,
      pictureX: 130,
      pictureScale: 1,
      textLeft: 250,
      textRight: 48,
      mainFont: 62,
      subFont: 34,
      /** Lines from the middle of the plate: the lit one has a scale, the spent one has two text lines. */
      lit: { mainY: -56, barY: 12, subY: 66 },
      spent: { mainY: -36, subY: 40 },
      bar: { height: 28, radius: 14, border: 3 },
      /** The time to the new day is redrawn when the minute changes: checked this often. */
      tickMs: 1000,
    },
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
    /** The "Starter pack $1.99" button above Play, for the first days (docs/07, section 2). */
    starter: { width: 700, height: 108, radius: 38, shadowOffset: 8, font: 44, gap: 44, pad: 40 },
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
    /** Progress dots of the Missions button and the red dots that say "something is waiting". */
    navDots: { size: 20, gap: 12, offsetY: 18, off: 0xe9d5c3, on: 0x3ddc97, outline: 4 },
    navAlert: { size: 40, offsetX: 6, offsetY: 6, fill: 0xe8334a, outline: 6 },
    /** The streak and the gift plates in a row under the level plate and the wallet. */
    badges: {
      y: 268,
      height: 100,
      edge: 24,
      streak: { fill: 0xff7a2f, font: 46, padX: 36, flame: 74, gap: 10 },
      gift: {
        fill: 0x7c5cff,
        width: 400,
        font: 36,
        box: 0.3,
        boxInset: 52,
        padRight: 28,
        /** The closed box sways calmly; a ready one sways wider and hops now and then. */
        motion: {
          sway: { idleDeg: 3, readyDeg: 7, ms: 1500 },
          hop: {
            everyMs: 2600,
            rise: 16,
            riseMs: 170,
            fallMs: 150,
            squash: { x: 1.12, y: 0.86, ms: 90 },
            stretch: { x: 0.92, y: 1.1 },
          },
        },
      },
      /** The settings button, left of the gift plate in the same row (it is at least 88 across). */
      gear: { size: 96, fill: 0x7c5cff, gap: 24 },
      /** The flame stretches and sways all the time. */
      flicker: { ms: 380, scaleY: 1.1, scaleX: 0.94, swayDeg: 4 },
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
    /** Pictures poured out of an opening (a box): they rise in a fan around straight up, `reach` px away; they start `staggerMs` apart and wait `holdMs` at the top so the whole fan shows before they fly to the wallet. */
    pour: { fanDeg: 130, reach: 190, riseMs: 360, staggerMs: 22, holdMs: 200 },
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
      /** The berry balance row above the price: its height and the right end of its plate. */
      balanceHeight: 90,
      balanceRight: 380,
    },
  },
  /** The gentle "no ads" offer after the second interstitial of a session. */
  noAdsOffer: {
    contentHeight: 700,
    iconSize: 190,
    iconY: 110,
    /** The picture sways gently: the angle (degrees) and the half period (ms). */
    sway: { angle: 4, ms: 1100 },
    textY: 290,
    textFont: 46,
    /** The note under the text; it also shows why a purchase did not go through. */
    noteY: 356,
    noteFont: 36,
    buyY: 480,
    buy: { width: 720, height: 124, radius: 44, shadowOffset: 10, font: 52 },
    laterY: 624,
  },
  /** The free gift window. */
  /** The oven explainer window. */
  ovenWindow: {
    contentHeight: 780,
    pictureY: 200,
    pictureScale: 2,
    textY: 505,
    font: 46,
    buttonY: 690,
    button: { width: 640, height: 124, radius: 44, shadowOffset: 10, font: 52 },
  },
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
    /** The "x2 for an ad" button while no ad can be shown. */
    adDisabledAlpha: 0.6,
    /** Shaking before the opening: how long, the waves and the swing. */
    shakeMs: 700,
    shakeWaves: 28,
    shakeDeg: 9,
    /** The box invites: it sways wide and hops now and then while the gift is ready. */
    motion: {
      sway: { idleDeg: 3, readyDeg: 6, ms: 1600 },
      hop: {
        everyMs: 2200,
        rise: 35,
        riseMs: 230,
        fallMs: 200,
        squash: { x: 1.1, y: 0.88, ms: 120 },
        stretch: { x: 0.94, y: 1.08 },
      },
    },
    /** The coins line pops in at this scale and settles. */
    pop: { scale: 1.3, ms: 280 },
    /** The "next gift in" timer is redrawn this often. */
    tickMs: 250,
  },
  /** The settings window (docs/07, section 13). Heights are from the top of the content. */
  settings: {
    /** Space between blocks of the window (switches, language, notifications, restore, reset). */
    blockGap: 36,
    /** Language row: the label on the left, two buttons on the right. */
    language: {
      height: 104,
      font: 48,
      button: { width: 270, height: 96, radius: 34, shadowOffset: 8, font: 40 },
      buttonGap: 20,
      picked: 0xff5c8a,
      other: 0x7c5cff,
    },
    /** Notification switches of the types are narrower and shifted right: they belong to the general one. */
    notifyIndent: 64,
    /** "Restore purchases" and "Reset progress". */
    wideButton: { width: 680, height: 100, radius: 36, shadowOffset: 8, font: 42 },
    restoreFill: 0x7c5cff,
    /** "No ads" with its price above "Restore purchases": the button, and the gap under it. */
    noAdsFill: 0x2fbf71,
    noAdsGap: 24,
    /** The result line under "Restore purchases": its room and font. */
    resultHeight: 56,
    resultFont: 38,
    /** Version and install id lines, small. */
    infoFont: 30,
    infoLine: 40,
    /** Install id is shown by its first characters only. */
    installIdChars: 8,
    infoAlpha: 0.85,
  },
  /** The confirmation windows of "Reset progress": the text, a gap and two buttons one under the other. */
  confirm: {
    textFont: 44,
    textGap: 40,
    button: { width: 680, height: 112, radius: 40, shadowOffset: 10, font: 52 },
    buttonGap: 26,
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
    lidHeight: 90,
    lidOverhang: 18,
    ribbonWidth: 54,
    bowSize: 96,
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
    /** The XP of a mission under its coins. */
    xpFont: 26,
    xpY: 84,
    actionX: 272,
    actionY: 38,
    actionButton: { width: 200, height: 88, radius: 30, shadowOffset: 7, font: 38 },
    actionTextPadding: 28,
    noteFont: 28,
    chestHeight: 400,
    /** The chest picture takes this much of the card on the left; title, reward and bar share the rest. */
    chestAreaWidth: 290,
    /** Where the middle of the chest body is (x is an offset from the middle of the chest area), and the gap between the chest area and the text column. */
    chestBoxX: 10,
    chestBoxY: 30,
    /** The berries poured out of the chest: smaller pictures and a short fan so the heap stays inside the card. */
    chestPour: { iconScale: 0.6, reach: 90 },
    chestColumnGap: 10,
    chestTitleFont: 44,
    chestTitleY: -150,
    chestPriceY: -88,
    chestBarY: -22,
    chestBarFont: 32,
    chestButtonY: 144,
    /** The chest of the day: calm sway while closed, wider sway and hops while ready, lid flip when opened; the rays behind a ready chest. */
    chestMotion: {
      sway: { idleDeg: 2.5, readyDeg: 5, ms: 1800 },
      hop: {
        everyMs: 2000,
        rise: 10,
        riseMs: 190,
        fallMs: 170,
        squash: { x: 1.1, y: 0.88, ms: 110 },
        stretch: { x: 0.94, y: 1.08 },
      },
      rays: {
        count: 10,
        radius: 170,
        burstRadius: 145,
        squashY: 0.92,
        turnMs: 14000,
        pulseMs: 800,
        scale: { from: 0.9, to: 1.08 },
        alpha: { from: 0.6, to: 0.95 },
      },
      open: { foldMs: 110, popMs: 300 },
    },
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
    /** The header and the panel keep at least this much air between them; on a taller screen they spread out. */
    sectionGap: 16,
    /**
     * The window plate of the kit under the blocks from the stats down to the "almost" line: the
     * blocks stand `gap` apart inside it, `padY` from its top and bottom edges.
     */
    panel: { width: 1000, padY: 40, gap: 24 },
    /** On a short screen the panel's padding and gaps shrink to this share at the least. */
    panelMinSpacing: 0.3,
    /** The dev-only plate over a run that is not saved. */
    debugPlate: { width: 900, height: 84, font: 38 },
    heightFont: 200,
    recordFont: 48,
    /** Line height of a text, as a share of its font size. */
    lineHeight: 1.3,
    rowGap: 8,
    labelFont: 34,
    statFont: 56,
    statColumns: 3,
    /** Width a stat label may take before it shrinks. */
    statWidth: 300,
    /** The abilities tile is wider; its creature icons with their counts stand in a row. */
    abilityCellWidth: 470,
    abilityIconSize: 72,
    abilityIconGap: 6,
    abilityItemGap: 26,
    /** Size of the count beside an icon, as a share of the stat font. */
    abilityCountScale: 0.75,
    coinTotalFont: 84,
    /** The coin icon beside the total: its size as a share of the font, and the gap to the number. */
    coinIconScale: 1,
    coinIconGap: 16,
    breakdownFont: 36,
    breakdownColumns: 2,
    breakdownColumnWidth: 440,
    breakdownRowHeight: 56,
    adButton: { width: 580, height: 104, radius: 36, shadowOffset: 8, font: 44 },
    adTextPadding: 40,
    adDisabledAlpha: 0.5,
    xpFont: 52,
    /** The oven mark beside the XP line (icon and chip), and the message when a run emptied the oven. */
    ovenMark: { height: 64, iconScale: 0.4, font: 40, gap: 14 },
    ovenMessageFont: 34,
    ovenMessageWidth: 900,
    nearMissFont: 40,
    nearMissWidth: 900,
    /** The missions block: a title and compact rows of the missions this run moved. */
    missions: {
      /** At most this many rows are shown. */
      maxRows: 3,
      titleFont: 40,
      rowHeight: 64,
      rowGap: 8,
      textFont: 34,
      textWidth: 510,
      barWidth: 360,
      barHeight: 44,
      barFont: 28,
      width: 900,
      fillMs: 900,
      delayMs: 500,
      doneScale: 1.18,
      doneMs: 220,
    },
    /** The daily tiers paid by a daily run: one compact row each. */
    tiers: { rowHeight: 56, rowGap: 6, font: 36, width: 900, rewardFont: 40 },
    /** The XP bar fills this long per whole level, at least `xpMinMs` per piece. */
    xpFillMs: 1400,
    xpMinMs: 350,
    xpStartDelayMs: 350,
    levelFlash: { scale: 1.12, ms: 160, holdMs: 250 },
    /** Big and small buttons at the bottom; they stand `buttonsBottom` above the bottom edge. */
    playButton: { width: 760, height: 150, radius: 48, shadowOffset: 10, font: 64 },
    homeButton: { width: 520, height: 104, radius: 36, shadowOffset: 8, font: 44 },
    /** "Home" and "Share" side by side in one row as wide as the big button. */
    pairButton: { width: 366, height: 104, radius: 36, shadowOffset: 8, font: 40 },
    pairGap: 28,
    buttonTextPadding: 50,
    buttonsBottom: 170,
    buttonGap: 28,
    /** Level-up window: a `PopupWindow` of the kit, the level on its ribbon. */
    levelUp: {
      lineFont: 44,
      /** Room for the label inside the button. */
      labelPad: 56,
      gap: 26,
      rowHeight: 76,
      creatureRowHeight: 150,
      duplicateRowHeight: 78,
      portraitWidth: 150,
      portraitGap: 24,
      /** Picture of a reward line (the pile, the slot, the tower, the shop creature) and the height of its row. */
      pictureSize: 150,
      pictureRowHeight: 158,
      /** Pop-in of the pictures: the first starts after `startMs`, the rest follow every `staggerMs`. */
      appear: {
        startMs: 250,
        staggerMs: 110,
        popMs: 360,
        fadeMs: 200,
        ease: 'Back.easeOut',
        bob: { bobPx: 3, bobPeriodMs: 3400, phaseSpreadMs: 1700 },
        sparkle: { x: 0.36, y: -0.36, scale: 0.7, turnDeg: 90, ms: 520, tint: 0xfff2a8 },
      },
      okButton: { width: 520, height: 112, radius: 40, shadowOffset: 8, font: 52 },
    },
  },
  /** The shop: a scrolling list of blocks 960 wide under the header band. */
  shop: {
    width: 960,
    /** Air between the header band and the first block. */
    top: 40,
    /** Between blocks, and between the rows of one block. */
    gap: 52,
    rowGap: 26,
    /** One row: a card with an icon, two lines of text and a button. */
    row: {
      height: 160,
      padX: 28,
      iconSize: 108,
      iconGap: 24,
      titleFont: 46,
      subFont: 32,
      titleY: 0.36,
      subY: 0.72,
      button: { width: 300, height: 104, radius: 36, shadowOffset: 8, font: 42 },
      wideButton: { width: 400, height: 104, radius: 36, shadowOffset: 8, font: 38 },
      /** The button label shrinks to fit the button less this much. */
      buttonPad: 28,
      badge: { height: 44, font: 28, padX: 26, fill: 0xe8334a },
      ownedFill: 0x2fb97f,
    },
    /** The starter pack card. */
    starter: {
      height: 540,
      rim: 0xffc93c,
      titleFont: 54,
      timerFont: 34,
      timerColor: 0xffc93c,
      padX: 40,
      titleY: 62,
      /** The title takes at most this share of the width; the timer gets what is left less `titleGap`. */
      titleShare: 0.6,
      titleGap: 24,
      iconSize: 190,
      /** The live creature in the big picture: its layer is this wide, scaled down to `iconSize`. */
      portraitLayerWidth: 240,
      iconX: 150,
      iconY: 216,
      lineX: 290,
      lineFont: 44,
      lineIcon: 76,
      /** Pile size of the small coin and berry pictures of the lines, and of the big coin pile that replaces an owned creature. */
      linePileStep: 2,
      ownedPileStep: 3,
      lineGap: 14,
      linesY: 140,
      lineStep: 72,
      noteFont: 30,
      noteY: 364,
      noteWrap: 820,
      button: { width: 600, height: 108, radius: 38, shadowOffset: 8, font: 50 },
      buttonY: 468,
      /** The timer is redrawn this often. */
      tickMs: 500,
    },
    /** The small "Restore purchases" button at the end of the list. */
    restore: { width: 520, height: 88, radius: 30, shadowOffset: 6, font: 34, fill: 0x7c5cff },
    /** A short message under the header ("Purchase failed"). */
    toast: {
      /** Middle of the message, measured from the lower edge of the header band. */
      belowBand: 90,
      height: 96,
      font: 38,
      padX: 48,
      maxWidth: 940,
      showMs: 2600,
      fadeMs: 300,
      depth: 600,
    },
    /** Dim of a block whose product has no store id. */
    unavailableAlpha: 0.6,
    /**
     * The crossed-out tile of the No ads product: a small screen with a "play" triangle, no letters.
     * Sizes are shares of the tile, except `border` (pixels); `screen.y` is the screen centre
     * measured from the tile centre, `stand` hangs under the screen.
     */
    noAdsIcon: {
      radius: 0.22,
      fill: 0x7c5cff,
      /** Darkening of the flat shadow band, and its thickness as a share of the tile. */
      shadeAmount: -0.22,
      shadowShare: 0.05,
      gloss: {
        x: -0.3,
        y: -0.34,
        length: 0.16,
        thick: 0.045,
        tiltDeg: -20,
        dotGap: 0.03,
        dotRadius: 0.025,
        alpha: 0.85,
      },
      slash: 0.1,
      reach: 0.78,
      screen: { width: 0.56, height: 0.38, y: -0.06, radius: 0.07, border: 0.045, fill: 0xffffff },
      play: { size: 0.12, fill: 0x7c5cff },
      stand: { neckWidth: 0.07, neckHeight: 0.06, footWidth: 0.26, footHeight: 0.05 },
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
    /** The one-line explainer under the header; a tap opens the explainer window again. */
    intro: { width: 960, font: 38, color: 0xfff6ec },
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
      /** Gold rim of the next tier to reach. */
      nextRim: 0xffc93c,
      tick: { size: 60, inset: 12 },
      sideFont: 36,
      /** The progress line under the tiers ("12 layers to the next reward"). */
      progress: { gap: 18, font: 36, height: 50, color: 0xffc93c },
    },
    /** Attempts: icons on the left, the ad button on the right. */
    attempts: {
      width: 960,
      rowHeight: 170,
      /** Width of one ticket; the height follows the picture. */
      iconSize: 165,
      iconGap: 24,
      ad: { width: 390, height: 104, radius: 36, shadowOffset: 8, font: 38 },
      adPadding: 40,
      adDisabledAlpha: 0.55,
    },
    play: { width: 760, height: 150, radius: 48, shadowOffset: 10, font: 64 },
    playPadding: 60,
    /** In place of Play when the attempts ran out: the time to the next tower and the ad button. */
    outOfAttempts: {
      height: 230,
      timerY: 34,
      timerFont: 44,
      timerColor: 0xffc93c,
      adY: 160,
      ad: { width: 640, height: 124, radius: 44, shadowOffset: 10, font: 46 },
      adPadding: 60,
    },
    /** The explainer window of the first visit (same build as the fresh oven one). */
    introWindow: {
      contentHeight: 960,
      pictureY: 140,
      pictureSize: 250,
      textY: 530,
      font: 40,
      lineSpacing: 10,
      buttonY: 870,
      button: { width: 640, height: 124, radius: 44, shadowOffset: 10, font: 52 },
    },
    /** The ability of a team creature, opened by a tap on its card. */
    abilityWindow: { font: 44, levelFont: 36, levelY: 26, textTop: 80, padBottom: 20 },
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
