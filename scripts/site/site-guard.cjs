/* global module */
// The pure part of the site publication (scripts/site/publish-site.cjs, docs/11-release-store.md,
// section 9): what is filled in at publication, and the guard that stops a publication carrying a
// placeholder, a personal e-mail address or something like a phone number.

/** Files of site/ that stay in this repository (internal notes). */
const UNPUBLISHED = ['site/README.md'];
/** Files that are text: filled in and checked. Anything else (images) is copied byte for byte. */
const TEXT_EXTENSIONS = ['.html', '.css', '.js', '.txt', '.svg', '.xml', '.json', '.webmanifest'];
/** The legal pages: a change of their text needs a new effective date. */
const LEGAL_PAGES = ['site/privacy.html', 'site/terms.html'];

const PLACEHOLDER_RE = /\[[A-Z_]+\]/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /\+\d[\d ()-]{8,}\d/;
const EMPTY_DATE = '<time data-effective></time>';
const PUBLISHED_DATE_RE = /<time data-effective datetime="(\d{4}-\d{2}-\d{2})">/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAGES_BASE_RE = /^https:\/\/([a-z0-9-]+)\.github\.io\/([A-Za-z0-9._-]+)\/$/;

/** A string field of src/data/app/site.ts (`name: 'value'`), or null when it is `null`. */
function readField(source, name) {
  const found = new RegExp(`${name}:\\s*(?:null|'([^']*)')`).exec(source);
  if (!found) throw new Error(`${name} not found in src/data/app/site.ts`);
  return found[1] ? found[1] : null;
}

/** `SITE.supportEmail`: the address, or null while it is not set. */
function readSupportEmail(source) {
  return readField(source, 'supportEmail');
}

/** The public repository whose GitHub Pages serve `SITE.base` (one place for both). */
function repoOfBase(base) {
  const found = PAGES_BASE_RE.exec(base ?? '');
  if (!found) throw new Error(`SITE.base is not a GitHub Pages project address: ${base}`);
  return `https://github.com/${found[1]}/${found[2]}.git`;
}

/** `owner/name` of a GitHub repository address (for the GitHub CLI). */
function slugOfRepo(repo) {
  const found = /^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/.exec(repo ?? '');
  if (!found) throw new Error(`not a GitHub repository address: ${repo}`);
  return found[1];
}

/** The effective date of the published policy, or null when its page has none. */
function publishedDate(html) {
  const found = PUBLISHED_DATE_RE.exec(html ?? '');
  return found ? found[1] : null;
}

function isText(name) {
  return TEXT_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));
}

/** The text files with the support address and the effective date put in (others unchanged). */
function fillSite(files, { email, date }) {
  if (!DATE_RE.test(date)) throw new Error(`effective date must look like 2026-11-20: ${date}`);
  const out = {};
  for (const [name, text] of Object.entries(files)) {
    let filled = text
      .split(EMPTY_DATE)
      .join(`<time data-effective datetime="${date}">${date}</time>`);
    if (email) filled = filled.split('[SUPPORT_EMAIL]').join(email);
    out[name] = filled;
  }
  return out;
}

/** The legal pages whose text differs from the published ones (both filled with the same date). */
function changedLegal(filled, published) {
  return LEGAL_PAGES.filter(
    (name) => published[name] !== undefined && filled[name] !== published[name],
  );
}

/** What stops the publication, one line per finding; empty when the files may go out. */
function findProblems(files, email) {
  const found = [];
  for (const [name, text] of Object.entries(files)) {
    const placeholders = [...new Set(text.match(PLACEHOLDER_RE) ?? [])];
    for (const p of placeholders) {
      const why = p === '[SUPPORT_EMAIL]' ? ' (set SITE.supportEmail in src/data/app/site.ts)' : '';
      found.push(`${name}: placeholder ${p} left${why}`);
    }
    if (text.includes('class="ph"')) found.push(`${name}: placeholder highlight class="ph" left`);
    if (text.includes(EMPTY_DATE)) found.push(`${name}: effective date not filled`);
    for (const address of new Set(text.match(EMAIL_RE) ?? [])) {
      if (!email || address.toLowerCase() !== email.toLowerCase()) {
        found.push(`${name}: an e-mail address other than the support address`);
      }
    }
    if (PHONE_RE.test(text)) found.push(`${name}: something like a phone number`);
  }
  return found;
}

/** The site files that are published (the internal notes stay). */
function publishable(names) {
  return names.filter((name) => !UNPUBLISHED.includes(name));
}

module.exports = {
  readSupportEmail,
  readField,
  repoOfBase,
  slugOfRepo,
  publishedDate,
  isText,
  fillSite,
  changedLegal,
  findProblems,
  publishable,
  UNPUBLISHED,
  LEGAL_PAGES,
  PLACEHOLDER_RE,
};
