import { describe, expect, it } from 'vitest';
import { SessionRecord } from './session-record';

describe('SessionRecord', () => {
  it('never counts the first run as a record', () => {
    expect(new SessionRecord().noteRun(50)).toBe(false);
  });

  it('is a record only when it beats the best so far', () => {
    const rec = new SessionRecord();
    rec.noteRun(10);
    expect(rec.noteRun(11)).toBe(true);
    expect(rec.noteRun(11)).toBe(false);
    expect(rec.noteRun(5)).toBe(false);
    expect(rec.noteRun(12)).toBe(true);
  });

  it('keeps a zero-height first run as the baseline', () => {
    const rec = new SessionRecord();
    rec.noteRun(0);
    expect(rec.noteRun(1)).toBe(true);
  });

  it('exposes the best height', () => {
    const rec = new SessionRecord();
    expect(rec.best).toBeNull();
    rec.noteRun(7);
    rec.noteRun(3);
    expect(rec.best).toBe(7);
  });
});
