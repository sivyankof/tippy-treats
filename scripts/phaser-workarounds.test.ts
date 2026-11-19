import { describe, expect, it } from 'vitest';
import { folderTree, nodeFs } from './node-env';

/** A Phaser 4.2.1 call that leaks unless it goes through the game's wrapper. */
interface GuardedCall {
  call: string;
  pattern: RegExp;
  /** The one file allowed to make it; `null`: no wrapper yet, write one before using it. */
  wrapper: string | null;
}

/**
 * Phaser 4.2.1 calls that leak unless they go through the game's wrappers (docs/08-architecture.md,
 * journal 2026-11-19): a direct call outside the wrapper file skips the workaround. Render
 * textures, filter masks and the shine effect build a `DynamicTexture` inside Phaser and leave the
 * same blank GPU texture behind; the game has no wrapper for them, so they are not allowed at all.
 */
const GUARDED_CALLS: readonly GuardedCall[] = [
  {
    call: 'textures.addDynamicTexture',
    pattern: /(\.|\[['"`])addDynamicTexture\b/,
    wrapper: 'src/game/app/dynamic-texture.ts',
  },
  {
    call: 'Graphics.generateTexture',
    pattern: /(\.|\[['"`])generateTexture\b/,
    wrapper: 'src/game/common/graphics-to-canvas.ts',
  },
  { call: 'new DynamicTexture', pattern: /new\s+([\w.]+\.)?DynamicTexture\s*\(/, wrapper: null },
  { call: 'renderTexture', pattern: /(\.|\[['"`])renderTexture\b/, wrapper: null },
  { call: 'filter mask', pattern: /(\.|\[['"`])addMask\b/, wrapper: null },
  { call: 'AddEffectShine', pattern: /\bAddEffectShine\b/, wrapper: null },
];

/** Comment lines (`//`, `/*`, ` * `) may name the calls. */
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*)/;

/** Every `.ts` file of `src` except tests, keyed by the path from the project root. */
function sourceFiles(): Map<string, string> {
  const fs = nodeFs();
  const files = new Map<string, string>();
  for (const [dir, names] of folderTree('src')) {
    for (const name of names) {
      if (!name.endsWith('.ts') || name.endsWith('.test.ts')) continue;
      const path = dir ? `src/${dir}/${name}` : `src/${name}`;
      files.set(path, fs.readFileSync(path, 'utf8'));
    }
  }
  return files;
}

/** `file:line call` for every guarded call outside its wrapper file. */
export function unwrappedCalls(
  files: ReadonlyMap<string, string>,
  guarded: readonly GuardedCall[],
): string[] {
  const found: string[] = [];
  for (const [path, text] of files) {
    text.split('\n').forEach((line, i) => {
      if (COMMENT_LINE.test(line)) return;
      for (const { call, pattern, wrapper } of guarded) {
        if (path !== wrapper && pattern.test(line)) found.push(`${path}:${i + 1} ${call}`);
      }
    });
  }
  return found;
}

describe('Phaser leak workarounds', () => {
  it('finds direct calls outside the wrapper and lets the wrapper and comments name them', () => {
    const files = new Map([
      ['src/game/app/dynamic-texture.ts', 'const t = textures.addDynamicTexture(key, w, h);'],
      ['src/game/ui/x.ts', 'ok();\nscene.textures.addDynamicTexture("k", 1, 1);'],
      ['src/game/ui/y.ts', 'g.generateTexture(canvas, 2, 2);'],
      ['src/game/ui/z.ts', 'addDynamicTexture(scene.textures, "k", 1, 1);'],
      [
        'src/game/ui/doc.ts',
        ' * `scene.textures.addDynamicTexture(key, w, h)`\n// g.generateTexture(c)',
      ],
      ['src/game/ui/b.ts', "textures['addDynamicTexture']('k', 1, 1);"],
      ['src/game/fx/r.ts', 'this.add.renderTexture(0, 0, 8, 8);'],
      ['src/game/fx/d.ts', 'new Phaser.Textures.DynamicTexture(m, "k");'],
      ['src/game/fx/m.ts', 'img.filters?.internal.addMask(shape);'],
      ['src/game/fx/s.ts', 'Phaser.Actions.AddEffectShine(img);'],
    ]);
    expect(unwrappedCalls(files, GUARDED_CALLS)).toEqual([
      'src/game/ui/x.ts:2 textures.addDynamicTexture',
      'src/game/ui/y.ts:1 Graphics.generateTexture',
      'src/game/ui/b.ts:1 textures.addDynamicTexture',
      'src/game/fx/r.ts:1 renderTexture',
      'src/game/fx/d.ts:1 new DynamicTexture',
      'src/game/fx/m.ts:1 filter mask',
      'src/game/fx/s.ts:1 AddEffectShine',
    ]);
  });

  it('makes dynamic textures and Graphics bakes only through the wrappers', () => {
    expect(unwrappedCalls(sourceFiles(), GUARDED_CALLS)).toEqual([]);
  });
});
