import { describe, expect, it } from 'vitest';
import { headerLineCount, resultsLines, type LinesInput } from './results-lines';

const BASE: LinesInput = {
  record: null,
  started: null,
  daily: null,
  hint: null,
  missionsFrame: true,
};

describe('resultsLines', () => {
  it('puts the layers to the record under the height', () => {
    const lines = resultsLines({ ...BASE, hint: { text: 'to record', towardRecord: true } });
    expect(lines).toEqual({ header: [{ text: 'to record', tone: 'gold' }], missionHint: null });
  });

  it('puts another near miss at the bottom of the Missions frame', () => {
    const lines = resultsLines({ ...BASE, hint: { text: 'almost', towardRecord: false } });
    expect(lines).toEqual({ header: [], missionHint: 'almost' });
  });

  it('keeps "New record!" under the height and the hint in the Missions frame', () => {
    const lines = resultsLines({
      ...BASE,
      record: 'New record!',
      hint: { text: 'almost', towardRecord: false },
    });
    expect(lines.header).toEqual([{ text: 'New record!', tone: 'record' }]);
    expect(lines.missionHint).toBe('almost');
  });

  it('moves the layers to the record into the Missions frame when the start line is there', () => {
    const lines = resultsLines({
      ...BASE,
      started: 'Started at 20',
      hint: { text: 'to record', towardRecord: true },
    });
    expect(lines.header).toEqual([{ text: 'Started at 20', tone: 'plain' }]);
    expect(lines.missionHint).toBe('to record');
  });

  it('keeps the start line under a record set after a checkpoint start', () => {
    const lines = resultsLines({
      ...BASE,
      record: 'New record!',
      started: 'Started at 20',
      hint: { text: 'almost', towardRecord: false },
    });
    expect(lines.header).toEqual([
      { text: 'New record!', tone: 'record' },
      { text: 'Started at 20', tone: 'plain' },
    ]);
    expect(lines.missionHint).toBe('almost');
  });

  it('puts the daily attempt under the height and the progress of the day in the frame', () => {
    const lines = resultsLines({
      ...BASE,
      daily: 'This attempt: tier 50',
      hint: { text: '15 layers to the next reward', towardRecord: false },
    });
    expect(lines.header).toEqual([{ text: 'This attempt: tier 50', tone: 'plain' }]);
    expect(lines.missionHint).toBe('15 layers to the next reward');
  });

  it('stands the hint under the height when there is no Missions frame', () => {
    const lines = resultsLines({
      ...BASE,
      record: 'New record!',
      missionsFrame: false,
      hint: { text: 'almost', towardRecord: false },
    });
    expect(lines.header.map((l) => l.text)).toEqual(['New record!', 'almost']);
    expect(lines.missionHint).toBeNull();
  });

  it('shows no hint for a run that is not saved', () => {
    expect(resultsLines({ ...BASE, started: 'Started at 20' })).toEqual({
      header: [{ text: 'Started at 20', tone: 'plain' }],
      missionHint: null,
    });
  });
});

describe('headerLineCount', () => {
  it('counts the line breaks inside a line', () => {
    expect(headerLineCount([{ text: 'The tower changed.\nDoes not count', tone: 'plain' }])).toBe(
      2,
    );
    expect(headerLineCount([])).toBe(0);
  });
});
