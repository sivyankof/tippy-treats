import { describe, expect, it, vi } from 'vitest';
import type { ShareRequest } from './types';
import { WebShare, type ShareNavigator } from './web';

const request: ShareRequest = {
  image: new Blob(['png'], { type: 'image/png' }),
  fileName: 'tower.png',
  text: 'My tower',
  title: 'Tippy Treats',
};

describe('WebShare', () => {
  it('shares the picture as a file when the browser can', async () => {
    const share = vi.fn(() => Promise.resolve());
    const nav: ShareNavigator = { share, canShare: () => true };
    const download = vi.fn();
    expect(await new WebShare(nav, download).shareImage(request)).toBe('shared');
    expect(share).toHaveBeenCalledOnce();
    const [data] = share.mock.calls[0] as unknown as [ShareData];
    expect(data.files?.[0]?.name).toBe('tower.png');
    expect(data.text).toBe('My tower');
    expect(download).not.toHaveBeenCalled();
  });

  it('downloads when the browser has no Web Share', async () => {
    const download = vi.fn();
    expect(await new WebShare({}, download).shareImage(request)).toBe('downloaded');
    expect(download).toHaveBeenCalledWith(request.image, 'tower.png');
  });

  it('downloads when the browser cannot share files', async () => {
    const share = vi.fn(() => Promise.resolve());
    const download = vi.fn();
    const nav: ShareNavigator = { share, canShare: () => false };
    expect(await new WebShare(nav, download).shareImage(request)).toBe('downloaded');
    expect(share).not.toHaveBeenCalled();
  });

  it('reports a closed sheet as cancelled and does not download', async () => {
    const nav: ShareNavigator = {
      share: () => Promise.reject(new DOMException('closed', 'AbortError')),
      canShare: () => true,
    };
    const download = vi.fn();
    expect(await new WebShare(nav, download).shareImage(request)).toBe('cancelled');
    expect(download).not.toHaveBeenCalled();
  });

  it('falls back to the download when the share breaks', async () => {
    const nav: ShareNavigator = {
      share: () => Promise.reject(new Error('boom')),
      canShare: () => true,
    };
    const download = vi.fn();
    expect(await new WebShare(nav, download).shareImage(request)).toBe('downloaded');
  });

  it('fails when even the download throws', async () => {
    const download = vi.fn(() => {
      throw new Error('no dom');
    });
    expect(await new WebShare({}, download).shareImage(request)).toBe('failed');
  });
});
