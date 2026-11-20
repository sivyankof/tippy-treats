import { describe, expect, it } from 'vitest';
import pkg from '../../../package.json';
import { storeVersion } from '../../../scripts/native/app-version.cjs';
import { APP_VERSION } from './app-info';

describe('APP_VERSION', () => {
  it('is the store version of package.json, the one the settings window and both stores show', () => {
    expect(APP_VERSION).toBe(storeVersion(pkg.version));
  });
});

describe('storeVersion', () => {
  it('drops a zero patch, so the build carries the App Store Connect version exactly', () => {
    expect(storeVersion('1.0.0')).toBe('1.0');
    expect(storeVersion('1.2.0')).toBe('1.2');
    expect(storeVersion('1.0.3')).toBe('1.0.3');
    expect(storeVersion('10.20.0')).toBe('10.20');
  });

  it('refuses a version that is not three numbers', () => {
    expect(() => storeVersion('1.0')).toThrow();
    expect(() => storeVersion('1.0.0-beta')).toThrow();
  });
});
