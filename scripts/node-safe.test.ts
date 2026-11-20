import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `npm run sim` and the other `tsx` scripts run the game's logic in plain Node, where
 * `import.meta.env` does not exist: a module that reads it at load time stops them before they
 * start (`build-kind.ts` did that through `util/clock.ts`, commit b9b8865). Vitest fills
 * `import.meta.env`, so an ordinary test cannot see it; this one follows the imports instead.
 */

const ROOT = resolve(__dirname, '..');

/** The relative modules a file loads at run time (`import type` and `export type` load nothing). */
function runtimeImports(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const found: string[] = [];
  const pattern = /^\s*(import|export)\s+(type\s+)?[^'"]*?from\s+['"](\.[^'"]+)['"]/gm;
  for (const match of text.matchAll(pattern)) {
    if (match[2]) continue;
    found.push(match[3]!);
  }
  for (const match of text.matchAll(/^\s*import\s+['"](\.[^'"]+)['"]/gm)) found.push(match[1]!);
  return found;
}

function resolveModule(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec);
  for (const candidate of [base, `${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && candidate.endsWith('.ts')) return candidate;
  }
  return null;
}

/** Every module `entry` loads, itself included. */
function closure(entries: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of runtimeImports(file)) {
      const target = resolveModule(file, spec);
      if (target) queue.push(target);
    }
  }
  return seen;
}

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

/** The scripts of package.json that `tsx` runs. */
function tsxEntries(): string[] {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  return Object.values(pkg.scripts).flatMap((command) => {
    const match = /\btsx\s+(\S+\.ts)/.exec(command);
    return match ? [join(ROOT, match[1]!)] : [];
  });
}

/** Text outside comments: a comment may well talk about `import.meta.env`. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('modules that run in plain Node', () => {
  it('finds the tsx scripts of package.json', () => {
    expect(tsxEntries().map((f) => relative(ROOT, f).replace(/\\/g, '/'))).toContain(
      'scripts/sim.ts',
    );
  });

  it('never read import.meta.env: the tsx scripts, src/core and src/data', () => {
    const entries = [
      ...tsxEntries(),
      ...tsFiles(join(ROOT, 'src', 'core')),
      ...tsFiles(join(ROOT, 'src', 'data')),
    ];
    const offenders = [...closure(entries)]
      .filter((file) => code(file).includes('import.meta.env'))
      .map((file) => relative(ROOT, file).replace(/\\/g, '/'));
    expect(offenders).toEqual([]);
  });

  it('catches a module that reads import.meta.env through an import', () => {
    const reached = closure([join(ROOT, 'src', 'util', 'clock.ts')]);
    const names = [...reached].map((f) => relative(ROOT, f).replace(/\\/g, '/'));
    expect(names).toContain('src/util/build-kind.ts');
    expect(code(join(ROOT, 'src', 'util', 'build-kind.ts'))).toContain('import.meta.env');
  });
});
