import { t } from '../../i18n';
import { services } from '../../services';
import type { MusicVariant } from '../../services/audio/music-control';

/** Tunes offered by the music section; theme C names them. */
const VARIANTS: readonly MusicVariant[] = ['a', 'b', 'c'];
/** Instrument layers the switch offers (one more per zone). */
const LAYERS = [1, 2, 3, 4, 5, 6] as const;

/** Shared with the "all at once" button: the tune the soundboard last chose. */
export const musicChoice: { variant: MusicVariant; layer: number; menu: boolean } = {
  variant: 'a',
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

/**
 * The music section of the soundboard: tune buttons, the layer switch, the menu toggle, stop.
 * It drives `services.audio.music` (the `MusicControl`), so it works as soon as a player exists;
 * theme C extends it from here (more switches go into this function).
 */
export function buildMusicSection(root: HTMLElement): void {
  const title = document.createElement('h2');
  title.textContent = t('soundboard.musicTitle');
  const card = document.createElement('div');
  card.className = 'sb-card';
  const note = document.createElement('p');
  note.className = 'sb-note';
  note.textContent = t('soundboard.musicPending');

  const tunes = VARIANTS.map((variant) =>
    button(`${t('soundboard.variant')} ${variant.toUpperCase()}`, () => {
      musicChoice.variant = variant;
      services.audio.music.start({ ...musicChoice });
    }),
  );
  tunes.push(button(t('soundboard.stop'), () => services.audio.music.stop(), 'alt'));

  const layers = LAYERS.map((layer) =>
    button(
      `${t('soundboard.layer')} ${layer}`,
      () => {
        musicChoice.layer = layer;
        services.audio.music.setLayer(layer);
      },
      'alt',
    ),
  );

  const menu = button(
    t('soundboard.menu'),
    () => {
      musicChoice.menu = !musicChoice.menu;
      menu.classList.toggle('on', musicChoice.menu);
      services.audio.music.setMenu(musicChoice.menu);
    },
    'alt',
  );

  card.append(note, row(...tunes), row(...layers), row(menu));
  root.append(title, card);
}
