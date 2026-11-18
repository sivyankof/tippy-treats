import {
  DEFAULT_MUSIC_VARIANT,
  MUSIC_VARIANTS,
  musicVariantOf,
  type MusicVariant,
} from '../../data/music/songs';
import { MUSIC_PLAY } from '../../data/music/music-play';
import { t } from '../../i18n';
import { services } from '../../services';

/** Instrument layers the switch offers (one more per zone). */
const LAYERS = Array.from({ length: MUSIC_PLAY.layers }, (_, i) => i + 1);

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

/** Lights the button of the current choice in a row. */
function light<T>(buttons: ReadonlyMap<T, HTMLButtonElement>, chosen: T): void {
  for (const [value, b] of buttons) b.classList.toggle('on', value === chosen);
}

/**
 * The music section of the soundboard: a button per tune (starts it at the chosen layer), the
 * layer switch 1..6, the menu toggle and stop. It drives `services.audio.music` like the game does.
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
        `${t('soundboard.layer')} ${layer}`,
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

  light(layers, musicChoice.layer);
  card.append(note, row(...tunes.values(), stop), row(...layers.values()), row(menu));
  root.append(title, card);
}
