import { describe, expect, it } from 'vitest';
import { LOGICAL_SIZE } from '../../../../data/app/screen';
import { MENU } from '../../../../data/common/menu-layout';
import { computeLogicalSize } from '../../../../util/logical-size';
import {
  headerHeight,
  levelBarWidth,
  isCompactHeader,
  panelRoom,
  placeResults,
  planResults,
  type ResultsContent,
  type ResultsPlan,
} from './results-model';

const cfg = MENU.results;
const TAB_RISE = MENU.style.frame.tab.height / 2;

/** Height of the bottom buttons as `ResultsButtons` stacks them. */
function buttonsHeight(kind: 'choose' | 'again' | 'plain'): number {
  const { playButton, pairButton, startFrom, buttonGap } = cfg;
  const extra = kind === 'choose' ? startFrom.height : kind === 'again' ? pairButton.height : 0;
  return playButton.height + (extra > 0 ? buttonGap + extra : 0) + buttonGap + pairButton.height;
}

/** The safe frame of a viewport in logical units (no insets: the browser shots). */
function frameOf(width: number, height: number, insets = { top: 0, bottom: 0 }): number {
  const size = computeLogicalSize(width, height, LOGICAL_SIZE, insets);
  return size.height - size.safeTop - size.safeBottom;
}

const NORMAL: ResultsContent = {
  debugPlate: false,
  recorded: true,
  levelUp: false,
  ovenOut: true,
  tierRows: 0,
  missions: 3,
  missionHint: false,
  headerLines: 1,
};

interface Case {
  name: string;
  content: ResultsContent;
  buttons: number;
}

/** The English texts take the same rows: a case of its own only for the record (hint in the frame). */
const CASES: Case[] = [
  { name: 'a normal run', content: NORMAL, buttons: buttonsHeight('choose') },
  {
    name: 'a record with a new level and three missions',
    content: { ...NORMAL, levelUp: true, missionHint: true },
    buttons: buttonsHeight('choose'),
  },
  {
    name: 'the daily tower with a record and a new level',
    content: { ...NORMAL, levelUp: true, tierRows: 2, missionHint: true },
    buttons: buttonsHeight('plain'),
  },
  {
    name: 'a checkpoint start with a new lap',
    content: { ...NORMAL, tierRows: 1, missionHint: true },
    buttons: buttonsHeight('again'),
  },
  {
    name: 'a run without the x2 button',
    content: { ...NORMAL, ovenOut: false },
    buttons: buttonsHeight('choose'),
  },
  {
    name: 'an English record (the hint line in the Missions frame)',
    content: { ...NORMAL, missionHint: true },
    buttons: buttonsHeight('choose'),
  },
  {
    name: 'a dev run that is not saved',
    content: { ...NORMAL, debugPlate: true, recorded: false, ovenOut: false },
    buttons: buttonsHeight('plain'),
  },
];

const SCREENS: Array<{ name: string; frame: number }> = [
  { name: '390x693', frame: frameOf(390, 693) },
  { name: '390x844', frame: frameOf(390, 844) },
  { name: '375x667', frame: frameOf(375, 667) },
  { name: '820x1180', frame: frameOf(820, 1180) },
  { name: '390x844 with the island', frame: frameOf(390, 844, { top: 47, bottom: 34 }) },
];

function layout(
  c: Case,
  frame: number,
): { plan: ResultsPlan; header: number; places: ReturnType<typeof placeResults> } {
  const header = headerHeight(c.content.headerLines, isCompactHeader(frame));
  const plan = planResults(c.content, panelRoom(frame, header, c.buttons));
  const places = placeResults(frame, header, plan.height * plan.scale, c.buttons);
  return { plan, header, places };
}

describe('results layout', () => {
  for (const screen of SCREENS) {
    for (const c of CASES) {
      it(`fits ${c.name} on ${screen.name}`, () => {
        const { plan, header, places } = layout(c, screen.frame);
        const buttonsTop = places.buttonsY - c.buttons / 2;
        const panelBottom = places.panelTop + plan.height * plan.scale;
        // Nothing overlaps: header, frames, buttons, with the air of the data before "Play again".
        expect(places.headerY - header / 2).toBeGreaterThanOrEqual(cfg.top - 0.5);
        expect(places.headerY + header / 2 + cfg.sectionGap).toBeLessThanOrEqual(
          places.panelTop + 0.5,
        );
        expect(panelBottom + cfg.sectionGap).toBeLessThanOrEqual(buttonsTop + 0.5);
        plan.frames.forEach((frame, i) => {
          // The frames do not overlap each other (a tab rises above its frame).
          const next = plan.frames[i + 1];
          if (next) {
            expect(frame.y + frame.height / 2).toBeLessThanOrEqual(
              next.y - next.height / 2 - TAB_RISE + 0.01,
            );
          }
          // Rows stay inside their frame, under the tab, and do not overlap.
          let bottom = -frame.height / 2 + TAB_RISE;
          for (const row of frame.rows) {
            expect(row.y - row.height / 2).toBeGreaterThanOrEqual(bottom - 0.01);
            bottom = row.y + row.height / 2;
          }
          expect(bottom).toBeLessThanOrEqual(frame.height / 2 + 0.01);
        });
        // The frames are never shrunk below the readable minimum on the screens we support.
        expect(plan.scale).toBeGreaterThanOrEqual(cfg.fit.minScale);
      });
    }
  }

  it('changes nothing on a tall screen', () => {
    const { plan } = layout(CASES[0] as Case, frameOf(390, 844));
    expect(plan.folds.size).toBe(0);
    expect(plan.share).toBe(1);
    expect(plan.scale).toBe(1);
  });

  it('hides the oven line first, then folds the team into a row', () => {
    const full = planResults(NORMAL, 5000).height;
    const withoutOven = planResults(NORMAL, full - 1);
    expect([...withoutOven.folds]).toEqual(['ovenLine']);
    const folded = planResults(NORMAL, withoutOven.height - 1);
    expect([...folded.folds]).toEqual(['ovenLine', 'teamRow']);
    expect(folded.frames.map((f) => f.kind)).toEqual(['rewards', 'missions']);
    expect(folded.frames[0]?.rows.map((r) => r.kind)).toContain('teamRow');
    expect(folded.share).toBe(1);
  });

  it('keeps "New level!" when the oven line has to go', () => {
    const plan = planResults({ ...NORMAL, levelUp: true }, 600);
    expect(plan.frames[0]?.rows.map((r) => r.kind)).toContain('status');
  });

  it('shrinks the spacing, then scales, and folds the missions only after that', () => {
    const content = { ...NORMAL, missionHint: true };
    // Room just short of the frames with the oven line hidden and the team in a row.
    const folded = planResults(content, 5000);
    const roomy = planResults(content, folded.height - 1);
    const both = planResults(content, roomy.height - 1);
    const noSpare = planResults(content, both.height - 40);
    expect(noSpare.folds.has('missions')).toBe(false);
    expect(noSpare.share).toBeLessThan(1);
    const tight = planResults(content, 450);
    expect(tight.folds.has('missions')).toBe(true);
    expect(tight.share).toBe(cfg.fit.minShare);
    expect(tight.frames.at(-1)?.rows.filter((r) => r.kind === 'mission')).toHaveLength(1);
  });

  it('never scales below the floor', () => {
    expect(planResults(NORMAL, 50).scale).toBe(cfg.fit.floorScale);
  });

  it('keeps the minimum air above the buttons when the room runs out', () => {
    // 40 of free room: less than three gaps of 16, so the air above the header gives way first.
    const places = placeResults(1000, 200, 250, 300);
    expect(places.panelTop + 250 + cfg.sectionGap).toBeLessThanOrEqual(places.buttonsY - 150 + 0.5);
    expect(places.headerY - 100 + 0.5).toBeGreaterThanOrEqual(cfg.top);
  });

  it('gives the bar the whole row when there is no x2 button', () => {
    const inner = cfg.frames.width - cfg.frames.padX * 2;
    expect(levelBarWidth(false)).toBe(inner - cfg.levelRow.labelRoom);
    expect(levelBarWidth(true)).toBe(
      inner - cfg.levelRow.labelRoom - cfg.adButton.width - cfg.levelRow.gap,
    );
  });
});
