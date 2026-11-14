/** Layout and look of the menu screens (Home, Team, Collection, creature card, results, rewards). */
export const MENU = {
  /** Labels longer than their room shrink to this share of their size at most. */
  text: { minFitScale: 0.8 },
  /** Cream background with soft dots. */
  background: { dotStep: 72, dotRadius: 7, dotAlpha: 0.35, driftPerSecond: 12 },
  header: {
    /** Round back button in the top-left corner, the same size as the pause button. */
    backSize: 96,
    margin: 24,
    radius: 28,
    shadow: 6,
    titleFont: 68,
    /** Title centre line; the coin counter sits on the same line on the right. */
    titleY: 72,
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
    /** In-team cards of the team grid are faded and carry a tick. */
    inTeamAlpha: 0.45,
    swayDeg: 3,
    swayMs: 1800,
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
  },
  home: {
    levelY: 230,
    /** The design height the layout numbers are made for. */
    baseHeight: 1920,
    /** The team shelf: a plank with up to three creatures standing on it. */
    shelfY: 780,
    shelfWidth: 960,
    shelfHeight: 34,
    shelfLayerWidth: 280,
    shelfLayerScale: 1,
    shelfSpacing: 320,
    shelfTap: { width: 980, height: 240 },
    recordY: 900,
    recordFont: 56,
    /** The Play button sits this far above the bottom navigation. */
    playAboveNav: 120,
    playWidth: 600,
    playHeight: 168,
    playFont: 84,
    playRadius: 60,
    playShadow: 12,
    /** The hint bubble about a free team slot, above Play. */
    hintAbovePlay: 210,
    hintFont: 36,
    /** Bottom navigation: five round buttons. */
    navBottomPad: 36,
    navSize: 132,
    navPlaySize: 172,
    navFont: 30,
    /** Line height of a nav caption, as a share of its font size. */
    navLineHeight: 1.4,
    navSlotWidth: 200,
    navDisabledAlpha: 0.35,
    /** After the tutorial Play pulses with a ring. */
    highlightRing: { width: 10, grow: 1.35, ms: 1100, pad: 18 },
    /** On a taller screen the shelf and the record line move down by this share of the extra height. */
    extraShare: 0.45,
    /** Gap between the plank top and the bottom edge of a creature standing on it. */
    creatureGap: 4,
    /** A dashed outline marks a free open slot. */
    slotOutline: { dash: 0.22, dashCount: 16, lineWidth: 6, alpha: 0.5 },
    plank: { top: 0xe0a665, body: 0xc98b4a, shadow: 0x8a5a2b, radius: 17, topHeight: 10 },
    /** A creature does something every random time in this range. */
    idleMinMs: 2000,
    idleMaxMs: 5000,
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
    navBadge: { width: 110, height: 40, radius: 20, font: 24, offsetY: 12 },
  },
  team: {
    slotsY: 380,
    slotSize: 300,
    slotGap: 30,
    slotLayerWidth: 330,
    slotLayerScale: 0.72,
    orderY: 600,
    orderFont: 40,
    gridTop: 700,
    /** Holding a card this long opens its creature card. */
    longPressMs: 450,
    /** A drag starts once the pointer moved this far. */
    dragStartPx: 24,
    lockFont: 34,
    helpFont: 34,
    helpGap: 56,
    /** Space kept free under the grid, and the share of spare height put above it. */
    gridBottom: 90,
    gridSpareShare: 0.33,
    slotRadius: 44,
    slotBorder: 10,
    slotDash: 26,
    slotDashGap: 16,
    slotLockedAlpha: 0.6,
    slotEmptyColor: 0xc9ad94,
    /** Room taken off the slot width for its inner texts, and the lift of the locked text from the bottom edge. */
    slotTextPad: 40,
    lockTextLift: 48,
    /** Alpha of a slot whose creature is being dragged away. */
    slotDimAlpha: 0.45,
    columns: 3,
    gridSideMargin: 20,
    slotLayerY: -20,
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
    countFont: 52,
    countY: 180,
    gridTop: 260,
    columns: 3,
    /** Space kept free below the grid. */
    bottomMargin: 60,
    /** A tap counts while the pointer moved less than this between press and release. */
    tapTolerancePx: 24,
    /** One owned creature pokes itself every random time in this range. */
    pokeEveryMs: [2000, 5000],
  },
  detail: {
    portraitY: 420,
    portraitWidth: 560,
    nameY: 640,
    nameFont: 84,
    rarityY: 720,
    rarityFont: 40,
    traitY: 790,
    traitFont: 40,
    abilityY: 870,
    abilityFont: 40,
    abilityWrap: 900,
    nextGap: 20,
    starsY: 560,
    /** Buttons from the bottom up. */
    buttonsBottom: 200,
    buttonGap: 30,
    shortFont: 34,
    /** Share of the extra screen height (above 1920) that moves the creature block down. */
    extraShare: 0.25,
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
    titleFont: 60,
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
      radius: 56,
      border: 8,
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
