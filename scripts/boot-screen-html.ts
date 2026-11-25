/**
 * Puts the boot screen into index.html (the `boot-screen` plugin of vite.config.ts): the logic of
 * src/util/boot/boot-screen.ts as a plain inline script with its numbers, and the phrases under
 * the picture in both languages from src/i18n (the page shows the one of the device before i18n
 * loads). docs/08-architecture.md, section 7, «Загрузочный экран».
 */
import { minify, transformWithOxc } from 'vite';
import type { BootConfig, BootVariant } from '../src/util/boot/boot-screen.ts';

export type BootPhrases = Record<'ru' | 'en', Record<BootVariant, string[]>>;

/** Where index.html takes the script. */
export const BOOT_SCRIPT_MARK = '<!-- boot-script -->';
/** Where index.html takes the phrases of a picture: `<!-- boot-phrases:tower -->`. */
const PHRASES_MARK = /<!-- boot-phrases:(tower|oven) -->/g;

/**
 * The module as one classic script: types stripped, `export` words dropped (it has no imports),
 * run at once and left on `window.__tippyBoot`. Should it throw, the screen is taken away at once
 * so it can never cover the game.
 */
export async function bootScript(source: string, config: BootConfig): Promise<string> {
  const stripped = (await transformWithOxc(source, 'boot-screen.ts', { lang: 'ts' })).code
    .replace(/^export \{\s*\};?\s*$/gm, '')
    .replace(/^export (?=(?:async )?function |const |let |class )/gm, '');
  const wrapped =
    '(function () {\ntry {\n' +
    stripped +
    `\nwindow.__tippyBoot = startBootScreen(domBootEnv(window), ${JSON.stringify(config)});\n` +
    "} catch (error) {\nvar boot = document.getElementById('boot');\n" +
    'if (boot && boot.parentNode) boot.parentNode.removeChild(boot);\n}\n})();';
  return (await minify('boot-screen.js', wrapped, { compress: true, mangle: true })).code.trim();
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The phrases of one picture: a block per language, the page shows the one of its `lang`. */
export function phrasesHtml(phrases: BootPhrases, variant: BootVariant): string {
  return (['ru', 'en'] as const)
    .map(
      (lang) =>
        `<div class="phrases" data-lang="${lang}">` +
        phrases[lang][variant].map((line) => `<span>${escapeHtml(line)}</span>`).join('') +
        '</div>',
    )
    .join('');
}

/** The phrases of the dictionaries (`boot.<picture>.1…4`). */
export function bootPhrasesOf(dictionaries: Record<'ru' | 'en', unknown>): BootPhrases {
  const pick = (lang: 'ru' | 'en', variant: BootVariant): string[] => {
    const boot = (dictionaries[lang] as { boot?: Record<string, Record<string, string>> }).boot;
    const lines = Object.values(boot?.[variant] ?? {});
    if (lines.length === 0) throw new Error(`No boot.${variant} phrases in ${lang}.json`);
    return lines;
  };
  return {
    ru: { tower: pick('ru', 'tower'), oven: pick('ru', 'oven') },
    en: { tower: pick('en', 'tower'), oven: pick('en', 'oven') },
  };
}

/** The markup of the screen without the room between tags (a build keeps index.html small). */
export function compactBootMarkup(html: string): string {
  const start = html.indexOf('<div id="boot"');
  const end = html.indexOf(BOOT_SCRIPT_MARK);
  if (start < 0 || end < start) return html;
  const markup = html
    .slice(start, end)
    .replace(/<!--[\s\S]*?-->/g, (mark) => (mark.startsWith('<!-- boot-phrases:') ? mark : ''))
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ');
  return html.slice(0, start) + markup + html.slice(end);
}

/** index.html with the script and the phrases in place; `compact` also squeezes the markup. */
export function injectBoot(
  html: string,
  script: string,
  phrases: BootPhrases,
  compact = false,
): string {
  if (!html.includes(BOOT_SCRIPT_MARK)) throw new Error('index.html has no boot script mark');
  return (compact ? compactBootMarkup(html) : html)
    .replace(BOOT_SCRIPT_MARK, () => `<script>${script}</script>`)
    .replace(PHRASES_MARK, (_mark, variant: BootVariant) => phrasesHtml(phrases, variant));
}
