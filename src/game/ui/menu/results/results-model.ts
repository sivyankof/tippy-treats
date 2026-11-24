import { MENU } from '../../../../data/common/menu-layout';

const cfg = MENU.results;
const TAB_RISE = MENU.style.frame.tab.height / 2;
/** The window plate's outline and bevel along the bottom: rows never stand on them. */
const FRAME_FLOOR = MENU.style.looks.window.bevel + MENU.style.looks.window.outline;

/** Inner width of a frame: the room its rows have. */
export const FRAME_INNER = cfg.frames.width - cfg.frames.padX * 2;

/** Width of the XP bar in the level row (with or without the "x2" button beside it). */
export function levelBarWidth(withButton: boolean): number {
  const room = FRAME_INNER - cfg.levelRow.labelRoom;
  return withButton ? room - cfg.adButton.width - cfg.levelRow.gap : room;
}

/** What the results of one run show, as far as the heights go. */
export interface ResultsContent {
  /** The dev-only "not saved" plate over the frames. */
  debugPlate: boolean;
  /** The run reached the save: the XP tile and the level row show. */
  recorded: boolean;
  /** The XP fill reaches a level: the status line says "New level!". */
  levelUp: boolean;
  /** The run emptied the oven: the status line may say "The fresh oven lights up again tomorrow!". */
  ovenOut: boolean;
  /** Rows of daily tier rewards and the new-lap line. */
  tierRows: number;
  /** Missions the run moved (0: no Missions frame). */
  missions: number;
  /** The hint line at the bottom of the Missions frame. */
  missionHint: boolean;
  /** Lines under the height. */
  headerLines: number;
}

/** What a short screen may fold: the oven line, the Team frame into a row, the missions into one row. */
export type ResultsFold = 'ovenLine' | 'teamRow' | 'missions';

export type RowKind =
  'tiles' | 'level' | 'status' | 'tier' | 'teamRow' | 'team' | 'mission' | 'hint';
export type FrameKind = 'rewards' | 'team' | 'missions';

export interface PlannedRow {
  kind: RowKind;
  /** Centre of the row from the centre of its frame. */
  y: number;
  height: number;
}

export interface PlannedFrame {
  kind: FrameKind;
  /** Centre of the frame body from the top of the panel (unscaled). */
  y: number;
  height: number;
  rows: PlannedRow[];
}

/** The frames of the results and how they fit. */
export interface ResultsPlan {
  folds: ReadonlySet<ResultsFold>;
  /** Share of the padding and gaps that survives. */
  share: number;
  /** Uniform scale of the frames (and the dev plate). */
  scale: number;
  /** Centre of the dev plate from the top of the panel (unscaled); null without one. */
  debugY: number | null;
  frames: PlannedFrame[];
  /** Height of the panel, unscaled: from the top of the first tab to the bottom of the last frame. */
  height: number;
}

/** The status line shows: a level is reached, or the oven ran out and its line is not folded away. */
export function hasStatusLine(content: ResultsContent, folds: ReadonlySet<ResultsFold>): boolean {
  return content.recorded && (content.levelUp || (content.ovenOut && !folds.has('ovenLine')));
}

function rowsOf(
  kind: FrameKind,
  content: ResultsContent,
  folds: ReadonlySet<ResultsFold>,
): Array<{ kind: RowKind; height: number }> {
  const rows: Array<{ kind: RowKind; height: number }> = [];
  if (kind === 'rewards') {
    rows.push({ kind: 'tiles', height: cfg.tiles.height });
    if (content.recorded) rows.push({ kind: 'level', height: cfg.levelRow.height });
    if (hasStatusLine(content, folds)) rows.push({ kind: 'status', height: cfg.statusHeight });
    for (let i = 0; i < content.tierRows; i++) {
      rows.push({ kind: 'tier', height: cfg.tiers.rowHeight });
    }
    if (folds.has('teamRow')) rows.push({ kind: 'teamRow', height: cfg.team.row.height });
  } else if (kind === 'team') {
    rows.push({ kind: 'team', height: cfg.team.height });
  } else {
    const count = folds.has('missions') ? 1 : content.missions;
    for (let i = 0; i < count; i++) rows.push({ kind: 'mission', height: cfg.missions.rowHeight });
    if (content.missionHint) rows.push({ kind: 'hint', height: cfg.missions.hintHeight });
  }
  return rows;
}

/** The frames the results show, top to bottom. */
function frameKinds(content: ResultsContent, folds: ReadonlySet<ResultsFold>): FrameKind[] {
  const kinds: FrameKind[] = ['rewards'];
  if (!folds.has('teamRow')) kinds.push('team');
  if (content.missions > 0) kinds.push('missions');
  return kinds;
}

/** Rows of a frame laid out top to bottom at `share` of the spacing; returns the frame height. */
function layFrame(
  kind: FrameKind,
  content: ResultsContent,
  folds: ReadonlySet<ResultsFold>,
  share: number,
): { height: number; rows: PlannedRow[] } {
  const f = cfg.frames;
  // Missions rows stand closer together than the rows of the other frames.
  const rowGap = (kind === 'missions' ? cfg.missions.rowGap : f.rowGap) * share;
  const list = rowsOf(kind, content, folds);
  const top = TAB_RISE + f.padTop * share;
  const inner = list.reduce((sum, r) => sum + r.height, 0) + rowGap * Math.max(0, list.length - 1);
  const height = top + inner + FRAME_FLOOR + f.padBottom * share;
  let y = -height / 2 + top;
  const rows = list.map((r) => {
    const row = { kind: r.kind, y: y + r.height / 2, height: r.height };
    y += r.height + rowGap;
    return row;
  });
  return { height, rows };
}

/** Lays the dev plate and the frames out at `share` of the spacing (unscaled). */
export function layResults(
  content: ResultsContent,
  folds: ReadonlySet<ResultsFold>,
  share: number,
): Omit<ResultsPlan, 'scale' | 'share' | 'folds'> {
  const gap = cfg.frames.gap * share;
  let y = 0;
  let debugY: number | null = null;
  if (content.debugPlate) {
    debugY = cfg.debugPlate.height / 2;
    y = cfg.debugPlate.height + gap;
  }
  const frames = frameKinds(content, folds).map((kind) => {
    const laid = layFrame(kind, content, folds, share);
    // The tab rises above the body: the frame body starts that far below `y`.
    const frame = { kind, y: y + TAB_RISE + laid.height / 2, height: laid.height, rows: laid.rows };
    y += TAB_RISE + laid.height + gap;
    return frame;
  });
  return { debugY, frames, height: Math.max(0, y - gap) };
}

/** Height of the header for `lines` lines under the height. */
export function headerHeight(lines: number, compact: boolean): number {
  const h = cfg.header;
  const look = compact ? h.compact : h;
  const ribbon = MENU.style.ribbon.height * (compact ? h.compact.ribbonScale : 1);
  const rows = [ribbon, look.heightFont * cfg.lineHeight];
  for (let i = 0; i < lines; i++) rows.push(look.lineFont * cfg.lineHeight);
  return rows.reduce((sum, r) => sum + r, 0) + cfg.rowGap * (rows.length - 1);
}

/** The header is compact on a safe frame shorter than `header.compactBelow`. */
export function isCompactHeader(frameHeight: number): boolean {
  return frameHeight < cfg.header.compactBelow;
}

/** The step of the fit could change something for this content. */
function applies(step: (typeof cfg.fit.steps)[number], content: ResultsContent): boolean {
  switch (step) {
    case 'ovenLine':
      return content.recorded && content.ovenOut && !content.levelUp;
    case 'teamRow':
      return true;
    case 'missions':
      return content.missions > 1;
    default:
      return true;
  }
}

/**
 * Chooses how the frames fit into `room` (the height left under the header, above the buttons):
 * the steps of `MENU.results.fit` are taken in order until the frames fit; after the last one the
 * scale may go on down to `floorScale`. Nothing changes when everything fits.
 */
export function planResults(content: ResultsContent, room: number): ResultsPlan {
  const fit = cfg.fit;
  const folds = new Set<ResultsFold>();
  let minShare = 1;
  let minScale = 1;
  const attempt = (): { share: number; scale: number; fits: boolean } => {
    const full = layResults(content, folds, 1).height;
    const bare = layResults(content, folds, 0).height;
    const spacing = full - bare;
    const share = spacing <= 0 ? 1 : Math.max(minShare, Math.min(1, (room - bare) / spacing));
    const height = bare + spacing * share;
    const scale = height <= room ? 1 : Math.max(minScale, room / height);
    return { share, scale, fits: height * scale <= room + 0.5 };
  };
  let result = attempt();
  for (const step of fit.steps) {
    if (result.fits) break;
    if (!applies(step, content)) continue;
    if (step === 'spacing') minShare = fit.minShare;
    else if (step === 'scale') minScale = fit.minScale;
    else folds.add(step);
    result = attempt();
  }
  if (!result.fits) {
    minShare = fit.minShare;
    minScale = fit.floorScale;
    result = attempt();
  }
  const laid = layResults(content, folds, result.share);
  return { folds, share: result.share, scale: result.scale, ...laid };
}

/** Where the header, the panel and the buttons stand, by their centres. */
export interface ResultsPlaces {
  headerY: number;
  panelTop: number;
  buttonsY: number;
}

/**
 * The buttons stand at the bottom; the header and the panel above them share the free room
 * evenly, never closer than `sectionGap` to each other or to the buttons.
 */
export function placeResults(
  frameHeight: number,
  header: number,
  panel: number,
  buttons: number,
): ResultsPlaces {
  const buttonsY = frameHeight - cfg.buttonsBottom - buttons / 2;
  const bottom = buttonsY - buttons / 2;
  const free = bottom - cfg.top - header - panel;
  let gap = free / 3;
  let top = cfg.top + gap;
  if (gap < cfg.sectionGap) {
    // The air under the panel is kept first; what is left goes above the header.
    gap = cfg.sectionGap;
    top = cfg.top + Math.max(0, free - cfg.sectionGap * 2);
  }
  return { headerY: top + header / 2, panelTop: top + header + gap, buttonsY };
}

/** Height left for the panel under the header and above the buttons, with the air between. */
export function panelRoom(frameHeight: number, header: number, buttons: number): number {
  return frameHeight - cfg.buttonsBottom - buttons - cfg.top - header - cfg.sectionGap * 3;
}
