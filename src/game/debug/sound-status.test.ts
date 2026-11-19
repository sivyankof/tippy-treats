import { describe, expect, it } from 'vitest';
import { soundReport } from './sound-status';

describe('soundReport', () => {
  it('puts the status, an empty line and the log lines in order', () => {
    expect(soundReport('up 5 s', ['1.00 a', '2.00 b'])).toBe('up 5 s\n\n1.00 a\n2.00 b');
  });

  it('keeps the status and the empty line when the log is empty', () => {
    expect(soundReport('up 5 s', [])).toBe('up 5 s\n');
  });
});
