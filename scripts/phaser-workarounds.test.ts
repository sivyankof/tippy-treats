import { describe, expect, it } from 'vitest';
import { nodeFs } from './node-env';

/**
 * Phaser 4.2.1 calls that leak unless they go through the game's wrappers (docs/08-architecture.md,
 * journal 2026-11-19): a direct call outside the wrapper file skips the workaround.
 */
const GUARDED_CALLS: readonly { call: string; pattern: RegExp; wrapper: string }[] = [
  {
    call: 'textures.addDynamicTexture',
    pattern: /\.addDynamicTexture\s*\(/,
    wrapper: 'src/game/app/dynamic-texture.ts',
  },
  {
    call: 'Graphics.generateTexture',
    pattern: /\.generateTexture\s*\(/,
    wrapper: 'src/game/common/graphics-to-canvas.ts',
  },
];

/** Every `.ts` file of `src` except tests, keyed by the path from the project root. */
function sourceFiles(): Map<string, string> {
  const fs = nodeFs();
  const files = new Map<string, string>();
  const visit = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) visit(path);
      else if (path.endsWith('.ts') && !path.endsWith('.test.ts')) {
        files.set(path, fs.readFileSync(path, 'utf8'));
      }
    }
  };
  visit('src');
  return files;
}

/** `file:line call` for every guarded call outside its wrapper file. */
export function unwrappedCalls(
  files: ReadonlyMap<string, string>,
  guarded: typeof GUARDED_CALLS,
): string[] {
  const found: string[] = [];
  for (const [path, text] of files) {
    text.split('\n').forEach((line, i) => {
      for (const { call, pattern, wrapper } of guarded) {
        if (path !== wrapper && pattern.test(line)) found.push(`${path}:${i + 1} ${call}`);
      }
    });
  }
  return found;
}

describe('Phaser leak workarounds', () => {
  it('finds a direct call outside the wrapper and lets the wrapper call it', () => {
    const files = new Map([
      ['src/game/app/dynamic-texture.ts', 'const t = textures.addDynamicTexture(key, w, h);'],
      ['src/game/ui/x.ts', 'ok();\nscene.textures.addDynamicTexture("k", 1, 1);'],
      ['src/game/ui/y.ts', 'g.generateTexture(canvas, 2, 2);'],
      ['src/game/ui/z.ts', 'addDynamicTexture(scene.textures, "k", 1, 1);'],
    ]);
    expect(unwrappedCalls(files, GUARDED_CALLS)).toEqual([
      'src/game/ui/x.ts:2 textures.addDynamicTexture',
      'src/game/ui/y.ts:1 Graphics.generateTexture',
    ]);
  });

  it('makes dynamic textures and Graphics bakes only through the wrappers', () => {
    expect(unwrappedCalls(sourceFiles(), GUARDED_CALLS)).toEqual([]);
  });
});
