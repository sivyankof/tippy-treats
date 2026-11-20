/* global module */
// The pure part of the site publication (scripts/site/publish-site.cjs, docs/11-release-store.md,
// section 9): what is filled in at publication, and the guard that stops a publication carrying a
// placeholder, a personal e-mail address or something like a phone number.

/** Files of site/ that stay in this repository (internal notes). */
const UNPUBLISHED = ['site/README.md'];

const PLACEHOLDER_RE = /\[[A-Z_]+\]/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /\+\d[\d ()-]{8,}\d/;
const EMPTY_DATE = '<time data-effective></time>';
const PUBLISHED_DATE_RE = /<time data-effective datetime="(\d{4}-\d{2}-\d{2})">/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `SITE.supportEmail` of src/data/app/site.ts: the address, or null while it is not set. */
function readSupportEmail(source) {
  const found = /supportEmail:\s*(?:null|'([^']*)')/.exec(source);
  if (!found) throw new Error('supportEmail not found in src/data/app/site.ts');
  return found[1] ? found[1] : null;
}

/** The effective date of the published policy, or null when nothing is published yet. */
function publishedDate(html) {
  const found = PUBLISHED_DATE_RE.exec(html ?? '');
  return found ? found[1] : null;
}

/** The files with the support address and the effective date put in (others unchanged). */
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
  publishedDate,
  fillSite,
  findProblems,
  publishable,
  UNPUBLISHED,
};
