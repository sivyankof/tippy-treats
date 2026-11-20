import { describe, expect, it, vi } from 'vitest';
import { NativeRating } from './native';
import { WebRating } from './web';

describe('NativeRating', () => {
  it('asks the plugin for the system window', async () => {
    const requestReview = vi.fn(() => Promise.resolve());
    await new NativeRating({ requestReview }).requestReview();
    expect(requestReview).toHaveBeenCalledTimes(1);
  });

  it('survives a plugin that fails', async () => {
    const requestReview = vi.fn(() => Promise.reject(new Error('quota')));
    await expect(new NativeRating({ requestReview }).requestReview()).resolves.toBeUndefined();
  });

  it('survives a plugin that throws at once', async () => {
    const requestReview = vi.fn(() => {
      throw new Error('no plugin');
    });
    await expect(new NativeRating({ requestReview }).requestReview()).resolves.toBeUndefined();
  });
});

describe('WebRating', () => {
  it('writes a line where logging is on and stays silent otherwise', async () => {
    const lines: string[] = [];
    await new WebRating((line) => lines.push(line)).requestReview();
    expect(lines).toHaveLength(1);
    await expect(new WebRating(null).requestReview()).resolves.toBeUndefined();
  });
});
