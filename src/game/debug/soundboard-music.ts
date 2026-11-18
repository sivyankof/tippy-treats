import {
  DEFAULT_MUSIC_VARIANT,
  MUSIC_VARIANTS,
  musicVariantOf,
  type MusicVariant,
} from '../../data/music/songs';
import { DEFAULT_MUSIC_MIX, MUSIC_PLAY, type MusicMix } from '../../data/music/music-play';
import { t } from '../../i18n';
import { services } from '../../services';

/** Instrument steps the switch offers (one more per zone). */
const LAYERS = Array.from({ length: MUSIC_PLAY.layers }, (_, i) => i + 1);

/** Knob scale: 0..KNOB_MAX of the game level (1); above 1 is louder than the game. */
const KNOB_MAX = 2;
const KNOB_STEPS = 100;

/** The "music + drop + combo" button: a drop every `gapMs`, perfect from combo 1 to `steps`, then a coin. */
const COMBO_RUN = { leadMs: 1200, gapMs: 900, steps: 12 } as const;

/** Shared with the "all at once" button: the tune the soundboard last chose (`?music=` picks the first one). */
export const musicChoice: { variant: MusicVariant; layer: number; menu: boolean } = {
  variant: musicVariantOf(new URLSearchParams(location.search).get('music')),
  layer: 1,
  menu: false,
};

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

/** A labelled range input over 0..max, starting at `value`. */
function knob(
  label: string,
  value: number,
  max: number,
  onChange: (v: number) => void,
): HTMLElement {
  const box = document.createElement('div');
  box.className = 'sb-row';
  const name = document.createElement('label');
  name.textContent = label;
  const input = document.createElement('input');
  input.type = 'range';
  input.min = '0';
  input.max = String(KNOB_STEPS);
  input.value = String(Math.round((value / max) * KNOB_STEPS));
  input.addEventListener('input', () => onChange((Number(input.value) / KNOB_STEPS) * max));
  box.append(name, input);
  return box;
}

/** Lights the button of the current choice in a row. */
function light<T>(buttons: ReadonlyMap<T, HTMLButtonElement>, chosen: T): void {
  for (const [value, b] of buttons) b.classList.toggle('on', value === chosen);
}

/** The chosen tune, a run of drops with a rising perfect combo over it, and a coin at the end. */
function comboRun(): void {
  const r = COMBO_RUN;
  services.audio.music.start({ ...musicChoice });
  for (let i = 0; i < r.steps; i++) {
    setTimeout(
      () => {
        services.audio.play('drop');
        services.audio.play('perfect', i + 1);
      },
      r.leadMs + i * r.gapMs,
    );
  }
  setTimeout(() => services.audio.play('coin'), r.leadMs + r.steps * r.gapMs);
}

/**
 * The music section of the soundboard: a button per tune (starts it at the chosen step), the
 * step switch 1..6, the menu toggle, stop and the reverb switch, the knobs (tape, drums, melody;
 * the music volume is the "Music" slider at the top) and the "music + drop + combo" button. It drives `services.audio.music` like the
 * game does.
 */
export function buildMusicSection(root: HTMLElement): void {
  const title = document.createElement('h2');
  title.textContent = t('soundboard.musicTitle');
  const card = document.createElement('div');
  card.className = 'sb-card';
  const note = document.createElement('p');
  note.className = 'sb-note';
  note.textContent = `${t('tunes.hint')} ${t(`tunes.${DEFAULT_MUSIC_VARIANT}`)}: ${t('tunes.default')}.`;

  const tunes = new Map<MusicVariant, HTMLButtonElement>();
  for (const variant of MUSIC_VARIANTS) {
    tunes.set(
      variant,
      button(`▶ ${t(`tunes.${variant}`)}`, () => {
        musicChoice.variant = variant;
        light(tunes, variant);
        services.audio.music.start({ ...musicChoice });
      }),
    );
  }
  const stop = button(t('soundboard.stop'), () => services.audio.music.stop(), 'alt');

  const layers = new Map<number, HTMLButtonElement>();
  for (const layer of LAYERS) {
    layers.set(
      layer,
      button(
        `${t('soundboard.step')} ${layer}`,
        () => {
          musicChoice.layer = layer;
          light(layers, layer);
          services.audio.music.setLayer(layer);
        },
        'alt',
      ),
    );
  }

  const menu = button(
    t('soundboard.menu'),
    () => {
      musicChoice.menu = !musicChoice.menu;
      menu.classList.toggle('on', musicChoice.menu);
      services.audio.music.setMenu(musicChoice.menu);
    },
    'alt',
  );

  const mix: MusicMix = { ...DEFAULT_MUSIC_MIX };
  const reverb = button(
    t('soundboard.reverb'),
    () => {
      mix.reverb = !mix.reverb;
      reverb.classList.toggle('on', mix.reverb);
      services.audio.music.setMix({ reverb: mix.reverb });
    },
    'alt on',
  );
  const setKnob = (key: 'tape' | 'drums' | 'melody') => (value: number) => {
    mix[key] = value;
    services.audio.music.setMix({ [key]: value });
  };

  const combo = button(`▶ ${t('soundboard.comboRun')}`, comboRun);
  const comboNote = document.createElement('p');
  comboNote.className = 'sb-note';
  comboNote.textContent = t('soundboard.comboRunHint');

  light(layers, musicChoice.layer);
  card.append(
    note,
    row(...tunes.values(), stop),
    row(...layers.values()),
    row(menu, reverb),
    knob(t('soundboard.knobTape'), mix.tape, KNOB_MAX, setKnob('tape')),
    knob(t('soundboard.knobDrums'), mix.drums, KNOB_MAX, setKnob('drums')),
    knob(t('soundboard.knobMelody'), mix.melody, KNOB_MAX, setKnob('melody')),
    row(combo),
    comboNote,
  );
  root.append(title, card);
}
