import * as Phaser from 'phaser';
import { openSlots } from '../../../core/team';
import { BALANCE } from '../../../data/balance';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { gameState } from '../../../state';
import { CreaturePortrait } from '../../objects/creature-portrait';
import { slotAt, slotX } from './home-shelf-math';

const cfg = MENU.home;
/** Half the height of a creature layer on the shelf, plus the gap: how high its centre stands. */
const CREATURE_LIFT = (BALANCE.layer.height * cfg.shelfLayerScale) / 2 + cfg.creatureGap;

/** Draws a dashed ellipse outline centred at (0, 0). */
function dashedEllipse(g: Phaser.GameObjects.Graphics, width: number, height: number): void {
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

/**
 * The team shelf of Home: a wooden plank with the team standing on it. A tap on a creature
 * pokes it and then opens the Team screen; a tap on the plank or a free slot opens it at once.
 * `root` is placed at the middle of the plank top.
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
    const { shelfWidth, shelfHeight, shelfSpacing, shelfTap, plank } = cfg;
    // Only the open slots stand on the shelf, centred: a locked slot is not shown at all.
    const open = openSlots(gameState.data.bakerLevel);
    const slots = open;
    const g = scene.add.graphics();
    g.fillStyle(plank.shadow, 1).fillRoundedRect(
      -shelfWidth / 2,
      plank.topHeight,
      shelfWidth,
      shelfHeight,
      plank.radius,
    );
    g.fillStyle(plank.body, 1).fillRoundedRect(
      -shelfWidth / 2,
      0,
      shelfWidth,
      shelfHeight,
      plank.radius,
    );
    g.fillStyle(plank.top, 1).fillRoundedRect(
      -shelfWidth / 2,
      0,
      shelfWidth,
      plank.topHeight * 2,
      plank.radius,
    );
    this.root = scene.add.container(0, 0, [g]);

    for (let i = 0; i < slots; i++) {
      const x = slotX(i, slots, shelfSpacing);
      const id = i < open ? gameState.data.team[i] : null;
      const owned = id ? gameState.data.creatures[id] : undefined;
      if (id && owned) {
        const portrait = new CreaturePortrait(
          scene,
          x,
          -CREATURE_LIFT,
          id,
          owned.level,
          cfg.shelfLayerWidth,
          cfg.shelfLayerScale,
        );
        this.root.add(portrait);
        this.portraits.push(portrait);
        continue;
      }
      this.portraits.push(null);
      if (i < open) {
        const width = cfg.shelfLayerWidth * cfg.shelfLayerScale;
        const height = BALANCE.layer.height * cfg.shelfLayerScale;
        const spot = scene.add.graphics({ x, y: -CREATURE_LIFT });
        spot.lineStyle(cfg.slotOutline.lineWidth, PALETTE.textDark, cfg.slotOutline.alpha);
        dashedEllipse(spot, width, height);
        this.root.add(spot);
      }
    }

    this.zone = scene.add
      .zone(0, shelfHeight + plank.topHeight - shelfTap.height / 2, shelfTap.width, shelfTap.height)
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
    const portrait = this.portraits[slotAt(local, this.portraits.length, cfg.shelfSpacing)];
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
