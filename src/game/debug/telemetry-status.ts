import { DEBUG_MENU as M } from '../../data/debug/debug-menu';
import { TELEMETRY_LOG } from '../../data/debug/telemetry-log';
import { services } from '../../services';
import { telemetryLog } from '../../services/telemetry/event-log';
import { crashReporter } from '../app/crash-reporting';
import { copyText } from '../common/copy-text';
import { menuHeading, overlayButtonCss } from './overlay-style';

/**
 * The "Events" section of the debug menu: the last analytics events of this page load, a button
 * that copies them, and the two tests of Crashlytics (a non-fatal report; a real crash that ends
 * the app). The reports only reach Crashlytics in an app built with the Firebase settings file.
 * `dispose` stops the refresh timer.
 */
export function buildTelemetryStatus(): { element: HTMLElement; dispose: () => void } {
  const element = document.createElement('div');
  const text = document.createElement('div');
  text.style.cssText =
    `font:${M.infoFontPx}px monospace;word-break:break-word;overflow-wrap:anywhere;` +
    `margin-bottom:${M.gapPx}px;white-space:pre-wrap;-webkit-user-select:text;user-select:text;`;
  const refresh = (): void => {
    const lines = telemetryLog.last(TELEMETRY_LOG.shown);
    text.textContent = lines.length > 0 ? lines.join('\n') : 'no events yet';
  };
  refresh();
  const timer = setInterval(refresh, TELEMETRY_LOG.refreshMs);

  const buttons = document.createElement('div');
  buttons.style.cssText = `display:flex;flex-wrap:wrap;gap:${M.gapPx}px;`;
  let noteTimer: ReturnType<typeof setTimeout> | undefined;
  const make = (label: string, onTap: (self: HTMLButtonElement) => void): HTMLButtonElement => {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = label;
    el.style.cssText =
      overlayButtonCss(M.fontPx, M.buttonPx, M.buttonFill) + 'touch-action:manipulation;';
    el.addEventListener('click', () => onTap(el));
    buttons.append(el);
    return el;
  };
  const note = (el: HTMLButtonElement, label: string, shown: string): void => {
    el.textContent = shown;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => (el.textContent = label), M.copyNoteMs);
  };
  make('Copy events', (self) => {
    void copyText(telemetryLog.last().join('\n'), text).then((ok) =>
      note(self, 'Copy events', ok ? 'copied' : 'copy failed'),
    );
  });
  make('Test non-fatal', (self) => {
    crashReporter.reportTest();
    telemetryLog.add('crash: test non-fatal sent');
    note(self, 'Test non-fatal', 'sent');
  });
  make('Test crash (app closes)', () => {
    telemetryLog.add('crash: forcing a crash');
    services.crash.crash();
  });

  element.append(menuHeading('Events and failure reports'), text, buttons);
  return { element, dispose: () => (clearInterval(timer), clearTimeout(noteTimer)) };
}
