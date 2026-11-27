import { BOARD_MAX, type BoardId } from '../../data/games/boards';
import type { Save } from '../save/schema';

/** One score for a Game Center leaderboard. */
export interface BoardScore {
  board: BoardId;
  value: number;
}

/** The part of the save the leaderboards read. */
export type BoardSource = Pick<Save, 'stats' | 'records' | 'daily'>;

/** A score the board accepts: a whole number above 0 and not above the board's limit. */
export function isFairScore(board: BoardId, value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= BOARD_MAX[board].max;
}

/**
 * The scores of the save for the leaderboards (docs/04-meta-retention.md, section 13): the best
 * Classic height once a run reached the save, and the best height of the daily tower only while
 * its day is `utcToday` (yesterday's tower never goes into today's board). Scores above the
 * board's limit are left out.
 */
export function boardScores(save: BoardSource, utcToday: string): BoardScore[] {
  const out: BoardScore[] = [];
  const classic = save.records.classicHeight;
  if (save.stats.runs > 0 && isFairScore('classic_height', classic))
    out.push({ board: 'classic_height', value: classic });
  const daily = save.daily.best;
  if (save.daily.day === utcToday && isFairScore('daily_height', daily))
    out.push({ board: 'daily_height', value: daily });
  return out;
}

/**
 * The scores worth sending: those better than what was sent before (`sent`, by a key of the board
 * and, for the daily board, its day; missing means nothing yet). A board keeps the best score
 * anyway, so this only saves calls.
 */
export function newScores(
  scores: readonly BoardScore[],
  sent: ReadonlyMap<string, number>,
  utcToday: string,
): BoardScore[] {
  return scores.filter((s) => s.value > (sent.get(sentKey(s.board, utcToday)) ?? 0));
}

/** The key under which a sent score is remembered: the daily board starts over every UTC day. */
export function sentKey(board: BoardId, utcToday: string): string {
  return board === 'daily_height' ? `${board}:${utcToday}` : board;
}
