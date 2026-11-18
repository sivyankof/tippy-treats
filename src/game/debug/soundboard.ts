import './soundboard.css';
import { getLang, setLang, t } from '../../i18n';
import { audioDev, services } from '../../services';
import type { SoundArgs, SoundId } from '../../services/audio/sound-args';
import { SOUND_BOOK, SOUND_GROUPS, soundVariants } from '../../services/audio/sound-book';
import { bindAudioUnlock } from '../audio-unlock';
import { buildMusicSection, musicChoice } from './soundboard-music';

/** Slider scale: 0..SLIDER_MAX of the normal level (above 1 is louder than the game). */
const SLIDER_MAX = 1.5;
const SLIDER_STEPS = 100;
/** How often the header checks whether the audio runs, ms. */
const STATUS_POLL_MS = 400;
/** The "all at once" button: the collapse slaps follow the bell. */
const ALL_AT_ONCE = {
  slapIndexes: [0, 1, 2, 3],
  slapStartMs: 120,
  slapGapMs: 70,
  comboStep: 6,
} as const;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = '',
  text = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

function slider(label: string, onChange: (value: number) => void): HTMLElement {
  const row = el('div', 'sb-row');
  const input = el('input');
  input.type = 'range';
  input.min = '0';
  input.max = String(SLIDER_STEPS);
  input.value = String(Math.round(SLIDER_STEPS / SLIDER_MAX));
  input.addEventListener('input', () =>
    onChange((Number(input.value) / SLIDER_STEPS) * SLIDER_MAX),
  );
  row.append(el('label', '', label), input);
  return row;
}

function playSound(id: SoundId, args: unknown[]): void {
  services.audio.play(id, ...(args as SoundArgs[SoundId]));
}

function soundCard(id: SoundId): HTMLElement {
  const entry = SOUND_BOOK[id];
  const card = el('div', 'sb-card');
  const code = el('div', 'sb-code', id);
  if (entry.ownerChoice) code.append(el('span', 'sb-mark', t('soundboard.ownerChoice')));
  const buttons = el('div', 'sb-btns');
  for (const variant of soundVariants(id)) {
    const label = variant.label === '' ? `▶ ${t('soundboard.play')}` : `▶ ${variant.label}`;
    const b = el('button', '', label);
    b.type = 'button';
    b.addEventListener('click', () => playSound(id, variant.args));
    buttons.append(b);
  }
  card.append(code, el('p', 'sb-desc', t(`soundboard.sound.${id}`)), buttons);
  return card;
}

function allAtOnce(): void {
  const a = ALL_AT_ONCE;
  services.audio.music.start({ ...musicChoice });
  services.audio.play('drop');
  services.audio.play('perfect', a.comboStep);
  services.audio.play('coin');
  services.audio.play('ability', 'legendary');
  a.slapIndexes.forEach((index, i) => {
    setTimeout(() => services.audio.play('collapseThud', index), a.slapStartMs + i * a.slapGapMs);
  });
}

/** Builds the soundboard page in place of the game. Dev only (`?soundboard=1`). */
export function showSoundboard(): void {
  const lang = new URLSearchParams(location.search).get('lang');
  if (lang === 'en' || lang === 'ru') setLang(lang);
  document.documentElement.lang = getLang();
  document.getElementById('app')?.remove();
  bindAudioUnlock(services.audio);
  // The page is for listening: the saved switches do not mute it.
  services.audio.setEnabled(true);
  services.audio.setMusicEnabled(true);

  const root = el('div', 'sb');
  document.body.append(root);
  root.append(el('h1', '', t('soundboard.title')));
  const status = el('div', 'sb-status', t('soundboard.tapToEnable'));
  root.append(status);
  const poll = (): void => {
    const stats = services.audio.debugStats();
    const running = stats.contextState === 'running';
    status.className = running ? 'sb-status ok' : 'sb-status';
    status.textContent = running
      ? `${t('soundboard.enabled')} · ${t('soundboard.stats')}: ${stats.liveNodes}`
      : t('soundboard.tapToEnable');
  };
  poll();
  setInterval(poll, STATUS_POLL_MS);

  root.append(
    slider(t('soundboard.master'), (v) => audioDev?.setLevels({ master: v })),
    slider(t('soundboard.music'), (v) => audioDev?.setLevels({ music: v })),
    slider(t('soundboard.sfx'), (v) => audioDev?.setLevels({ sfx: v })),
  );

  const all = el('button', '', `▶ ${t('soundboard.all')}`);
  all.type = 'button';
  all.addEventListener('click', allAtOnce);
  const allCard = el('div', 'sb-card');
  allCard.append(all, el('p', 'sb-note', t('soundboard.allHint')));
  root.append(allCard);

  const ids = Object.keys(SOUND_BOOK) as SoundId[];
  for (const group of SOUND_GROUPS) {
    const members = ids.filter((id) => SOUND_BOOK[id].group === group);
    if (members.length === 0) continue;
    root.append(el('h2', '', t(`soundboard.group.${group}`)));
    for (const id of members) root.append(soundCard(id));
  }

  buildMusicSection(root);
}
