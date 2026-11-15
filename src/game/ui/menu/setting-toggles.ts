import type * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { t } from '../../../i18n';
import { services } from '../../../services';
import { setReducedFxOn, setSoundOn, setVibrationOn } from '../../apply-settings';
import { effectsMode } from '../../effects-mode';
import { ToggleSwitch } from '../style/toggle-switch';

const { height, gap } = MENU.style.toggle;

/** One switch of a column: its label and how the setting is read and written. */
export interface ToggleRowSpec {
  label: string;
  read: () => boolean;
  write: (on: boolean) => void;
  /** The row is narrower by this much and shifted right (a switch that belongs to the one above). */
  indent?: number;
}

export interface ToggleRows {
  toggles: ToggleSwitch[];
  /** Where the column ends, measured like `top`. */
  bottom: number;
}

/**
 * A column of switches of the style kit, `top` being the top of the first row and `x` the middle
 * of the column. After a switch is flipped the others read their setting again, so switches that
 * depend on each other (the general and the per-type notifications) stay in step.
 */
export function createToggleRows(
  scene: Phaser.Scene,
  rows: readonly ToggleRowSpec[],
  layout: { x: number; top: number; width: number },
): ToggleRows {
  const toggles: ToggleSwitch[] = rows.map(
    (row, index) =>
      new ToggleSwitch(
        scene,
        layout.x + (row.indent ?? 0) / 2,
        layout.top + height / 2 + index * (height + gap),
        {
          label: row.label,
          width: layout.width - (row.indent ?? 0),
          read: row.read,
          write: (on) => {
            row.write(on);
            toggles.forEach((other, i) => i !== index && other.refresh());
          },
        },
      ),
  );
  return { toggles, bottom: layout.top + rows.length * (height + gap) - gap };
}

/** Sounds, vibration and "fewer effects": the same three rows in the pause and the settings windows. */
export function soundSettingRows(): ToggleRowSpec[] {
  return [
    { label: t('run.sounds'), read: () => services.audio.enabled, write: setSoundOn },
    { label: t('run.vibration'), read: () => services.haptics.enabled, write: setVibrationOn },
    { label: t('run.reducedFx'), read: () => effectsMode.switchOn, write: setReducedFxOn },
  ];
}
