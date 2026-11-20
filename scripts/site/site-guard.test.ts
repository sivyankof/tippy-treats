import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE, siteUrl, type SitePage } from '../../src/data/app/site';
import {
  fillSite,
  findProblems,
  publishable,
  publishedDate,
  readSupportEmail,
} from './site-guard.cjs';

const ROOT = join(__dirname, '..', '..');
const SITE_DIR = join(ROOT, 'site');
const PAGES = Object.keys(SITE.pages) as SitePage[];

/** The published files of site/ as they are in the working tree: path -> text. */
function siteFiles(): Record<string, string> {
  const names = publishable(readdirSync(SITE_DIR).map((name) => `site/${name}`));
  return Object.fromEntries(names.map((name) => [name, readFileSync(join(ROOT, name), 'utf8')]));
}

const FAKE_SUPPORT = 'help@example.org';

describe('the site source', () => {
  it('has no placeholder but the support address, and no placeholder highlight', () => {
    const files = siteFiles();
    const left = Object.entries(files).flatMap(([name, text]) =>
      [...new Set(text.match(/\[[A-Z_]+\]/g) ?? [])].map((p) => `${name} ${p}`),
    );
    const allowed = SITE.supportEmail === null ? ['[SUPPORT_EMAIL]'] : [];
    expect(left.filter((l) => !allowed.some((p) => l.endsWith(p)))).toEqual([]);
    for (const [name, text] of Object.entries(files)) {
      expect(text.includes('class="ph"'), name).toBe(false);
    }
  });

  it('goes out clean once the support address and the date are put in', () => {
    const files = fillSite(siteFiles(), { email: FAKE_SUPPORT, date: '2026-11-20' });
    expect(findProblems(files, FAKE_SUPPORT)).toEqual([]);
    expect(files['site/privacy.html']).toContain('<time data-effective datetime="2026-11-20">');
    expect(files['site/terms.html']).toContain('<time data-effective datetime="2026-11-20">');
  });

  it('is stopped by the guard while the support address is not set', () => {
    const files = fillSite(siteFiles(), { email: null, date: '2026-11-20' });
    const problems = findProblems(files, null);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.every((p) => p.includes('[SUPPORT_EMAIL]'))).toBe(true);
  });

  it('keeps the internal notes out of the publication', () => {
    expect(publishable(['site/README.md', 'site/index.html'])).toEqual(['site/index.html']);
  });
});

describe('the site addresses', () => {
  it('come from one place, and every page exists in site/', () => {
    for (const page of PAGES) {
      expect(readdirSync(SITE_DIR)).toContain(SITE.pages[page]);
      expect(siteUrl(page)).toBe(`${SITE.base}${SITE.pages[page]}`);
    }
  });

  it('match the addresses the stores are given (docs/11-release-store.md, section 9)', () => {
    const doc = readFileSync(join(ROOT, 'docs', '11-release-store.md'), 'utf8');
    const section = doc.slice(doc.indexOf('## 9. Сайт игры'));
    const listed = [...new Set(section.match(/https:\/\/sivyankof\.github\.io\/[^\s|)`]*/g) ?? [])];
    expect(listed.sort()).toEqual([SITE.base, ...PAGES.map(siteUrl)].sort());
  });

  it('agree with the paths of the 404 page (served from the Pages subfolder)', () => {
    const prefix = new URL(SITE.base).pathname;
    const page = readFileSync(join(SITE_DIR, '404.html'), 'utf8');
    const local = [...page.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1] ?? '');
    expect(local.length).toBeGreaterThan(0);
    for (const link of local) expect(link.startsWith(prefix), link).toBe(true);
  });

  it('the publication reads the same support address as the game', () => {
    const source = readFileSync(join(ROOT, 'src', 'data', 'app', 'site.ts'), 'utf8');
    expect(readSupportEmail(source)).toBe(SITE.supportEmail);
  });
});

describe('the guard', () => {
  const page = (text: string): Record<string, string> => ({ 'site/x.html': text });

  it('stops any e-mail address but the support one, and anything like a phone number', () => {
    expect(
      findProblems(page(`<a href="mailto:${FAKE_SUPPORT}">${FAKE_SUPPORT}</a>`), FAKE_SUPPORT),
    ).toEqual([]);
    expect(findProblems(page('write to someone.else@gmail.com'), FAKE_SUPPORT)).toHaveLength(1);
    expect(findProblems(page('call +995 555 12 34 56'), FAKE_SUPPORT)).toHaveLength(1);
  });

  it('stops placeholders, the highlight and an empty date', () => {
    const problems = findProblems(
      page('<span class="ph">[SELLER_NAME]</span> <time data-effective></time>'),
      FAKE_SUPPORT,
    );
    expect(problems).toHaveLength(3);
  });

  it('reads the effective date back from the published policy', () => {
    expect(publishedDate('<time data-effective datetime="2026-11-20">2026-11-20</time>')).toBe(
      '2026-11-20',
    );
    expect(publishedDate(null)).toBeNull();
  });

  it('reads the support address of the constant, null while it is not set', () => {
    expect(readSupportEmail('supportEmail: null as string | null,')).toBeNull();
    expect(readSupportEmail("supportEmail: 'help@example.org' as string | null,")).toBe(
      'help@example.org',
    );
  });
});
