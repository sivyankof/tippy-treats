import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE, siteUrl, type SitePage } from '../../src/data/app/site';
import {
  changedLegal,
  fillSite,
  findProblems,
  isText,
  PLACEHOLDER_RE,
  publishable,
  publishedDate,
  readField,
  readSupportEmail,
  repoOfBase,
  slugOfRepo,
} from './site-guard.cjs';

const ROOT = join(__dirname, '..', '..');
const SITE_DIR = join(ROOT, 'site');
const PAGES = Object.keys(SITE.pages) as SitePage[];

/** The published text files of site/ (all folders) as they are in the working tree: path -> text. */
function siteFiles(): Record<string, string> {
  const all = readdirSync(SITE_DIR, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map(
      (entry) =>
        `site/${join(entry.parentPath, entry.name)
          .slice(SITE_DIR.length + 1)
          .replace(/\\/g, '/')}`,
    );
  const names = publishable(all).filter(isText);
  return Object.fromEntries(names.map((name) => [name, readFileSync(join(ROOT, name), 'utf8')]));
}

const FAKE_SUPPORT = 'help@example.org';

describe('the site source', () => {
  it('has no placeholder but the support address token, filled from SITE.supportEmail', () => {
    const files = siteFiles();
    const left = Object.entries(files).flatMap(([name, text]) =>
      [...new Set(text.match(PLACEHOLDER_RE) ?? [])].map((p) => `${name} ${p}`),
    );
    expect(left.filter((l) => !l.endsWith('[SUPPORT_EMAIL]'))).toEqual([]);
    expect(SITE.supportEmail).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/);
    for (const [name, text] of Object.entries(files)) {
      expect(text.includes('class="ph"'), name).toBe(false);
    }
  });

  it('goes out clean with the support address of the game and the date put in', () => {
    const files = fillSite(siteFiles(), { email: SITE.supportEmail, date: '2026-11-20' });
    expect(findProblems(files, SITE.supportEmail)).toEqual([]);
    expect(files['site/support.html']).toContain(`mailto:${SITE.supportEmail}`);
    expect(files['site/privacy.html']).toContain('<time data-effective datetime="2026-11-20">');
    expect(files['site/terms.html']).toContain('<time data-effective datetime="2026-11-20">');
  });

  it('would be stopped by the guard without a support address', () => {
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

  it('the publication reads the same support address and site address as the game', () => {
    const source = readFileSync(join(ROOT, 'src', 'data', 'app', 'site.ts'), 'utf8');
    expect(readSupportEmail(source)).toBe(SITE.supportEmail);
    expect(readField(source, 'base')).toBe(SITE.base);
    expect(repoOfBase(SITE.base)).toBe('https://github.com/sivyankof/tippy-treats-site.git');
    expect(slugOfRepo(repoOfBase(SITE.base))).toBe('sivyankof/tippy-treats-site');
  });

  it('the language switch knows every page of SITE.pages', () => {
    const lang = readFileSync(join(SITE_DIR, 'lang.js'), 'utf8');
    const listed = /SITE_PAGES = \[([^\]]*)\]/.exec(lang)?.[1] ?? '';
    for (const page of PAGES) expect(listed).toContain(`'${SITE.pages[page]}'`);
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

  it('sees a changed text of the legal pages, not a page that stayed the same', () => {
    const old = { 'site/privacy.html': 'a', 'site/terms.html': 'b' };
    expect(changedLegal({ 'site/privacy.html': 'a', 'site/terms.html': 'b' }, old)).toEqual([]);
    expect(changedLegal({ 'site/privacy.html': 'a2', 'site/terms.html': 'b' }, old)).toEqual([
      'site/privacy.html',
    ]);
    expect(changedLegal({ 'site/privacy.html': 'x' }, {})).toEqual([]);
  });

  it('copies images byte for byte: only text files are filled in and checked', () => {
    expect(isText('site/privacy.html')).toBe(true);
    expect(isText('site/img/badge.png')).toBe(false);
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
