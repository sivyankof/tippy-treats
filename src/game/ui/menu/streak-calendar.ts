import type * as Phaser from 'phaser';
import type { Cost } from '../../../core/economy';
import { STREAK, type StreakReward } from '../../../data/streak';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { t, tn } from '../../../i18n';
import { services } from '../../../services';
import { gameState } from '../../../state';
import type { StreakClaim } from '../../../state/game-state';
import { createTextButton, type Button } from '../button';
import { createOutlinedText } from '../outlined-text';
import { PopupWindow } from '../style/popup-window';
import { fitText } from './fit-text';
import { FlameIcon } from './flame-icon';
import { flyReward, type WalletTargets } from './reward-flight';
import { StreakCell } from './streak-cell';

const cfg = MENU.streak;

/** Called when the calendar is gone; `claim` is what was paid, null when nothing was claimed. */
export type StreakClosed = (claim: StreakClaim | null) => void;

/** Rows of the calendar: days 1-4, then days 5 and 6 and day 7 across the last two columns. */
function cellSpot(position: number, step: number): { x: number; y: number; span: number } {
  const wide = position === STREAK.cycleLength;
  const row = position <= cfg.columns ? 0 : 1;
  const column = (position - 1) % cfg.columns;
  const x = wide ? step : (column - (cfg.columns - 1) / 2) * step;
  return { x, y: row * (cfg.cellHeight + cfg.cellGap) + cfg.cellHeight / 2, span: wide ? 2 : 1 };
}

/** What a claim paid in coins and berries (a duplicate creature is paid as its compensation). */
function paidCost(reward: StreakReward, duplicate: Cost | null): Cost | null {
  if (duplicate) return duplicate;
  if (reward.kind === 'coins') return { coins: reward.amount };
  if (reward.kind === 'berries') return { berries: reward.amount };
  return null;
}

/** The streak calendar: seven reward cells, today's pulses; the button pays it into the wallet. */
export function openStreakCalendar(
  scene: Phaser.Scene,
  onClosed?: StreakClosed,
  wallet?: WalletTargets,
): void {
  let claimed: StreakClaim | null = null;
  const popup = new PopupWindow(scene, {
    title: t('streak.title'),
    onClosed: () => onClosed?.(claimed),
  });
  const canClaim = gameState.streakEntry().kind === 'claim';
  const columnWidth = (popup.innerWidth - cfg.cellGap * (cfg.columns - 1)) / cfg.columns;
  const step = columnWidth + cfg.cellGap;
  const cells = gameState.calendar().map((cell) => {
    const spot = cellSpot(cell.position, step);
    const width = columnWidth * spot.span + cfg.cellGap * (spot.span - 1);
    const view = new StreakCell(scene, spot.x, spot.y, width, cell);
    popup.content.add(view);
    return view;
  });
  const gridHeight = cfg.cellHeight * 2 + cfg.cellGap;

  const { count, best } = gameState.data.streak;
  const flame = new FlameIcon(scene, 0, 0, cfg.infoFlame);
  const info = fitText(
    createOutlinedText(
      scene,
      0,
      0,
      `${tn('home.streakDays', count)}   ${t('streak.best', { n: best })}`,
      cfg.infoFont,
    ),
    popup.innerWidth - cfg.infoMargin,
  );
  const infoWidth = flame.width + info.width * info.scaleX;
  const infoY = gridHeight + cfg.infoGap + cfg.infoFont;
  flame.setPosition(-infoWidth / 2, infoY);
  info.setPosition(cfg.infoShift, infoY);
  popup.content.add([flame, info]);
  let height = infoY + cfg.infoFont;

  if (canClaim) {
    const { width, height: h, radius, shadowOffset, font } = cfg.button;
    const buttonY = height + cfg.buttonGap + h / 2;
    const { button } = createTextButton(scene, {
      text: t('streak.claim'),
      font,
      maxLabelWidth: width - radius * 2,
      fill: PALETTE.accent,
      layout: { width, height: h, radius, shadowOffset },
      keyPrefix: 'ui_streak_claim',
      x: 0,
      y: buttonY,
      onClick: () => claim(button),
    });
    button.breathe(false);
    popup.content.add(button);
    height = buttonY + h / 2;
  }
  popup.setContentHeight(height);

  const claim = (button: Button): void => {
    const today = cells.find((view) => view.cell.state === 'today');
    const result = gameState.claimStreak();
    if (!result || !today) return;
    button.setEnabled(false);
    claimed = result;
    today.markDone(true);
    services.audio.coin();
    services.haptics.play('success');
    const from = today.screenPoint;
    const paid = paidCost(result.reward, result.duplicate);
    if (paid?.coins) flyReward(scene, { currency: 'coins', amount: paid.coins, from, wallet });
    if (paid?.berries)
      flyReward(scene, { currency: 'berries', amount: paid.berries, from, wallet });
    scene.tweens.add({ targets: button, alpha: 0, duration: cfg.todayPulse.ms });
    scene.time.delayedCall(cfg.closeDelayMs, popup.close);
  };
}
