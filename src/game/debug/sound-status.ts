import { AUDIO_LOG } from '../../data/audio/audio-log';
import { DEBUG_MENU as M } from '../../data/debug/debug-menu';
import { audioLog } from '../../services/audio/audio-log';
import { formatAudioStatus } from '../../services/audio/audio-status';
import { audioDev } from '../../services';
import { copyText } from '../common/copy-text';
import { menuHeading, overlayButtonCss } from './overlay-style';

/** The copied report: the status line, an empty line, then the last lines of the sound's log. */
export function soundReport(statusLine: string, lines: readonly string[]): string {
  return [statusLine, '', ...lines].join('\n');
}

/**
 * The "Sound" section of the debug menu: the live status line and a button that copies the report.
 * Null outside the dev and internal builds. `dispose` stops the refresh timer.
 */
export function buildSoundStatus(): { element: HTMLElement; dispose: () => void } | null {
  const dev = audioDev;
  if (!dev) return null;
  const element = document.createElement('div');
  const head = menuHeading('Sound');
  const text = document.createElement('div');
  text.style.cssText =
    `font:${M.infoFontPx}px monospace;word-break:break-word;overflow-wrap:anywhere;` +
    `margin-bottom:${M.gapPx}px;-webkit-user-select:text;user-select:text;`;
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.style.cssText =
    overlayButtonCss(M.fontPx, M.buttonPx, M.buttonFill) + 'touch-action:manipulation;';
  const label = 'Copy sound report';
  copy.textContent = label;

  const refresh = (): void => {
    text.textContent = formatAudioStatus(dev.status());
  };
  refresh();
  const timer = setInterval(refresh, AUDIO_LOG.statusEveryMs);

  let noteTimer: ReturnType<typeof setTimeout> | undefined;
  copy.addEventListener('click', () => {
    const report = soundReport(formatAudioStatus(dev.status()), audioLog.last(AUDIO_LOG.copyLines));
    void copyText(report, text).then((ok) => {
      copy.textContent = ok ? 'copied' : 'copy failed';
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => (copy.textContent = label), M.copyNoteMs);
    });
  });

  element.append(head, text, copy);
  return {
    element,
    dispose: () => {
      clearInterval(timer);
      clearTimeout(noteTimer);
    },
  };
}
