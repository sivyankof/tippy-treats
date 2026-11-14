import * as Phaser from 'phaser';
import { BALANCE } from '../../data/balance';
import { CREATURES, type CreatureId } from '../../data/creatures';
import { MENU } from '../../data/menu-layout';
import { PALETTE } from '../../data/palette';
import { RARITY_COLORS } from '../../data/rarity';
import { t } from '../../i18n';
import { cssColor } from '../../util/color';
import { Particles } from '../fx/particles';
import { CreaturePortrait } from '../objects/creature-portrait';
import { goNext, SCENES, type NewCreatureData } from '../scene-keys';
import { createTextButton, type Button } from '../ui/button';
import { fitText } from '../ui/menu/fit-text';
import { TitleRibbon } from '../ui/style/title-ribbon';
import { MenuScenery } from '../ui/style/menu-scenery';
import { GiftBox } from '../ui/menu/new-creature-box';
import { LightRays } from '../ui/menu/new-creature-rays';
import { NewCreatureSequence } from '../ui/menu/new-creature-sequence';
import { createOutlinedText } from '../ui/outlined-text';
import { enterScreen, leaveScreen, type Movable } from '../ui/transition';

const cfg = MENU.newCreature;
const BUTTON = MENU.wideButton;

/** Presents the creature of a reward: a gift box shakes, opens and the creature jumps out. */
export class NewCreatureScene extends Phaser.Scene {
  private params!: NewCreatureData;
  private background!: MenuScenery;
  private particles!: Particles;
  private title!: TitleRibbon;
  private rays!: LightRays;
  private box!: GiftBox;
  private portrait!: CreaturePortrait;
  private nameText!: Phaser.GameObjects.Text;
  private rarityText!: Phaser.GameObjects.Text;
  private button!: Button;
  private veil!: Phaser.GameObjects.Rectangle;
  private sequence!: NewCreatureSequence;
  private leaving = false;
  private nameWidth = 0;
  private rarityWidth = 0;
  private names: [string, string] = ['', ''];
  private ready = false;

  constructor() {
    super(SCENES.newCreature);
  }

  create(data: NewCreatureData): void {
    this.params = data;
    this.ready = false;
    const id = data.creatures[0];
    if (!id) {
      this.next();
      return;
    }
    this.ready = true;
    this.leaving = false;
    this.background = new MenuScenery(this, 'list');
    this.veil = this.add.rectangle(0, 0, 1, 1, 0, 0).setOrigin(0).setInteractive();
    this.veil.on(Phaser.Input.Events.POINTER_DOWN, () => this.skip());
    this.particles = new Particles(this);
    this.buildObjects(id);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.particles.clear();
    });
    this.layout();
    enterScreen(this, [this.title]);
    this.time.delayedCall(cfg.startDelayMs, () => this.sequence.start());
  }

  override update(_time: number, delta: number): void {
    if (!this.ready) return;
    this.background.update(delta);
    this.particles.update(delta);
    this.rays.tick(delta);
    this.portrait.tick(delta);
    this.sequence.update(delta);
  }

  private buildObjects(id: CreatureId): void {
    const def = CREATURES[id];
    const color = RARITY_COLORS[def.rarity];
    const maxWidth = this.scale.gameSize.width - cfg.sideMargin * 2;
    this.names = [t(def.nameKey), t(`rarity.${def.rarity}`)];
    this.rays = new LightRays(this, color);
    this.title = new TitleRibbon(this, 0, 0, t('newCreature.title'));
    this.title.setMaxWidth(maxWidth);
    this.box = new GiftBox(this, 0, 0).setVisible(false);
    this.portrait = new CreaturePortrait(this, 0, 0, id, 1, cfg.layerWidth).setVisible(false);
    const hit = new Phaser.Geom.Rectangle(0, 0, cfg.layerWidth, cfg.layerWidth * cfg.portraitHit);
    this.portrait
      .setSize(hit.width, hit.height)
      .setInteractive(hit, Phaser.Geom.Rectangle.Contains);
    this.portrait.on(Phaser.Input.Events.POINTER_DOWN, () => {
      if (this.sequence.phase === 'done') this.portrait.poke();
      else this.skip();
    });
    this.nameText = this.makeLine(this.names[0], cfg.nameFont, PALETTE.textLight, maxWidth);
    this.rarityText = this.makeLine(this.names[1], cfg.rarityFont, color, maxWidth);
    this.nameWidth = this.nameText.displayWidth;
    this.rarityWidth = this.rarityText.displayWidth;
    this.nameText.setText('');
    this.rarityText.setText('');
    this.sequence = new NewCreatureSequence({
      scene: this,
      box: this.box,
      portrait: this.portrait,
      rays: this.rays,
      particles: this.particles,
      nameText: this.nameText,
      rarityText: this.rarityText,
      names: this.names,
      center: () => this.center,
      onDone: () => this.showButton(),
    });
    this.button = createTextButton(this, {
      text: t('newCreature.ok'),
      font: BUTTON.font,
      maxLabelWidth: BUTTON.width - cfg.buttonLabelPad,
      fill: PALETTE.accent,
      layout: BUTTON,
      keyPrefix: 'ui_menu_wide_button',
      onClick: () => this.confirm(),
    })
      .button.setEnabled(false)
      .setVisible(false);
  }

  /** A one-line text that grows letter by letter, so it is left-aligned at a fixed start. */
  private makeLine(
    text: string,
    size: number,
    color: number,
    maxWidth: number,
  ): Phaser.GameObjects.Text {
    const line = fitText(createOutlinedText(this, 0, 0, text, size), maxWidth);
    line.setColor(cssColor(color)).setOrigin(0, 0.5);
    return line;
  }

  private get center(): { x: number; y: number } {
    const { width, height } = this.scale.gameSize;
    return { x: width / 2, y: height * cfg.boxY };
  }

  private layout(): void {
    const { width, height } = this.scale.gameSize;
    const { x, y } = this.center;
    this.cameras.main.setSize(width, height);
    this.background.resize(width, height);
    this.veil.setSize(width, height);
    this.title.setPosition(x, height * cfg.titleY);
    this.rays.setPosition(x, y);
    const { phase } = this.sequence;
    if (phase === 'intro' || phase === 'shake') this.box.setPosition(x, y);
    if (phase === 'done') this.portrait.setPosition(x, y);
    const nameY = y + BALANCE.layer.height / 2 + cfg.nameGap;
    this.nameText.setPosition(x - this.nameWidth / 2, nameY);
    this.rarityText.setPosition(x - this.rarityWidth / 2, nameY + cfg.rarityGap);
    this.button.setPosition(x, height * cfg.buttonY);
  }

  private skip(): void {
    if (this.leaving) return;
    this.sequence.skip();
  }

  private showButton(): void {
    this.button.setVisible(true).setScale(0);
    this.tweens.add({
      targets: this.button,
      scale: 1,
      duration: cfg.buttonPopMs,
      ease: 'Back.easeOut',
      onComplete: () => this.button.setEnabled(true).breathe(),
    });
  }

  private content(): Movable[] {
    return [this.title, this.portrait, this.nameText, this.rarityText, this.button];
  }

  private confirm(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.button.setEnabled(false);
    leaveScreen(this, this.content(), () => this.next());
  }

  /** The next creature of the list, or on to what the screen was opened for. */
  private next(): void {
    const rest = this.params.creatures.slice(1);
    if (rest.length > 0) {
      this.scene.restart({ ...this.params, creatures: rest });
      return;
    }
    const { then, firstHome } = this.params;
    if (then.kind === 'screen' && then.key === SCENES.home && firstHome) {
      goNext(this, { ...then, data: { ...then.data, highlightPlay: true } });
      return;
    }
    goNext(this, then);
  }
}
