import { existsSync, readdirSync, readFileSync } from 'node:fs';

/**
 * The guard of the docs (CLAUDE.md, "Как вести docs"). Only exact checks: stray control
 * characters, table rows without a header, links from the code to docs files, sections and
 * titles that do not exist, and file paths in the descriptions that do not exist.
 */

export interface DocFinding {
  file: string;
  line: number;
  what: string;
}

/** A link to a docs file: the file, and the section number or quoted title right after it. */
export interface DocRef {
  file: string;
  line: number;
  /** Path of the linked file from `docs/`, e.g. `08-architecture.md` or `_archive/08-tech-journal.md`. */
  doc: string;
  section?: string;
  title?: string;
}

const lineOf = (text: string, index: number): number => text.slice(0, index).split('\n').length;

/** Characters below 0x20 other than a line feed and a carriage return before it. */
export function controlChars(file: string, text: string): DocFinding[] {
  const found: DocFinding[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x20 || code === 0x0a || (code === 0x0d && text[i + 1] === '\n')) continue;
    found.push({
      file,
      line: lineOf(text, i),
      what: `control character 0x${code.toString(16).padStart(2, '0')}`,
    });
  }
  return found;
}

const FENCE = /^\s*(```|~~~)/;
const TABLE_DIVIDER = /^\|\s*:?-{3,}/;

/**
 * Lines starting with `|` outside code blocks whose block of such lines has no header divider
 * (`|---`) on its second line: GitHub shows them as plain text.
 */
export function headlessTableRows(file: string, text: string): DocFinding[] {
  const lines = text.split(/\r?\n/);
  const found: DocFinding[] = [];
  let inCode = false;
  let inTable = false;
  let headed = false;
  lines.forEach((line, i) => {
    if (FENCE.test(line)) {
      inCode = !inCode;
      inTable = false;
      return;
    }
    if (inCode || !line.startsWith('|')) {
      inTable = false;
      return;
    }
    if (!inTable) {
      inTable = true;
      headed = TABLE_DIVIDER.test(lines[i + 1] ?? '');
    }
    if (!headed) found.push({ file, line: i + 1, what: 'table row without a header' });
  });
  return found;
}

const DOC_REF =
  /(?:docs\/)?((?:_archive\/)?\d{2}a?-[a-z0-9-]+\.md)`?\)?(?:,?\s*(?:section|раздел[а-я]*)\s+(\d+(?:\.\d+)*))?(?:[,;:]?\s*(?:(?:section|раздел[а-я]*|строка)\s+)?[«"]([^»"\n]{2,80})[»"])?/g;

/** Links to docs files in `text`, with the section number and the quoted title that follow them. */
export function docRefs(file: string, text: string): DocRef[] {
  return [...text.matchAll(DOC_REF)].map((m) => {
    const [, doc = '', section, title] = m;
    return { file, line: lineOf(text, m.index), doc, section, title };
  });
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Links whose file, section heading (`## N.` or `### N.`) or quoted title is missing. */
export function brokenRefs(
  refs: readonly DocRef[],
  readDoc: (doc: string) => string | undefined,
): DocFinding[] {
  const found: DocFinding[] = [];
  for (const ref of refs) {
    const at = { file: ref.file, line: ref.line };
    const doc = readDoc(ref.doc);
    if (doc === undefined) {
      found.push({ ...at, what: `no file docs/${ref.doc}` });
      continue;
    }
    if (ref.section && !new RegExp(`^#{2,3} ${escapeRe(ref.section)}\\.`, 'm').test(doc)) {
      found.push({ ...at, what: `no section ${ref.section} in docs/${ref.doc}` });
    }
    if (ref.title && !doc.includes(ref.title)) {
      found.push({ ...at, what: `no "${ref.title}" in docs/${ref.doc}` });
    }
  }
  return found;
}

const CODE_PATH = /(?<![\w/.-])((?:src|scripts)\/[\w./-]+\.(?:ts|json|cjs|mjs|js|sh|ps1|yml|md))/g;

/** Paths `src/...` and `scripts/...` with an extension in `text` that do not exist. */
export function missingPaths(
  file: string,
  text: string,
  exists: (path: string) => boolean,
): DocFinding[] {
  return [...text.matchAll(CODE_PATH)]
    .map((m) => ({ path: m[1] ?? '', line: lineOf(text, m.index) }))
    .filter(({ path }) => !exists(path))
    .map(({ path, line }) => ({ file, line, what: `no file ${path}` }));
}

/** Descriptions whose paths are not checked: they hold plans with files that do not exist yet. */
const PLAN_DOCS = new Set(['10-roadmap.md', '12-ideas-backlog.md']);

/** Files under `dir` (paths from `root`), recursively; `node_modules` is skipped. */
function filesUnder(root: string, dir: string): string[] {
  const full = `${root}/${dir}`;
  if (!existsSync(full)) return [];
  return readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : filesUnder(root, path);
    return [path];
  });
}

/** Every finding of the four checks over the project at `root`. */
export function scanDocs(root = '.'): DocFinding[] {
  const read = (path: string): string => readFileSync(`${root}/${path}`, 'utf8');
  const docs = filesUnder(root, 'docs').filter((f) => f.endsWith('.md'));
  const found: DocFinding[] = [];
  for (const doc of docs) {
    const text = read(doc);
    found.push(...controlChars(doc, text), ...headlessTableRows(doc, text));
    const name = doc.slice('docs/'.length);
    if (!name.includes('/') && !PLAN_DOCS.has(name)) {
      found.push(...missingPaths(doc, text, (p) => existsSync(`${root}/${p}`)));
    }
  }
  const sources = [
    ...filesUnder(root, 'src'),
    ...filesUnder(root, 'scripts'),
    ...filesUnder(root, '.github'),
    'CLAUDE.md',
    'README.md',
  ].filter((f) => /\.(ts|cjs|mjs|js|sh|ps1|yml|md|json)$/.test(f) && existsSync(`${root}/${f}`));
  const readDoc = (doc: string): string | undefined =>
    existsSync(`${root}/docs/${doc}`) ? read(`docs/${doc}`) : undefined;
  for (const source of sources) {
    if (source === 'scripts/docs-guard.test.ts') continue;
    found.push(...brokenRefs(docRefs(source, read(source)), readDoc));
  }
  return found;
}

export const formatFinding = (f: DocFinding): string => `${f.file}:${f.line}: ${f.what}`;
