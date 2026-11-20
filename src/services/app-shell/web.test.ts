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

  it('opens a mail address in place, not in a blank tab', () => {
    const open = vi.fn();
    const assign = vi.fn();
    vi.stubGlobal('open', open);
    vi.stubGlobal('location', { assign });
    new WebAppShell().openExternal('mailto:help@example.org');
    expect(assign).toHaveBeenCalledWith('mailto:help@example.org');
    expect(open).not.toHaveBeenCalled();
  });

  it('reads the device from the user agent and has no build number', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) Mobile/15E148',
    });
    const shell = new WebAppShell();
    expect(await shell.deviceInfo()).toEqual({ model: 'iPhone', os: 'iOS 18.1' });
    expect(await shell.appBuild()).toBeNull();
  });
});
