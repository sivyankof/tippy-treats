import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebAppShell } from './web';

describe('WebAppShell', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('opens an outside address in a new tab', () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    new WebAppShell().openExternal('https://example.org/');
    expect(open).toHaveBeenCalledWith('https://example.org/', '_blank', 'noopener');
  });
});
