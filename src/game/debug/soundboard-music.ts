import { MUSIC_TRACK_IDS, MUSIC_TRACKS, type MusicTrackId } from '../../data/music';
import { t } from '../../i18n';
import { services } from '../../services';

/** The "music + drop + combo" button: a drop every `gapMs`, perfect from combo 1 to `steps`, then a coin. */
const COMBO_RUN = { leadMs: 1200, gapMs: 900, steps: 12 } as const;
/** How often the memory line under the tracks is refreshed, ms. */
const MEMORY_POLL_MS = 500;
const BYTES_PER_MB = 1_000_000;

/** Shared with the "all at once" button: the track the soundboard last chose. */
export const musicChoice: { track: MusicTrackId } = { track: 'menu' };

function button(label: string, onTap: () => void, cls = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  if (cls) b.className = cls;
  b.addEventListener('click', onTap);
  return b;
}

function row(...children: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.className = 'sb-btns';
  box.append(...children);
  return box;
}

/** Lights the button of the current choice in a row. */
function light<T>(buttons: ReadonlyMap<T, HTMLButtonElement>, chosen: T | null): void {
  for (const [value, b] of buttons) b.classList.toggle('on', value === chosen);
}

/** The drops and the coin of the running combo run (cleared by a new run and by Stop). */
let comboTimers: Array<ReturnType<typeof setTimeout>> = [];

function clearComboRun(): void {
  for (const id of comboTimers) clearTimeout(id);
  comboTimers = [];
}

/** The chosen track, a run of drops with a rising perfect combo over it, and a coin at the end. */
function comboRun(): void {
  const r = COMBO_RUN;
  clearComboRun();
  services.audio.music.play(musicChoice.track);
  for (let i = 0; i < r.steps; i++) {
    comboTimers.push(
      setTimeout(
        () => {
          services.audio.play('drop');
          services.audio.play('perfect', i + 1);
        },
        r.leadMs + i * r.gapMs,
      ),
    );
  }
  comboTimers.push(setTimeout(() => services.audio.play('coin'), r.leadMs + r.steps * r.gapMs));
}

/**
 * The music section of the soundboard: the playlist, its next track and stop, a button per track
 * (it plays round and round like the daily tower's; the change fades like in the game), what plays, the decoded memory of the player now and at its peak, and the "music + drop + combo"
 * button. The music volume is the "Music" slider at the top. It drives `services.audio.music`
 * like the game does.
 */
export function buildMusicSection(root: HTMLElement): void {
  const title = document.createElement('h2');
  title.textContent = t('soundboard.musicTitle');
  const card = document.createElement('div');
  card.className = 'sb-card';

  const tracks = new Map<MusicTrackId, HTMLButtonElement>();
  for (const track of MUSIC_TRACK_IDS) {
    tracks.set(
      track,
      button(`▶ ${t(`soundboard.track.${track}`)}`, () => {
        musicChoice.track = track;
        light(tracks, track);
        services.audio.music.play(track);
      }),
    );
  }
  const playlist = button(`▶ ${t('soundboard.playlist')}`, () => {
    light(tracks, null);
    services.audio.music.playlist();
  });
  const next = button(`⏭ ${t('soundboard.nextTrack')}`, () => {
    light(tracks, null);
    services.audio.music.next();
  });
  const stop = button(
    t('soundboard.stop'),
    () => {
      clearComboRun();
      light(tracks, null);
      services.audio.music.stop();
    },
    'alt',
  );

  const files = document.createElement('p');
  files.className = 'sb-note';
  files.textContent = MUSIC_TRACK_IDS.map(
    (track) => `${t(`soundboard.track.${track}`)}: ${MUSIC_TRACKS[track].file}`,
  ).join(' · ');

  const memory = document.createElement('p');
  memory.className = 'sb-note';
  const poll = (): void => {
    const s = services.audio.music.state();
    const playing = s.track ? t(`soundboard.track.${s.track}`) : '—';
    const turn = s.playlist ? ` · ${t('soundboard.playlist')}: ${Math.round(s.turnSec)} s` : '';
    memory.textContent = `${playing}${turn} · ${t('soundboard.musicMemory', {
      now: (s.decodedBytes / BYTES_PER_MB).toFixed(1),
      peak: (s.peakBytes / BYTES_PER_MB).toFixed(1),
      decks: s.decks,
    })}`;
  };
  poll();
  setInterval(poll, MEMORY_POLL_MS);

  const combo = button(`▶ ${t('soundboard.comboRun')}`, comboRun);
  const comboNote = document.createElement('p');
  comboNote.className = 'sb-note';
  comboNote.textContent = t('soundboard.comboRunHint');

  card.append(
    row(playlist, next, stop),
    row(...tracks.values()),
    memory,
    files,
    row(combo),
    comboNote,
  );
  root.append(title, card);
}
