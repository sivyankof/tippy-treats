import type * as Phaser from 'phaser';
import { BALANCE } from '../../data/balance';
import { PALETTE } from '../../data/palette';
import { cssColor } from '../../util/color';
import { effectsMode } from '../effects-mode';
import { FONT_FAMILY, FONT_WEIGHT } from '../ui/fonts';
import type { UiRegion } from '../ui/ui-regions';
import type { RunInfo } from '../scenes/game-scene';
import { adsDev } from '../../services';
import { gameState } from '../../state';
import { cycleDebugLevel, cycleDebugSlot, getDebugTeam } from './debug-team';

const FONT_SIZE = 30;
const MARGIN = 20;
const SPEED_DECIMALS = 0;
const WOBBLE_DECIMALS = 1;
const ENTRY_PADDING = { x: 14, y: 8 };
const ENTRY_GAP = 12;
/** Space between the controls row and the numbers above it. */
const ROW_GAP = 14;
const NO_CREATURE = '-';
const APPLY_LABEL = 'restart';
const BERRIES_LABEL = '+50 berries';
const DEBUG_BERRIES = 50;

/** Dev-only overlay with the run numbers and the temporary team picker (until M6's Team screen). */
export class DebugPanel {
  private readonly text: Phaser.GameObjects.Text;
  private readonly slotEntries: Phaser.GameObjects.Text[] = [];
  private readonly levelEntry: Phaser.GameObjects.Text;
  private readonly applyEntry: Phaser.GameObjects.Text;
  private readonly berriesEntry: Phaser.GameObjects.Text;
  private readonly adsEntry: Phaser.GameObjects.Text;
  private readonly entries: Phaser.GameObjects.Text[];
  private teamKey = '';

  /** `onApply` starts a new run, which takes the picked team. */
  constructor(scene: Phaser.Scene, onApply: () => void) {
    this.text = scene.add
      .text(MARGIN, 0, '', {
        fontFamily: FONT_FAMILY,
        fontStyle: FONT_WEIGHT.extraBold,
        fontSize: FONT_SIZE,
        color: cssColor(PALETTE.textDark),
      })
      .setOrigin(0, 1)
      .setStroke(cssColor(PALETTE.textLight), 4)
      .setVisible(false)
      .setDepth(1000);

    const entry = (onTap: () => void, fill: number): Phaser.GameObjects.Text =>
      scene.add
        .text(0, 0, '', {
          fontFamily: FONT_FAMILY,
          fontStyle: FONT_WEIGHT.extraBold,
          fontSize: FONT_SIZE,
          color: cssColor(PALETTE.textDark),
          backgroundColor: cssColor(fill),
          padding: {
            left: ENTRY_PADDING.x,
            right: ENTRY_PADDING.x,
            top: ENTRY_PADDING.y,
            bottom: ENTRY_PADDING.y,
          },
        })
        .setOrigin(0, 1)
        .setVisible(false)
        .setDepth(1000)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', onTap);

    for (let slot = 0; slot < BALANCE.team.slots; slot++) {
      this.slotEntries.push(entry(() => this.change(() => cycleDebugSlot(slot)), PALETTE.panel));
    }
    this.levelEntry = entry(() => this.change(cycleDebugLevel), PALETTE.panel);
    this.applyEntry = entry(onApply, PALETTE.gold).setText(APPLY_LABEL);
    this.berriesEntry = entry(() => gameState.addBerries(DEBUG_BERRIES), PALETTE.panel).setText(
      BERRIES_LABEL,
    );
    this.adsEntry = entry(() => {
      adsDev.cycleMode();
      this.showAdsMode();
      this.relayout();
    }, PALETTE.panel);
    this.showAdsMode();
    this.entries = [
      ...this.slotEntries,
      this.levelEntry,
      this.berriesEntry,
      this.adsEntry,
      this.applyEntry,
    ];
  }

  get visible(): boolean {
    return this.text.visible;
  }

  setVisible(visible: boolean): void {
    this.text.setVisible(visible);
    for (const entry of this.entries) entry.setVisible(visible);
  }

  /** Screen area of the controls while shown, so taps on them do not drop a layer. */
  bounds(): UiRegion | null {
    if (!this.visible) return null;
    const first = this.entries[0];
    const last = this.entries[this.entries.length - 1];
    if (!first || !last) return null;
    const height = first.height;
    return {
      x: first.x,
      y: first.y - height,
      width: last.x + last.width - first.x,
      height,
    };
  }

  layout(screenHeight: number): void {
    let x = MARGIN;
    for (const entry of this.entries) {
      entry.setPosition(x, screenHeight - MARGIN);
      x += entry.width + ENTRY_GAP;
    }
    const rowHeight = this.entries[0]?.height ?? 0;
    this.text.setY(screenHeight - MARGIN - rowHeight - ROW_GAP);
  }

  update(info: RunInfo | null, fps: number): void {
    if (!this.visible) return;
    this.showTeamPicker();
    if (!info) return;
    const speed = info.flyingSpeed === null ? '-' : info.flyingSpeed.toFixed(SPEED_DECIMALS);
    this.text.setText(
      [
        `fps ${Math.round(fps)}`,
        `seed ${info.seed}`,
        `speed ${speed}`,
        `wobble ${info.wobble.toFixed(WOBBLE_DECIMALS)}`,
        `height ${info.height}`,
        `phase ${info.phase}`,
        `team ${info.team.map((slot) => (slot ? `${slot.id}:${slot.level}` : NO_CREATURE)).join(' ')}`,
        `fx ${effectsMode.reason ?? 'full'}`,
        `berries ${gameState.berries}`,
      ].join('\n'),
    );
  }

  private showAdsMode(): void {
    this.adsEntry.setText(`ads ${adsDev.mode}`);
  }

  private change(apply: () => void): void {
    apply();
    this.showTeamPicker();
  }

  /** The entries follow the team picked for the next run; only a changed team is laid out again. */
  private showTeamPicker(): void {
    const team = getDebugTeam();
    const key = `${team.slots.join(',')}|${team.level}`;
    if (key === this.teamKey) return;
    this.teamKey = key;
    this.slotEntries.forEach((entry, i) => entry.setText(team.slots[i] ?? NO_CREATURE));
    this.levelEntry.setText(`lv ${team.level}`);
    this.relayout();
  }

  private relayout(): void {
    const bottom = this.entries[0]?.y;
    if (bottom !== undefined) this.layout(bottom + MARGIN);
  }
}
