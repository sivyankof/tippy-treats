import { describe, expect, it } from 'vitest';
import { parseUserAgent } from './device-info';

describe('parseUserAgent', () => {
  it('reads an iPhone', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
    expect(parseUserAgent(ua)).toEqual({ model: 'iPhone', os: 'iOS 18.1' });
  });

  it('reads an iPad and a three-part version', () => {
    const ua = 'Mozilla/5.0 (iPad; CPU OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15';
    expect(parseUserAgent(ua)).toEqual({ model: 'iPad', os: 'iOS 17.5.1' });
  });

  it('reads an Android phone with its model', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 15; Pixel 7 Build/AP4A.250105.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';
    expect(parseUserAgent(ua)).toEqual({ model: 'Pixel 7', os: 'Android 15' });
  });

  it('reads an Android model without a build mark and with a hidden one', () => {
    expect(parseUserAgent('Mozilla/5.0 (Linux; Android 14; SM-S911B) Chrome/120.0')).toEqual({
      model: 'SM-S911B',
      os: 'Android 14',
    });
    expect(parseUserAgent('Mozilla/5.0 (Linux; Android 10; K) Chrome/120.0').model).toBe('K');
    expect(parseUserAgent('Mozilla/5.0 (Linux; Android 10) Chrome/120.0')).toEqual({
      model: 'Android device',
      os: 'Android 10',
    });
  });

  it('reads desktop systems', () => {
    expect(parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0')).toEqual({
      model: 'Windows PC',
      os: 'Windows NT 10.0',
    });
    expect(parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605')).toEqual({
      model: 'Mac',
      os: 'macOS 10.15.7',
    });
    expect(parseUserAgent('Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0').os).toBe('Linux');
  });

  it('gives unknown for nothing it knows', () => {
    expect(parseUserAgent('')).toEqual({ model: 'unknown', os: 'unknown' });
    expect(parseUserAgent('curl/8.0')).toEqual({ model: 'unknown', os: 'unknown' });
  });
});
