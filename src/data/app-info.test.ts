import { describe, expect, it } from 'vitest';
import pkg from '../../package.json';
import { APP_VERSION } from './app-info';

describe('APP_VERSION', () => {
  it('is the version of package.json, the one the settings window shows', () => {
    expect(APP_VERSION).toBe(pkg.version);
  });
});
