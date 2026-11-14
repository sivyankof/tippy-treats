import * as Phaser from 'phaser';
import { openSlots } from '../../../core/team';
import { BALANCE } from '../../../data/balance';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { t } from '../../../i18n';
import { gameState } from '../../../state';
import { shade } from '../../../util/color';
import { glow } from '../../objects/backdrop/art-kit';
import { CreaturePortrait } from '../../objects/creature-portrait';
import { bakeTexture } from '../bake-texture';
import { drawVolume, faceOffsetY, shadowMargin, VolumePlate } from '../style/volume';
import { createOutlinedText } from '../outlined-text';
import { slotAt, slotX } from './home-shelf-math';

const cfg = MENU.home;
const shelf = cfg.shelf;
const S = MENU.style;
/** Half the height of a creature layer on the shelf, plus the gap: how high its centre stands. */
const CREATURE_LIFT = (BALANCE.layer.height * shelf.layerScale) / 2 + shelf.creatureGap;
const SHELF_KEY = 'ui_home_shelf';
const GLOW_KEY = 'ui_home_glow';
const GLOW_SIZE = 256;

type Graphics = Phaser.GameObjects.Graphics;

/** Draws a dashed ellipse outline centred at (0, 0). */
function dashedEllipse(g: Graphics, width: number, height: number): void {
  const { dashCount, dash } = cfg.slotOutline;
  const step = (Math.PI * 2) / dashCount;
  for (let i = 0; i < dashCount; i++) {
    const a = i * step;
    g.beginPath();
    g.moveTo((Math.cos(a) * width) / 2, (Math.sin(a) * height) / 2);
    for (let k = 1; k <= 4; k++) {
      const b = a + (step * (1 - dash) * k) / 4;
      g.lineTo((Math.cos(b) * width) / 2, (Math.sin(b) * height) / 2);
    }
    g.strokePath();
  }
}

/** A wooden bracket under the plank: a block under the plank, a post and a round end. */
function drawBracket(g: Graphics, cx: number, top: number, outline: number): void {
  const { width, height, radius, shade: tone, ball: ballShare } = shelf.bracket;
  const wood = shade(shelf.wood, tone);
  const ball = width * ballShare;
  const shapes = (grow: number, dy: number): void => {
    g.fillRoundedRect(cx - width - grow, top - grow + dy, width * 2 + grow * 2, width + grow * 2, {
      tl: 0,
      tr: 0,
      bl: radius + grow,
      br: radius + grow,
    });
    g.fillRoundedRect(
      cx - width / 2 - grow,
      top - grow + dy,
      width + grow * 2,
      height - ball + grow * 2,
      radius,
    );
    g.fillCircle(cx, top + height - ball + dy, ball + grow);
  };
  g.fillStyle(S.shadowColor, shelf.look.shadowAlpha);
  shapes(0, shelf.look.shadowOffset);
  g.fillStyle(shade(wood, S.outlineShade), 1);
  shapes(outline, 0);
  g.fillStyle(wood, 1);
  shapes(0, 0);
  // Light falls from above-left: a lighter strip down the left side of the post.
  g.fillStyle(shade(wood, shelf.look.lift), 1);
  g.fillRoundedRect(cx - width / 2 + outline / 2, top, width / 3, height - ball * 2, width / 6);
  g.fillCircle(cx - ball / 3, top + height - ball - ball / 3, ball / 3);
}

/** The plank on its brackets, with its soft shadow on the wall; (0, 0) is the plank top centre. */
function bakeShelf(scene: Phaser.Scene): { width: number; height: number; top: number } {
  const look = shelf.look;
  const m = shadowMargin(look);
  const width = shelf.width + m.side * 2;
  const height = m.top + shelf.plankHeight + shelf.bracket.height + m.bottom;
  bakeTexture(scene, SHELF_KEY, width, height, (g) => {
    const plankBottom = m.top + shelf.plankHeight;
    for (const side of [-1, 1]) {
      const x = width / 2 + side * (shelf.width / 2 - shelf.bracket.inset);
      drawBracket(g, x, plankBottom - look.outline, look.outline);
    }
    drawVolume(g, m.side, m.top, shelf.width, shelf.plankHeight, look, { fill: shelf.wood });
    const faceTop = m.top + look.outline;
    const faceHeight = shelf.plankHeight - look.outline * 2 - look.bevel;
    for (const line of shelf.grain) {
      g.fillStyle(shade(shelf.wood, shelf.grainShade), line.alpha);
      g.fillRoundedRect(
        m.side + shelf.width * line.from,
        faceTop + faceHeight * line.y,
        shelf.width * (line.to - line.from),
        shelf.grainWidth,
        shelf.grainWidth / 2,
      );
    }
  });
  bakeTexture(scene, GLOW_KEY, GLOW_SIZE, GLOW_SIZE, (g) => {
    glow(g, GLOW_SIZE / 2, GLOW_SIZE / 2, GLOW_SIZE / 2, shelf.glow.color, 1);
  });
  return { width, height, top: m.top };
}

/** The brass plaque with the word "Team" in the middle of the plank front. */
function createPlaque(scene: Phaser.Scene): Phaser.GameObjects.GameObject[] {
  const { height, font, padX, fill } = shelf.plaque;
  const y = (shelf.plankHeight - shelf.look.bevel) / 2;
  const label = createOutlinedText(scene, 0, y + faceOffsetY('chip'), t('team.title'), font);
  const plate = new VolumePlate(scene, 'chip', height, { fill })
    .setBodyWidth(label.width + padX * 2)
    .setY(y);
  return [plate, label];
}

/**
 * The team shelf of Home: a thick wooden plank on two brackets under a warm light, with the
 * team standing on it. The creatures blink, breathe, hop and look at each other; a tap on a
 * creature pokes it (a hop and its squeak) and then opens the Team screen; a tap on the plank
 * or a free slot opens it at once. `root` is placed at the middle of the plank top.
 */
export class HomeShelf {
  readonly root: Phaser.GameObjects.Container;
  private readonly portraits: Array<CreaturePortrait | null> = [];
  private readonly zone: Phaser.GameObjects.Zone;
  private idleTimer = 0;
  private busy = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onOpenTeam: () => void,
  ) {
    // Only the open slots stand on the shelf, centred: a locked slot is not shown at all.
    const slots = openSlots(gameState.data.bakerLevel);
    const art = bakeShelf(scene);
    const light = scene.add
      .image(0, shelf.glow.y, GLOW_KEY)
      .setDisplaySize(shelf.glow.width, shelf.glow.height)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(shelf.glow.alpha[0]);
    scene.tweens.add({
      targets: light,
      alpha: shelf.glow.alpha[1],
      duration: shelf.glow.ms / 2,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
    const plank = scene.add.image(0, 0, SHELF_KEY).setOrigin(0.5, art.top / art.height);
    this.root = scene.add.container(0, 0, [light, plank, ...createPlaque(scene)]);

    for (let i = 0; i < slots; i++) {
      const x = slotX(i, slots, shelf.spacing);
      const id = gameState.data.team[i];
      const owned = id ? gameState.data.creatures[id] : undefined;
      if (id && owned) {
        const portrait = new CreaturePortrait(
          scene,
          x,
          -CREATURE_LIFT,
          id,
          owned.level,
          shelf.layerWidth,
          shelf.layerScale,
        );
        this.root.add(portrait);
        this.portraits.push(portrait);
        continue;
      }
      this.portraits.push(null);
      const spot = scene.add.graphics({ x, y: -CREATURE_LIFT });
      spot.lineStyle(cfg.slotOutline.lineWidth, PALETTE.textDark, cfg.slotOutline.alpha);
      dashedEllipse(
        spot,
        shelf.layerWidth * shelf.layerScale,
        BALANCE.layer.height * shelf.layerScale,
      );
      this.root.add(spot);
    }

    this.zone = scene.add
      .zone(0, shelf.plankHeight - shelf.tap.height / 2, shelf.tap.width, shelf.tap.height)
      .setInteractive()
      .on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => this.tap(pointer));
    this.root.add(this.zone);
    this.resetIdle();
  }

  setEnabled(enabled: boolean): void {
    if (enabled) this.zone.setInteractive();
    else this.zone.disableInteractive();
  }

  update(dtMs: number): void {
    for (const portrait of this.portraits) portrait?.tick(dtMs);
    this.idleTimer -= dtMs;
    if (this.idleTimer <= 0) {
      this.idle();
      this.resetIdle();
    }
  }

  private resetIdle(): void {
    this.idleTimer = Phaser.Math.Between(cfg.idleMinMs, cfg.idleMaxMs);
  }

  private tap(pointer: Phaser.Input.Pointer): void {
    if (this.busy) return;
    this.busy = true;
    const local = pointer.worldX - this.root.x;
    const portrait = this.portraits[slotAt(local, this.portraits.length, shelf.spacing)];
    if (!portrait) {
      this.onOpenTeam();
      return;
    }
    portrait.poke();
    this.scene.time.delayedCall(MENU.portrait.hopMs, this.onOpenTeam);
  }

  /** A random creature hops or looks at a neighbour. */
  private idle(): void {
    const alive = this.portraits.filter((p): p is CreaturePortrait => p !== null);
    const one = Phaser.Utils.Array.GetRandom(alive);
    if (!one) return;
    const neighbour = alive.find((p) => p !== one);
    if (!neighbour || Math.random() < cfg.idleHopChance) {
      this.scene.tweens.add({
        targets: one,
        y: one.y - MENU.portrait.hopHeight,
        duration: MENU.portrait.hopMs / 2,
        ease: 'Quad.easeOut',
        yoyo: true,
      });
      return;
    }
    const dx = Math.sign(neighbour.x - one.x) * cfg.lookDistance;
    one.lookAt(dx, 0);
    this.scene.time.delayedCall(cfg.idleLookMs, () => one.lookAt(0, 0));
  }
}
