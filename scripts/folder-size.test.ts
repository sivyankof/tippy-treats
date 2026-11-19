import { describe, expect, it } from 'vitest';
import { nodeFs } from './node-env';

/** Most files one folder of `src` may hold, tests included (docs/08-architecture.md, section 2). */
const FOLDER_LIMIT = 40;

/**
 * Folders allowed to hold more, each with its reason. Empty: every folder fits. A new entry
 * needs a reason the owner agreed to; the usual way out is a subfolder inside the theme.
 */
const EXCEPTIONS: Readonly<Record<string, string>> = {};

/**
 * Number of files directly inside every folder of `src`, keyed by the path from `src` (`''` is
 * `src` itself). Hidden files (`.gitkeep`, `.DS_Store`) do not count. Tests run from the project root.
 */
function folderSizes(): Map<string, number> {
  const fs = nodeFs();
  const sizes = new Map<string, number>();
  const visit = (dir: string): void => {
    let files = 0;
    for (const entry of fs.readdirSync(dir ? `src/${dir}` : 'src', { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) visit(dir ? `${dir}/${entry.name}` : entry.name);
      else files++;
    }
    sizes.set(dir, files);
  };
  visit('');
  return sizes;
}

/** Folders over the limit that are not listed as exceptions, with their size. */
export function oversizeFolders(
  sizes: ReadonlyMap<string, number>,
  limit: number,
  exceptions: Readonly<Record<string, string>>,
): string[] {
  return [...sizes]
    .filter(([folder, files]) => files > limit && !(folder in exceptions))
    .map(([folder, files]) => `${folder ? `src/${folder}` : 'src'}: ${files} files`);
}

describe('folder size', () => {
  it('finds folders over the limit and skips the listed exceptions', () => {
    const sizes = new Map([
      ['core/tower', 41],
      ['core/zones', 40],
      ['game/scenes', 50],
    ]);
    expect(oversizeFolders(sizes, 40, { 'game/scenes': 'reason' })).toEqual([
      'src/core/tower: 41 files',
    ]);
  });

  it(`keeps every folder of src at ${FOLDER_LIMIT} files or fewer`, () => {
    expect(oversizeFolders(folderSizes(), FOLDER_LIMIT, EXCEPTIONS)).toEqual([]);
  });

  it('lists only exceptions that still exist and still need it', () => {
    const sizes = folderSizes();
    const stale = Object.keys(EXCEPTIONS).filter((f) => (sizes.get(f) ?? 0) <= FOLDER_LIMIT);
    expect(stale).toEqual([]);
  });
});
