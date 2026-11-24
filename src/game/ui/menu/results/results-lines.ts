/** How a line under the height looks: the pink of a record, the gold of a goal, plain white. */
export type LineTone = 'record' | 'gold' | 'plain';

export interface ResultsLine {
  text: string;
  tone: LineTone;
}

/** What decides the lines of the results, texts already made. */
export interface LinesInput {
  /** "New record!" when the run set one. */
  record: string | null;
  /** "Started at layer N · placed M" after a checkpoint start. */
  started: string | null;
  /** The daily attempt ("This attempt: tier N"), or "the tower changed" for a stale attempt. */
  daily: string | null;
  /**
   * The "so close" line: the near miss of a classic run or the progress of the day of a daily
   * one; `towardRecord` when it counts the layers to the record. Null for a run that is not saved.
   */
  hint: { text: string; towardRecord: boolean } | null;
  /** The Missions frame shows (the run moved a mission). */
  missionsFrame: boolean;
}

export interface ResultsLines {
  /** Lines under the height, top to bottom. */
  header: ResultsLine[];
  /** The hint line at the bottom of the Missions frame. */
  missionHint: string | null;
}

/**
 * Where the lines of the results go (docs/07-ui-screens.md, section 6). Under the height stands
 * one line by priority: the record, the checkpoint start, the daily attempt, or the layers to the
 * record. The "so close" line goes to the bottom of the Missions frame; without that frame it
 * stands under the height too.
 */
export function resultsLines(input: LinesInput): ResultsLines {
  const header: ResultsLine[] = [];
  if (input.record) header.push({ text: input.record, tone: 'record' });
  else if (input.started) header.push({ text: input.started, tone: 'plain' });
  else if (input.daily) header.push({ text: input.daily, tone: 'plain' });
  const { hint } = input;
  if (!hint) return { header, missionHint: null };
  if (hint.towardRecord && header.length === 0) {
    return { header: [{ text: hint.text, tone: 'gold' }], missionHint: null };
  }
  if (input.missionsFrame) return { header, missionHint: hint.text };
  return { header: [...header, { text: hint.text, tone: 'gold' }], missionHint: null };
}

/** Text lines the header lines take (a line may hold a line break). */
export function headerLineCount(lines: readonly ResultsLine[]): number {
  return lines.reduce((sum, line) => sum + line.text.split('\n').length, 0);
}
