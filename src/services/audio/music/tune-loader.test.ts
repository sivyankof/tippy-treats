import { describe, expect, it } from 'vitest';
import { carriesFile } from './tune-loader';

describe('carriesFile', () => {
  it('takes an HTTP success and the status-less answer of the app scheme for media files', () => {
    expect(carriesFile({ ok: true, status: 200, type: 'basic' })).toBe(true);
    // Capacitor on iOS answers a whole .m4a with a plain URLResponse: fetch sees status 0.
    expect(carriesFile({ ok: false, status: 0, type: 'basic' })).toBe(true);
  });

  it('refuses an HTTP error and an opaque response', () => {
    expect(carriesFile({ ok: false, status: 404, type: 'basic' })).toBe(false);
    expect(carriesFile({ ok: false, status: 0, type: 'opaque' })).toBe(false);
  });
});
