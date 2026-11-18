import { describe, expect, it } from 'vitest';
import { isAppleTouch } from './browser-info';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';

describe('isAppleTouch', () => {
  it('knows iPhones and touch iPads, not Macs or Android', () => {
    expect(isAppleTouch({ userAgent: IPHONE })).toBe(true);
    expect(isAppleTouch({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
    expect(isAppleTouch({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
    expect(isAppleTouch({ userAgent: ANDROID })).toBe(false);
    expect(isAppleTouch({})).toBe(false);
  });
});
