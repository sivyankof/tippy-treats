import * as Phaser from 'phaser';
import { addToTeam, removeFromTeam, slotLayers, type TeamIds } from '../../core/team';
import { placeInSlot } from '../../core/team-place';
import { clampLevel, type CreatureId } from '../../data/creatures';
import { MENU } from '../../data/menu-layout';
import { formatNumber, t } from '../../i18n';
import { services } from '../../services';
import { gameState } from '../../state';
import { CreaturePortrait } from '../objects/creature-portrait';
import { openScreen, SCENES } from '../scene-keys';
import { createOutlinedText } from '../ui/outlined-text';
import { MenuBackground } from '../ui/menu/menu-background';
import { ScreenHeader } from '../ui/menu/screen-header';
import { fitText } from '../ui/menu/fit-text';
import { PressGesture } from '../ui/menu/team-gesture';
import { ownedIds, TeamGrid } from '../ui/menu/team-grid';
import { TeamSlots } from '../ui/menu/team-slots';
import { enterScreen, leaveScreen, type Movable } from '../ui/transition';

const cfg = MENU.team;

/** What a press started on: a card of the grid, or a creature standing in a slot. */
interface PressSource {
  id: CreatureId;
  /** Slot index when the press began on a slot; -1 for a card. */
  slot: number;
}

/** Team screen: three slots on top, the owned creatures below (docs/07-ui-screens.md, section 3). */
export class TeamScene extends Phaser.Scene {
  private bg!: MenuBackground;
  private header!: ScreenHeader;
  private slots!: TeamSlots;
  private grid!: TeamGrid;
  private order!: Phaser.GameObjects.Text;
  private help!: Phaser.GameObjects.Text;
  private team: TeamIds = [];
  private gesture: PressGesture | null = null;
  private source: PressSource | null = null;
  private ghost: CreaturePortrait | null = null;
  private leaving = false;

  constructor() {
    super(SCENES.team);
  }

  create(): void {
    this.leaving = false;
    this.gesture = null;
    this.source = null;
    this.ghost = null;
    const save = gameState.data;
    const levelOf = (id: CreatureId): number => this.levelOf(id);
    this.team = save.team;

    this.bg = new MenuBackground(this);
    this.header = new ScreenHeader(this, t('team.title'), () => this.leave(SCENES.home));
    this.slots = new TeamSlots(this);
    this.slots.refresh(this.team, levelOf, save.bakerLevel, false);
    const [a = '', b = '', c = ''] = slotLayers().map((n) => formatNumber(n));
    this.order = createOutlinedText(
      this,
      0,
      cfg.orderY,
      t('team.order', { a, b, c }),
      cfg.orderFont,
    );
    this.help = createOutlinedText(this, 0, cfg.orderY + cfg.helpGap, t('team.help'), cfg.helpFont);
    this.grid = new TeamGrid(this, ownedIds(save.creatures), levelOf, save.bakerLevel);
    this.grid.refresh(this.team, false);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('gameout', this.cancelPress, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.input.off('pointerdown', this.onDown, this);
      this.input.off('pointermove', this.onMove, this);
      this.input.off('pointerup', this.onUp, this);
      this.input.off('gameout', this.cancelPress, this);
      this.cancelPress();
    });
    this.layout();
    enterScreen(this, this.content());
  }

  override update(time: number, delta: number): void {
    this.bg.update(delta);
    this.header.update(time, delta);
    this.slots.tick(delta);
    this.grid.tick(delta);
    if (this.source && this.source.slot < 0 && this.gesture?.holdReached(time)) {
      this.openDetail(this.source.id);
    }
  }

  private levelOf(id: CreatureId): number {
    return clampLevel(gameState.data.creatures[id]?.level ?? 1);
  }

  private content(): Movable[] {
    return [...this.header.parts, ...this.slots.parts, this.order, this.help, ...this.grid.parts];
  }

  private layout(): void {
    const { width, height } = this.scale.gameSize;
    this.cameras.main.setSize(width, height);
    this.bg.resize(width, height);
    this.header.layout(width);
    this.slots.layout(width);
    this.order.setX(width / 2);
    this.help.setX(width / 2);
    fitText(this.order, width - cfg.slotGap * 2);
    fitText(this.help, width - cfg.slotGap * 2);
    this.grid.layout(width, height, cfg.gridTop);
  }

  // --- Input: tap, long press and drag are told apart by one gesture per press ---

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.leaving || this.gesture?.active) return;
    const slot = this.slots.slotAt(pointer.x, pointer.y);
    const slotId = slot >= 0 ? this.team[slot] : null;
    const id = slotId ?? (slot < 0 ? this.grid.idAt(pointer.x, pointer.y) : null);
    if (id === null) return;
    this.source = { id, slot: slotId === null ? -1 : slot };
    this.gesture = new PressGesture(
      this.source.slot < 0 ? cfg.longPressMs : Number.POSITIVE_INFINITY,
      cfg.dragStartPx,
    );
    this.gesture.begin(pointer.x, pointer.y, this.time.now);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (!this.gesture || !this.source) return;
    if (this.gesture.move(pointer.x, pointer.y)) this.startDrag(this.source);
    this.ghost?.setPosition(pointer.x, pointer.y);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    const source = this.source;
    const outcome = this.gesture?.end() ?? 'none';
    this.cancelPress();
    if (!source || this.leaving) return;
    if (outcome === 'tap') {
      if (source.slot >= 0) this.apply(removeFromTeam(this.team, source.slot), source.id);
      else this.apply(addToTeam(this.team, source.id, gameState.data.bakerLevel), source.id);
    } else if (outcome === 'drop') {
      const target = this.slots.slotAt(pointer.x, pointer.y);
      if (target >= 0 && (target === source.slot || this.team[target] === source.id)) return;
      if (target >= 0) {
        this.apply(placeInSlot(this.team, source.id, target, gameState.data.bakerLevel), source.id);
      } else if (source.slot >= 0) {
        this.apply(removeFromTeam(this.team, source.slot), source.id);
      }
    }
  }

  private startDrag(source: PressSource): void {
    const level = this.levelOf(source.id);
    this.ghost = new CreaturePortrait(
      this,
      0,
      0,
      source.id,
      level,
      cfg.slotLayerWidth,
      cfg.ghostScale,
    )
      .setAlpha(cfg.ghostAlpha)
      .setDepth(cfg.ghostDepth);
    services.haptics.play('selection');
    if (source.slot >= 0) this.slots.dim(source.slot);
  }

  /** Drops the press state and the drag ghost. */
  private cancelPress(): void {
    this.gesture?.cancel();
    this.gesture = null;
    this.source = null;
    this.ghost?.destroy();
    this.ghost = null;
    this.slots?.undim();
  }

  /** Saves a changed team and animates it; an unchanged one shakes the card instead. */
  private apply(next: TeamIds, id: CreatureId): void {
    if (next === this.team) {
      this.grid.shake(id);
      services.haptics.play('error');
      return;
    }
    gameState.setTeam(next);
    this.team = gameState.data.team;
    const save = gameState.data;
    this.slots.refresh(this.team, (c) => this.levelOf(c), save.bakerLevel);
    this.grid.refresh(this.team);
    services.audio.click();
    services.haptics.play('light');
  }

  // --- Leaving ---

  private openDetail(id: CreatureId): void {
    this.cancelPress();
    services.haptics.play('medium');
    this.leave(SCENES.creatureDetail, { id, back: SCENES.team });
  }

  private leave(key: Parameters<typeof openScreen>[1], data?: object): void {
    if (this.leaving) return;
    this.leaving = true;
    this.header.setBackEnabled(false);
    leaveScreen(this, this.content(), () => openScreen(this, key, data));
  }
}
