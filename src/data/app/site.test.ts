import { describe, expect, it } from 'vitest';
import { SITE, sitePageIn, siteUrl } from './site';

describe('site addresses', () => {
  it('a page in the game language carries ?lang=', () => {
    expect(sitePageIn('privacy', 'ru')).toBe(`${SITE.base}privacy.html?lang=ru`);
    expect(sitePageIn('support', 'en')).toBe(`${siteUrl('support')}?lang=en`);
  });
});
