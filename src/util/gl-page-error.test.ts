import { describe, expect, it } from 'vitest';
import {
  GL_CONTEXT_LOST_WEBGL,
  GL_INVALID_VALUE,
  GL_OUT_OF_MEMORY,
  pageVerdict,
} from './gl-page-error';

describe('pageVerdict', () => {
  it('accepts a page with no errors', () => {
    expect(pageVerdict([], false)).toBe('ok');
  });

  it('falls back only on a real allocation error', () => {
    expect(pageVerdict([GL_OUT_OF_MEMORY], false)).toBe('too_big');
    expect(pageVerdict([GL_INVALID_VALUE], false)).toBe('too_big');
  });

  it('does not blame the page for a lost context', () => {
    expect(pageVerdict([GL_CONTEXT_LOST_WEBGL], false)).toBe('lost');
    expect(pageVerdict([], true)).toBe('lost');
    expect(pageVerdict([GL_OUT_OF_MEMORY], true)).toBe('lost');
  });

  it('ignores errors that are not about allocation', () => {
    expect(pageVerdict([0x0502], false)).toBe('ok');
  });
});
