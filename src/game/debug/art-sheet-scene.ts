import * as Phaser from 'phaser';
import { ART_SHEET, isSheetPicture } from '../../data/debug/art-sheet';
import { SCENES } from '../app/scene-keys';
import { LIVE_PICTURES } from './art-sheet-live';
import { clipSummary, clipTightLines } from '../common/clip-guard';
import { atlasPageCount } from '../ui/common/shared-atlas';
import { primeArtTextures } from './art-sheet-prime';

/**
 * Debug page `?artsheet=1` (dev build): every picture of the texture registry in a grid, each
 * with its key as a caption. The game is resized to the height of the whole sheet, so one
 * screenshot of the page is the art sheet.
 */
export class ArtSheetScene extends Phaser.Scene {
  constructor() {
    super(SCENES.artSheet);
  }

  create(): void {
    primeArtTextures(this);
    const keys = this.textures
      .getTextureKeys()
      .filter(isSheetPicture)
      .sort((a, b) => a.localeCompare(b));
    const { columns, cellWidth, cellHeight, gap, margin } = ART_SHEET;
    const width = margin * 2 + columns * cellWidth + (columns - 1) * gap;
    const rows = Math.ceil(keys.length / columns);
    const liveRows = Math.ceil(LIVE_PICTURES.length / columns);
    const gridHeight = rows * (cellHeight + gap);
    const gridBottom = margin + gridHeight + liveRows * (cellHeight + gap) - gap;
    this.cameras.main.setBackgroundColor(ART_SHEET.background);
    keys.forEach((key, i) => {
      const x = margin + (i % columns) * (cellWidth + gap);
      const y = margin + Math.floor(i / columns) * (cellHeight + gap);
      this.drawCell(key, x, y);
    });
    LIVE_PICTURES.forEach((picture, i) => {
      const x = margin + (i % columns) * (cellWidth + gap);
      const y = margin + gridHeight + Math.floor(i / columns) * (cellHeight + gap);
      this.drawLiveCell(
        picture.name,
        picture.create(this, picture.size ?? ART_SHEET.liveSize),
        x,
        y,
      );
    });
    this.showReport(width, gridBottom);
  }

  /** The clip guard report and the atlas page count, once every picture (the drawn layers too) is baked: under the grid (`gridBottom` is the bottom edge of the last cell), in the console. The game is resized here, once, to the grid and the report. */
  private showReport(width: number, gridBottom: number): void {
    const { margin, gap } = ART_SHEET;
    const report = [clipSummary(), `atlas pages: ${atlasPageCount(this.textures)}`].join('\n');
    console.log(report);
    console.log(['clip tight:', ...clipTightLines()].join('\n'));
    const reportHeight = (report.split('\n').length + 1) * ART_SHEET.reportLineHeight;
    this.scale.setGameSize(width, gridBottom + margin + reportHeight);
    this.add
      .text(margin, gridBottom + gap, report, {
        font: ART_SHEET.captionFont,
        color: ART_SHEET.reportColor,
      })
      .setOrigin(0, 0);
  }

  private drawLiveCell(
    name: string,
    picture: Phaser.GameObjects.Container,
    x: number,
    y: number,
  ): void {
    const { cellWidth, cellHeight, captionHeight } = ART_SHEET;
    this.add.rectangle(x, y, cellWidth, cellHeight, ART_SHEET.cellColor).setOrigin(0, 0);
    this.children.bringToTop(picture);
    picture.setPosition(x + cellWidth / 2, y + (cellHeight - captionHeight) / 2);
    this.add
      .text(
        x + cellWidth / 2,
        y + cellHeight - 2,
        `${name}
(drawn)`,
        {
          font: ART_SHEET.captionFont,
          color: ART_SHEET.captionColor,
          align: 'center',
        },
      )
      .setOrigin(0.5, 1);
  }

  private drawCell(key: string, x: number, y: number): void {
    const { cellWidth, cellHeight, captionHeight, maxScale } = ART_SHEET;
    this.add.rectangle(x, y, cellWidth, cellHeight, ART_SHEET.cellColor).setOrigin(0, 0);
    const frame = this.textures.getFrame(key);
    const boxH = cellHeight - captionHeight;
    const scale = Math.min(cellWidth / frame.width, boxH / frame.height, maxScale);
    this.add.image(x + cellWidth / 2, y + boxH / 2, key).setScale(scale);
    this.add
      .text(x + cellWidth / 2, y + cellHeight - 2, `${key}\n${frame.width}x${frame.height}`, {
        font: ART_SHEET.captionFont,
        color: ART_SHEET.captionColor,
        align: 'center',
        wordWrap: { width: cellWidth - 6, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 1);
  }
}
