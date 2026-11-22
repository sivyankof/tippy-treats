import { describe, expect, it } from 'vitest';
import {
  brokenRefs,
  controlChars,
  docRefs,
  formatFinding,
  headlessTableRows,
  missingPaths,
  scanDocs,
} from './docs-guard';

const lines = (found: ReadonlyArray<{ line: number }>): number[] => found.map((f) => f.line);

describe('docs guard: control characters', () => {
  it('finds a backspace and a tab that a shell wrote instead of \\b and \\t', () => {
    const text = `ok\nassets${String.fromCharCode(8)}uilds${String.fromCharCode(9)}ippy.aab\n`;
    expect(controlChars('a.md', text).map((f) => f.what)).toEqual([
      'control character 0x08',
      'control character 0x09',
    ]);
    expect(lines(controlChars('a.md', text))).toEqual([2, 2]);
  });

  it('lets line feeds and Windows line ends pass, but not a lone carriage return', () => {
    expect(controlChars('a.md', 'one\r\ntwo\nthree')).toEqual([]);
    expect(lines(controlChars('a.md', 'one\rtwo'))).toEqual([1]);
  });
});

describe('docs guard: table rows without a header', () => {
  it('finds rows glued to a paragraph and lets a headed table pass', () => {
    const text = [
      '| A | B |',
      '|---|---|',
      '| 1 | 2 |',
      '',
      '**Why.** A paragraph.',
      '| 2026-11-17 | lost row |',
      '| 2026-11-18 | lost row |',
    ].join('\n');
    expect(lines(headlessTableRows('a.md', text))).toEqual([6, 7]);
  });

  it('accepts aligned dividers and skips code blocks', () => {
    const text = ['| A |', '|:---|', '| 1 |', '', '```', '| not a table |', '```'].join('\n');
    expect(headlessTableRows('a.md', text)).toEqual([]);
  });
});

describe('docs guard: links from the code', () => {
  const docs: Record<string, string> = {
    '07-ui-screens.md': '## 6. Results\n\nОкно нового уровня — `PopupWindow`.\n',
    '08-architecture.md': '## 12. Журнал технических решений\n\n### 2.1. Пример\n',
    '_archive/08-tech-journal.md': '# Журнал\n',
  };
  const readDoc = (doc: string): string | undefined => docs[doc];

  it('reads the file, the section number and the quoted title', () => {
    expect(
      docRefs('a.ts', '// see (docs/07-ui-screens.md, section 6, "Окно нового уровня").'),
    ).toEqual([
      { file: 'a.ts', line: 1, doc: '07-ui-screens.md', section: '6', title: 'Окно нового уровня' },
    ]);
    expect(
      docRefs('b.md', 'в `docs/08-architecture.md`, раздел «Журнал технических решений»'),
    ).toMatchObject([{ doc: '08-architecture.md', title: 'Журнал технических решений' }]);
    expect(docRefs('c.md', '`docs/_archive/08-tech-journal.md`')).toMatchObject([
      { doc: '_archive/08-tech-journal.md' },
    ]);
  });

  it('finds a missing file, section and title', () => {
    const text = [
      '(docs/06-art-animation-audio.md, "Окно нового уровня")',
      '(docs/08-architecture.md, section 14)',
      '(docs/07-ui-screens.md, section 6, "Окно старого уровня")',
    ].join('\n');
    expect(brokenRefs(docRefs('a.ts', text), readDoc).map(formatFinding)).toEqual([
      'a.ts:1: no file docs/06-art-animation-audio.md',
      'a.ts:2: no section 14 in docs/08-architecture.md',
      'a.ts:3: no "Окно старого уровня" in docs/07-ui-screens.md',
    ]);
  });

  it('lets good links pass, subsections and the archive included', () => {
    const text = [
      '(docs/08-architecture.md, section 12)',
      '(docs/08-architecture.md, раздел 2.1)',
      '(docs/07-ui-screens.md, section 6, "Окно нового уровня")',
      '`docs/_archive/08-tech-journal.md`',
    ].join('\n');
    expect(brokenRefs(docRefs('a.ts', text), readDoc)).toEqual([]);
  });
});

describe('docs guard: file paths in the descriptions', () => {
  const exists = (path: string): boolean => path === 'src/core/tower/tower-sim.ts';

  it('finds a path that does not exist and lets a real one pass', () => {
    const text =
      'Симуляция: `src/core/tower/tower-sim.ts`.\nСтарый путь: `src/game/scenes/modal-scene.ts`.';
    expect(missingPaths('a.md', text, exists).map(formatFinding)).toEqual([
      'a.md:2: no file src/game/scenes/modal-scene.ts',
    ]);
  });

  it('skips short paths without src/, folders and patterns', () => {
    const text = '`core/tower/old.ts`, `src/core/tower/`, `src/core/tower/tower-sim-*.test.ts`';
    expect(missingPaths('a.md', text, exists)).toEqual([]);
  });
});

describe('docs guard: the real docs', () => {
  it('finds nothing in docs, the code links and the paths', () => {
    expect(scanDocs().map(formatFinding)).toEqual([]);
  });
});
