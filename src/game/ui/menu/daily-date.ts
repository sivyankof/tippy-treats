import type * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { getLang, t } from '../../../i18n';
import { createOutlinedText } from '../outlined-text';
import { faceOffsetY, VolumePlate } from '../style/volume';
import { fitText } from './fit-text';
import type { DailySection } from './daily-section';
import { formatTimeLeft } from './time-text';

const cfg = MENU.daily.date;

/** The UTC day `YYYY-MM-DD` as a short date of the current language ("14 November"). */
export function formatDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat(getLang(), {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(date);
}

/** The plate under the header: the date of the tower and the time to the next one. */
export class DailyDate implements DailySection {
  readonly root: Phaser.GameObjects.Container;
  readonly height = cfg.height;
  private readonly timer: Phaser.GameObjects.Text;
  private shown = '';

  constructor(scene: Phaser.Scene, day: string) {
    const plate = new VolumePlate(scene, 'card', cfg.height, { fill: cfg.fill })
      .setBodyWidth(cfg.width)
      .setY(cfg.height / 2);
    const lift = faceOffsetY('card');
    const date = fitText(
      createOutlinedText(
        scene,
        0,
        cfg.dateY + lift,
        t('daily.date', { date: formatDay(day) }),
        cfg.font,
      ),
      cfg.width - cfg.font * 2,
    );
    this.timer = createOutlinedText(scene, 0, cfg.timerY + lift, '', cfg.timerFont, cfg.timerColor);
    this.root = scene.add.container(0, 0, [plate, date, this.timer]);
  }

  /** Shows the time to the next tower; the text is rebuilt only when it changes. */
  update(msLeft: number): void {
    const text = t('daily.nextIn', { time: formatTimeLeft(msLeft) });
    if (text === this.shown) return;
    this.shown = text;
    this.timer.setText(text);
    fitText(this.timer, cfg.width - cfg.timerFont * 2);
  }
}
