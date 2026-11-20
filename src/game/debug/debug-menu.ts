// The texts of this menu are plain English literals on purpose: it is an internal tool, not game interface (no i18n).
import { APP_VERSION, BUILD_HASH, BUILD_TIME } from '../../data/app/app-info';
import { DEBUG_MENU as M } from '../../data/debug/debug-menu';
import { formatBuildStamp } from '../../util/build-stamp';
import { showsFpsMeter } from '../../util/debug-params';
import { reloadWithQuery } from '../../util/page-reload';
import {
  composeRunQuery,
  DEFAULT_MENU_CHOICE,
  PERF_QUERY,
  PLACE_OPTIONS,
  SOUNDBOARD_QUERY,
  START_OPTIONS,
  WEATHER_OPTIONS,
  type DebugMenuChoice,
} from './debug-menu-query';
import { menuHeading, overlayButtonCss } from './overlay-style';
import { pushBack } from '../app/back-stack';
import { buildSoundStatus } from './sound-status';
import { askNotifPermission } from '../app/ask-notif-permission';
import { notifTest } from './notif-test';
import { buildTelemetryStatus } from './telemetry-status';

let openMenu: HTMLElement | null = null;

function button(label: string, onTap: () => void, fill: string = M.buttonFill): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.textContent = label;
  el.style.cssText = overlayButtonCss(M.fontPx, M.buttonPx, fill) + 'touch-action:manipulation;';
  el.addEventListener('click', onTap);
  return el;
}

function row(): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `display:flex;flex-wrap:wrap;gap:${M.gapPx}px;`;
  return el;
}

/** A row of exclusive options; the picked one is lit. `null` is the "auto" option. */
function optionRow<T extends string | number | null>(
  options: ReadonlyArray<{ value: T; label: string }>,
  initial: T,
  onPick: (value: T) => void,
): HTMLDivElement {
  const box = row();
  const buttons = options.map(({ value, label }) => {
    const el = button(label, () => {
      onPick(value);
      light(value);
    });
    box.append(el);
    return { value, el };
  });
  const light = (picked: T): void => {
    for (const { value, el } of buttons) {
      el.style.background = value === picked ? M.pickedFill : M.buttonFill;
    }
  };
  light(initial);
  return box;
}

/** A switch button that shows its state. */
function switchButton(label: string, initial: boolean, onChange: (on: boolean) => void) {
  let on = initial;
  const el = button('', () => {
    on = !on;
    onChange(on);
    paint();
  });
  const paint = (): void => {
    el.textContent = `${label}: ${on ? 'on' : 'off'}`;
    el.style.background = on ? M.pickedFill : M.buttonFill;
  };
  paint();
  return el;
}

/** Opens the menu over the canvas; a second call does nothing while it is open. */
export function showDebugMenu(): void {
  if (openMenu) return;
  const choice: DebugMenuChoice = {
    ...DEFAULT_MENU_CHOICE,
    fps: showsFpsMeter(window.location.search),
  };

  const box = document.createElement('div');
  box.style.cssText =
    `position:fixed;z-index:${M.zIndex};inset:0;overflow:auto;box-sizing:border-box;` +
    // The page forbids touch gestures (style.css); the list scrolls with a finger all the same.
    'touch-action:pan-y;overscroll-behavior:contain;-webkit-user-select:none;user-select:none;' +
    `padding:calc(${M.paddingPx}px + env(safe-area-inset-top)) ${M.paddingPx}px ` +
    `calc(${M.paddingPx}px + env(safe-area-inset-bottom));` +
    `background:${M.background};color:${M.color};font:${M.fontPx}px sans-serif;`;
  const inner = document.createElement('div');
  inner.style.cssText = `max-width:${M.maxWidthPx}px;margin:0 auto;`;
  box.append(inner);

  const title = document.createElement('div');
  title.textContent = 'Debug menu';
  title.style.cssText = `font:bold ${M.titleFontPx}px sans-serif;`;
  const build = document.createElement('div');
  build.textContent = `${APP_VERSION} · ${formatBuildStamp(BUILD_HASH, BUILD_TIME)}`;
  build.style.cssText = `font:${M.infoFontPx}px monospace;opacity:0.7;margin-top:4px;word-break:break-word;`;

  // The Android back closes the menu (it covers the window that opened it).
  let releaseBack: () => void = () => undefined;
  const sound = buildSoundStatus();
  const events = buildTelemetryStatus();
  const close = (): void => {
    sound?.dispose();
    events.dispose();
    releaseBack();
    box.remove();
    openMenu = null;
  };
  releaseBack = pushBack(() => {
    close();
    return true;
  });

  const startOptions = START_OPTIONS.map((o) => ({
    value: o.height,
    label: `${o.zone} ${o.height}${o.checkpoint ? ' (cp)' : ''}`,
  }));
  const auto = M.autoLabel;
  const placeOptions = [
    { value: null, label: auto },
    ...PLACE_OPTIONS.map((value) => ({ value, label: value })),
  ];
  const weatherOptions = [
    { value: null, label: auto },
    ...WEATHER_OPTIONS.map((value) => ({ value, label: value })),
  ];

  const perf = row();
  perf.append(
    button('Perf: no team', () => reloadWithQuery(PERF_QUERY.noTeam)),
    button('Perf: master team', () => reloadWithQuery(PERF_QUERY.masterTeam)),
  );
  const tools = row();
  tools.append(
    button('Sound board', () => reloadWithQuery(SOUNDBOARD_QUERY)),
    switchButton('Frame counter', choice.fps, (on) => (choice.fps = on)),
    switchButton('Debug panel', choice.panel, (on) => (choice.panel = on)),
  );
  const notif = row();
  const notifButton = button('Notifications: test in 1 min', () => {
    void askNotifPermission().then((granted) => {
      if (granted) notifTest.arm();
      notifButton.textContent = granted
        ? 'Armed: send the app to the background, it arrives in 1 min'
        : 'No permission: allow notifications in the system settings';
    });
  });
  notif.append(notifButton);
  const finish = row();
  finish.append(
    button('Start', () => reloadWithQuery(composeRunQuery(choice)), M.startFill),
    button('Normal start', () => reloadWithQuery('')),
    button('Close', close),
  );

  inner.append(
    title,
    build,
    menuHeading('Benchmark (starts at once)'),
    perf,
    menuHeading('Run from'),
    optionRow(startOptions, choice.startHeight, (v) => (choice.startHeight = v)),
    menuHeading('Start place'),
    optionRow(placeOptions, choice.place, (v) => (choice.place = v)),
    menuHeading('Weather'),
    optionRow(weatherOptions, choice.weather, (v) => (choice.weather = v)),
    menuHeading('Tools'),
    tools,
    ...(sound ? [sound.element] : []),
    notif,
    events.element,
    menuHeading('Go'),
    finish,
  );
  document.body.appendChild(box);
  openMenu = box;
}
