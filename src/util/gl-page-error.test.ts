import { describe, expect, it } from 'vitest';
import {
  bigPageFails,
  GL_CONTEXT_LOST_WEBGL,
  GL_INVALID_ENUM,
  GL_INVALID_OPERATION,
  GL_INVALID_VALUE,
  GL_OUT_OF_MEMORY,
} from './gl-page-error';

const WINDOW = 5000;
const made = (errors: number[], contextLost = false): boolean =>
  bigPageFails({ kind: 'made', errors, contextLost }, WINDOW);
const lost = (msSinceBigPage: number | null): boolean =>
  bigPageFails({ kind: 'context_lost', msSinceBigPage }, WINDOW);

describe('bigPageFails', () => {
  it('keeps a page made with no error', () => {
    expect(made([])).toBe(false);
  });

  it('falls back on any GL error after the page was made', () => {
    expect(made([GL_OUT_OF_MEMORY])).toBe(true);
    expect(made([GL_INVALID_VALUE])).toBe(true);
    expect(made([GL_INVALID_OPERATION])).toBe(true);
    expect(made([GL_INVALID_ENUM])).toBe(true);
  });

  it('falls back when the context was lost while the page was made', () => {
    expect(made([], true)).toBe(true);
    expect(made([GL_CONTEXT_LOST_WEBGL])).toBe(true);
  });

  it('falls back when the context is lost just after the page was made', () => {
    expect(lost(0)).toBe(true);
    expect(lost(WINDOW)).toBe(true);
  });

  it('keeps the big page through a later, unrelated loss', () => {
    expect(lost(WINDOW + 1)).toBe(false);
    expect(lost(null)).toBe(false);
  });
});
