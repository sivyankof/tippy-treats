import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { formatNumber, t } from '../../../i18n';
import { slotLayers } from '../../../core/team';
import { createOutlinedText } from '../outlined-text';
import { faceOffsetY, VolumePlate } from '../style/volume';
import { fitText } from './fit-text';

const cfg = MENU.team;
const plateCfg = cfg.orderPlate;

/** The layer order of the slots and the control hint, together on one window plate. */
export class TeamOrderPlate {
  private readonly plate: VolumePlate;
  private readonly order: Phaser.GameObjects.Text;
  private readonly help: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const [a = '', b = '', c = ''] = slotLayers().map((n) => formatNumber(n));
    this.plate = new VolumePlate(scene, 'window', plateCfg.height);
    this.order = createOutlinedText(scene, 0, 0, t('team.order', { a, b, c }), cfg.orderFont);
    this.help = createOutlinedText(scene, 0, 0, t('team.help'), cfg.helpFont);
  }

  get parts(): Array<VolumePlate | Phaser.GameObjects.Text> {
    return [this.plate, this.order, this.help];
  }

  layout(width: number, y: number): void {
    const bodyWidth = width - plateCfg.sideMargin * 2;
    const face = y + faceOffsetY('window');
    this.plate.setBodyWidth(bodyWidth).setPosition(width / 2, y);
    this.order.setPosition(width / 2, face + plateCfg.orderDy);
    this.help.setPosition(width / 2, face + plateCfg.helpDy);
    fitText(this.order, bodyWidth - plateCfg.padX * 2);
    fitText(this.help, bodyWidth - plateCfg.padX * 2);
  }
}
