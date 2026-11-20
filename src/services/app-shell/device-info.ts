import type { DeviceInfo } from './types';

/** What the page cannot tell about the device. */
const UNKNOWN = 'unknown';

/** `18_1` or `18.1.2` as `18.1` or `18.1.2`. */
const dotted = (version: string): string => version.replace(/_/g, '.');

/**
 * The device model and system version from a user agent string, as well as a page can tell:
 * "iPhone / iOS 18.1", "Pixel 7 / Android 15". An unknown agent gives `unknown`. Used by the
 * browser build and as the fallback of the app when its own plugin fails.
 */
export function parseUserAgent(userAgent: string): DeviceInfo {
  const ios = /\b(iPhone|iPad|iPod)\b.*?\bOS (\d+(?:_\d+)*)/.exec(userAgent);
  if (ios) return { model: ios[1] ?? UNKNOWN, os: `iOS ${dotted(ios[2] ?? '')}` };

  const android = /Android (\d+(?:\.\d+)*)(?:;\s*([^;)]+?))?(?:\s+Build\/[^;)]*)?[;)]/.exec(
    userAgent,
  );
  if (android) {
    const model = android[2]?.trim();
    return { model: model || 'Android device', os: `Android ${android[1] ?? ''}` };
  }

  const windows = /Windows NT (\d+(?:\.\d+)?)/.exec(userAgent);
  if (windows) return { model: 'Windows PC', os: `Windows NT ${windows[1] ?? ''}` };
  const mac = /Mac OS X (\d+(?:[_.]\d+)*)/.exec(userAgent);
  if (mac) return { model: 'Mac', os: `macOS ${dotted(mac[1] ?? '')}` };
  if (/Linux/.test(userAgent)) return { model: 'Linux PC', os: 'Linux' };
  return { model: UNKNOWN, os: UNKNOWN };
}

/** The user agent of this page; empty without a `navigator` (tests, Node). */
export function pageUserAgent(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent;
}
