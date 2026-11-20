import { describe, expect, it } from 'vitest';
import { SITE } from '../../data/app/site';
import { DICTIONARIES } from '../../i18n';
import { shortInstallId, supportMailUrl } from './support-contact';

const facts = { version: '0.1.0', buildHash: 'abc1234', installId: '0123456789abcdef-secret' };
const tr = (key: string): string => {
  const part = key.split('.')[1] ?? key;
  return `<${part}>`;
};
const shell = (build: string | null) => ({
  deviceInfo: () => Promise.resolve({ model: 'Pixel 7', os: 'Android 15' }),
  appBuild: () => Promise.resolve(build),
});

describe('supportMailUrl', () => {
  it('addresses the support mailbox of the site', async () => {
    const url = await supportMailUrl(facts, shell('4'), tr);
    expect(url.startsWith(`mailto:${SITE.supportEmail}?subject=`)).toBe(true);
  });

  it('carries the version, build, shown install id, model and system, and nothing more', async () => {
    const url = new URL(await supportMailUrl(facts, shell('4'), tr));
    expect(url.searchParams.get('subject')).toBe('<subject>');
    expect(url.searchParams.get('body')).toBe(
      [
        '<intro>',
        '',
        '',
        '--------',
        '<game>: 0.1.0',
        '<build>: 4 (abc1234)',
        '<install>: 01234567',
        '<device>: Pixel 7',
        '<os>: Android 15',
      ].join('\r\n'),
    );
    expect(url.href).not.toContain('secret');
  });

  it('shows only the hash when the app has no build number (a browser)', async () => {
    const url = new URL(await supportMailUrl(facts, shell(null), tr));
    expect(url.searchParams.get('body')).toContain('\r\n<build>: abc1234\r\n');
  });

  it('shows the install id the way the settings window does', () => {
    expect(shortInstallId('0123456789abcdef')).toBe('01234567');
  });

  it('has the letter texts in both languages', () => {
    for (const lang of ['en', 'ru'] as const) {
      const contact = DICTIONARIES[lang].contact;
      expect(contact).toBeTypeOf('object');
      for (const key of ['subject', 'intro', 'game', 'build', 'install', 'device', 'os']) {
        expect(typeof (contact as Record<string, unknown>)[key]).toBe('string');
      }
    }
  });
});
